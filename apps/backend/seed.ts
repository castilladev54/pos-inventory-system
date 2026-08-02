import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";
import { User } from "./models/User.js";
import { Branch } from "./models/Branch.js";

dotenv.config();

const seed = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not found in .env");
    }

    await mongoose.connect(mongoUri);
    console.log("Conectado a MongoDB");

    // Limpiar si ya existe para evitar errores de duplicidad (opcional)
    const existingAdmin = await User.findOne({ email: "admin@example.com" });
    if (existingAdmin) {
      console.log("El usuario admin@example.com ya existe. Lo eliminaremos para recrearlo.");
      await User.deleteOne({ email: "admin@example.com" });
      await Branch.deleteMany({ owner_id: existingAdmin._id });
    }

    // Hashear la contraseña
    const hashedPassword = await bcryptjs.hash("admin123", 10);

    // Crear el usuario administrador
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 365); // 1 año de suscripción para probar

    const adminUser = new User({
      email: "admin@example.com",
      password: hashedPassword,
      name: "Administrador Principal",
      role: "admin",
      subscriptionExpiresAt: expireDate
    });

    await adminUser.save();
    console.log(`✅ Usuario administrador creado: ${adminUser.email} / admin123`);

    // Crear sucursales asignadas a este administrador
    const branch1 = new Branch({
      name: "Sucursal Principal - Centro",
      address: "Av. Siempre Viva 123",
      phone: "+584141234567",
      is_active: true,
      owner_id: adminUser._id
    });

    const branch2 = new Branch({
      name: "Sucursal Norte",
      address: "C.C. El Recreo, Nivel C2",
      phone: "+584241234567",
      is_active: true,
      owner_id: adminUser._id
    });

    await branch1.save();
    await branch2.save();
    console.log(`✅ Sucursales creadas: ${branch1.name}, ${branch2.name}`);

    // (Opcional) si un admin también necesita tener las sucursales en su array de assigned_branches
    // Aunque usualmente `assigned_branches` es para empleados, lo agregamos por si acaso
    adminUser.assigned_branches = [branch1._id, branch2._id];
    await adminUser.save();

    console.log("🎉 Seed finalizado con éxito!");
    process.exit(0);

  } catch (error) {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  }
};

seed();
