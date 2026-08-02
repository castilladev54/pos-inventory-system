import { User, type IUser } from "../models/User.js";
import { Category } from "../models/Category.js";
import { Product } from "../models/Product.js";
import { Purchase } from "../models/Purchase.js";
import { PurchaseDetail } from "../models/PurchaseDetail.js";
import { Sale } from "../models/Sale.js";
import { SaleDetail } from "../models/SaleDetail.js";
import mongoose from "mongoose";
import crypto from "crypto";
import jwt from "jsonwebtoken";
// bcryptjs ships its own types inside the package; no @types needed
import bcryptjs from "bcryptjs";
import type { Request, Response } from "express";
import { generateAccessToken, generateRefreshToken } from "../utils/generateToken.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { randomUUID } from "crypto";
import { sendPasswordResetEmail, sendResetSuccessEmail } from "../mailtrap/emails.js";
import { bumpCacheVersion, redis } from "../lib/redis.js";

// ─── CONSTANTES DE SEGURIDAD ────────────────────────────────────────────────
const GRACE_PERIOD_MS = 15_000; // 15 segundos de tolerancia para reintentos legítimos
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, role } = req.body as {
    email: string;
    password: string;
    name: string;
    role?: string;
  };

  try {
    // Validar si es administrador el que hace la petición
    const adminUser = await User.findById(req.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      res.status(403).json({ success: false, message: "Sólo los administradores pueden crear usuarios." });
      return;
    }

    const userAlreadyExists = await User.findOne({ email });

    if (userAlreadyExists) {
      res.status(400).json({ success: false, message: "El correo ya está registrado" });
      return;
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    // Inicia sus 7 días de prueba en el momento en que el admin lo crea
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 7);

    const user = new User({
      email,
      password: hashedPassword,
      name,
      role: role ?? 'customer',
      subscriptionExpiresAt: expireDate
    });

    await user.save();

    const userObj = user.toObject();
    const { password: _pw, ...userWithoutPassword } = userObj;

    res.status(201).json({
      success: true,
      message: "Usuario creado exitosamente. Ya puede iniciar sesión.",
      user: userWithoutPassword,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ success: false, message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password as string);
    if (!isPasswordValid) {
      res.status(400).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const accessToken = generateAccessToken(user);
    const refreshTokenString = generateRefreshToken(user);

    // Guardar Refresh Token en BD con un nuevo familyId
    const familyId = randomUUID();
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 7); // 7 días

    await RefreshToken.create({
      token: refreshTokenString,
      userId: user._id,
      familyId,
      expiresAt: expireDate,
    });

    // Actualizar lastLogin
    const lastLogin = new Date();
    await User.updateOne({ _id: user._id }, { $set: { lastLogin } });

    const userObj = user.toObject();
    const { password: _pw, ...userWithoutPassword } = userObj;

    res.cookie("refreshToken", refreshTokenString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      token: accessToken,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Error in login ", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ success: false, message });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      // Revocar el token actual
      await RefreshToken.findOneAndUpdate(
        { token: refreshToken },
        { isRevoked: true }
      );
    }
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Error in logout ", error);
    res.status(500).json({ success: false, message: "Error during logout" });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  // ──────────────────────────────────────────────────────────────────────────
  // PASO 1: Extraer cookie y validar nulidad
  // ──────────────────────────────────────────────────────────────────────────
  const currentToken = req.cookies?.refreshToken;
  if (!currentToken) {
    res.status(401).json({ success: false, message: "No refresh token provided" });
    return;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PASO 2: ESCUDO ANTI-DoS — Verificación criptográfica ANTES de tocar BD
  //
  // Si el token es basura ("abc123") o fue firmado con otra clave, jwt.verify
  // falla en microsegundos de CPU sin generar ninguna consulta de I/O a Mongo.
  // Esto protege el Connection Pool contra ataques de inundación.
  // ──────────────────────────────────────────────────────────────────────────
  try {
    jwt.verify(currentToken, JWT_REFRESH_SECRET as string);
  } catch (jwtError) {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.status(401).json({ success: false, message: "Invalid refresh token" });
    return;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PASO 3: Iniciar transacción Mongoose (ACID)
  //
  // Toda la lógica de lectura + revocación + creación es atómica.
  // Si MongoDB falla a mitad de camino, abortTransaction() hace rollback
  // y el token viejo NO queda revocado → la sesión del usuario sobrevive.
  // ──────────────────────────────────────────────────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ────────────────────────────────────────────────────────────────────────
    // PASO 4: Consultar BD (ahora seguro — solo tokens criptográficamente válidos llegan aquí)
    // ────────────────────────────────────────────────────────────────────────
    const savedToken = await RefreshToken.findOne({ token: currentToken })
      .populate<{ userId: IUser }>('userId')
      .session(session);

    if (!savedToken) {
      await session.abortTransaction();
      session.endSession();
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.status(401).json({ success: false, message: "Invalid refresh token" });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASO 5: Detección de Robo CON Ventana de Gracia
    //
    // Problema original: Un micro-corte de red causa que el cliente no reciba
    // la nueva cookie y reintente con la vieja, disparando la revocación nuclear.
    //
    // Solución: Si el token fue revocado hace menos de GRACE_PERIOD_MS (15s),
    // asumimos que es un reintento legítimo y reenviamos el token hijo.
    // Si pasó la ventana → es un ataque real → revocamos toda la familia.
    // ────────────────────────────────────────────────────────────────────────
    if (savedToken.isRevoked) {
      const replacedAt = savedToken.replacedAt;
      const replacedByToken = savedToken.replacedByToken;

      // ¿Existe marca de rotación y estamos dentro de la ventana de gracia?
      if (replacedAt && replacedByToken) {
        const elapsed = Date.now() - replacedAt.getTime();

        if (elapsed < GRACE_PERIOD_MS) {
          // CASO A: Reintento legítimo (< 15s)
          // Buscamos el token hijo que lo reemplazó y lo reenviamos.
          const childToken = await RefreshToken.findOne({ token: replacedByToken })
            .populate<{ userId: IUser }>('userId')
            .session(session);

          if (childToken && !childToken.isRevoked) {
            await session.abortTransaction();
            session.endSession();

            const childUser = childToken.userId as IUser;
            const newAccessToken = generateAccessToken(childUser);

            res.cookie("refreshToken", replacedByToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            res.status(200).json({
              success: true,
              token: newAccessToken,
            });
            return;
          }
        }
      }

      // CASO B: Robo real (ventana expirada o sin marca de rotación)
      // Revocación nuclear: invalida toda la familia de tokens.
      await RefreshToken.updateMany(
        { familyId: savedToken.familyId },
        { isRevoked: true }
      ).session(session);

      await session.commitTransaction();
      session.endSession();

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.status(401).json({ success: false, message: "Token reuse detected. Session terminated." });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASO 6: Verificar expiración del token en BD
    // ────────────────────────────────────────────────────────────────────────
    if (savedToken.expiresAt < new Date()) {
      await session.abortTransaction();
      session.endSession();
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.status(401).json({ success: false, message: "Refresh token expired" });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASO 7: Validación estricta del usuario poblado (elimina 'as any')
    // ────────────────────────────────────────────────────────────────────────
    const user = savedToken.userId as IUser;
    if (!user || !user._id) {
      await session.abortTransaction();
      session.endSession();
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────
    // PASO 8: Generar nuevos tokens (Rotación Estricta)
    // ────────────────────────────────────────────────────────────────────────
    const newAccessToken = generateAccessToken(user);
    const newRefreshTokenString = generateRefreshToken(user);

    // ────────────────────────────────────────────────────────────────────────
    // PASO 9: Rotación atómica — revocar viejo + crear nuevo (misma transacción)
    //
    // Se estampan replacedAt y replacedByToken para habilitar la ventana de
    // gracia en caso de reintento legítimo por pérdida de paquete HTTP.
    // ────────────────────────────────────────────────────────────────────────
    savedToken.isRevoked = true;
    savedToken.replacedAt = new Date();
    savedToken.replacedByToken = newRefreshTokenString;
    await savedToken.save({ session });

    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 7);

    await RefreshToken.create(
      [
        {
          token: newRefreshTokenString,
          userId: user._id,
          familyId: savedToken.familyId,
          expiresAt: expireDate,
        },
      ],
      { session }
    );

    // ────────────────────────────────────────────────────────────────────────
    // PASO 10: Commit atómico — todo o nada
    // ────────────────────────────────────────────────────────────────────────
    await session.commitTransaction();
    session.endSession();

    // ────────────────────────────────────────────────────────────────────────
    // PASO 11: Emitir nueva cookie HttpOnly y responder
    // ────────────────────────────────────────────────────────────────────────
    res.cookie("refreshToken", newRefreshTokenString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      token: newAccessToken,
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    console.error("Error in refreshToken ", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email: string };
  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.status(400).json({ success: false, message: "User not found" });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiresAt = resetTokenExpiresAt;

    await user.save();

    // send email
    await sendPasswordResetEmail(
      user.email,
      `${process.env.CLIENT_URL}/reset-password/${resetToken}`
    );

    res.status(200).json({ success: true, message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Error in forgotPassword ", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ success: false, message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body as { password: string };

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({ success: false, message: "Invalid or expired reset token" });
      return;
    }

    // update password
    const hashedPassword = await bcryptjs.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    await sendResetSuccessEmail(user.email);

    res.status(200).json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Error in resetPassword ", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ success: false, message });
  }
};

export const checkAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error in checkAuth ", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};

export const purgeUserAndData = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adminUser = await User.findById(req.userId).session(session);
    if (!adminUser || adminUser.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      res.status(403).json({ success: false, message: "Sólo administradores pueden purgar cuentas." });
      return;
    }

    const { targetUserId } = req.params;

    // Evitar auto-eliminación por seguridad
    if (adminUser._id.toString() === targetUserId) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ success: false, message: "No puedes eliminar tu propia cuenta." });
      return;
    }

    // 1. Eliminar datos transaccionales en Cascada (ACID: todo o nada)
    const userPurchases = await Purchase.find({ admin_id: targetUserId }).session(session);
    const purchaseIds = userPurchases.map(p => p._id);
    await PurchaseDetail.deleteMany({ purchase_id: { $in: purchaseIds } }).session(session);
    await Purchase.deleteMany({ admin_id: targetUserId }).session(session);

    const userSales = await Sale.find({ customer_id: targetUserId }).session(session);
    const saleIds = userSales.map(s => s._id);
    await SaleDetail.deleteMany({ sale_id: { $in: saleIds } }).session(session);
    await Sale.deleteMany({ customer_id: targetUserId }).session(session);

    // 2. Eliminar Catálogo del usuario
    await Product.deleteMany({ user: targetUserId }).session(session);
    await Category.deleteMany({ user: targetUserId }).session(session);

    // 3. Eliminar empleados del usuario (quedarían huérfanos con owner_id inválido)
    const userEmployees = await User.find({ owner_id: targetUserId, role: 'employee' }).session(session);
    const employeeIds = userEmployees.map(emp => emp._id.toString());
    await User.deleteMany({ owner_id: targetUserId, role: 'employee' }).session(session);

    // 4. Eliminar Usuario (si no existe, abort y 404)
    const deletedUser = await User.findByIdAndDelete(targetUserId).session(session);
    if (!deletedUser) {
      await session.abortTransaction();
      session.endSession();
      res.status(404).json({ success: false, message: "Usuario no encontrado." });
      return;
    }

    // 5. Confirmar todo en un único commit atómico
    await session.commitTransaction();
    session.endSession();

    // Invalidar sesiones en Redis de inmediato
    try {
      const redisPromises: Promise<unknown>[] = [
        redis.set(`tokenVersion:${targetUserId}`, "999999", { ex: 7 * 24 * 60 * 60 })
      ];
      for (const empId of employeeIds) {
        redisPromises.push(redis.set(`tokenVersion:${empId}`, "999999", { ex: 7 * 24 * 60 * 60 }));
      }
      await Promise.all(redisPromises);
    } catch (redisError) {
      const msg = redisError instanceof Error ? redisError.message : String(redisError);
      console.error("Error invalidating deleted user sessions in Redis:", msg);
    }

    // 6. Invalidar caché del usuario purgado usando bumpCacheVersion
    //    (el formato real es versionado: "products:v3:p1:l20:userId" — invalidateCache con claves simples no funciona)
    const targetId = targetUserId as string;
    await Promise.all([
      bumpCacheVersion('categories', targetId),
      bumpCacheVersion('products',   targetId),
      bumpCacheVersion('purchases',  targetId),
      bumpCacheVersion('sales',      targetId),
    ]);

    res.status(200).json({ success: true, message: "El usuario y todos sus registros han sido purgados exitosamente de la base de datos." });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    console.error("Error in purgeUserAndData ", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message });
  }
};
