import jwt from "jsonwebtoken";
import type { IUser } from "../models/User.js";
import type { Types } from "mongoose";

type PopulatedUser = Omit<IUser, '_id' | 'owner_id' | 'assigned_branches'> & {
  _id: Types.ObjectId;
  owner_id?: Types.ObjectId | null;
  assigned_branches?: Types.ObjectId[];
};

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) {
  throw new Error("CRITICAL: JWT_REFRESH_SECRET is not defined in environment variables.");
}

/**
 * Genera un Access Token JWT (corta duración).
 */
export const generateAccessToken = (user: PopulatedUser) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      tokenVersion: user.tokenVersion || 0,
      role: user.role,
      permissions: user.permissions || [],
      ownerId: user.owner_id ? user.owner_id.toString() : null,
      assignedBranches: (user.assigned_branches || []).map((id) => id.toString()),
    },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "15m", // Corta duración para seguridad
    }
  );
};

/**
 * Genera un Refresh Token JWT (larga duración, solo sirve para obtener un nuevo Access Token).
 */
export const generateRefreshToken = (user: PopulatedUser) => {
  return jwt.sign(
    {
      userId: user._id.toString()
    },
    JWT_REFRESH_SECRET, // Se utiliza la variable verificada sin fallback
    {
      expiresIn: "7d",
    }
  );
};
