import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, ROLES } from '../models/User.js';

dotenv.config();

async function migrateRoles() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not found in .env");
    }

    await mongoose.connect(mongoUri);
    console.log("Conectado a MongoDB para la migración de roles.");

    // Update users with legacy role 'customer' to 'TENANT_OWNER'
    // and atomically increment tokenVersion to cryptographically invalidate old sessions.
    const result = await User.updateMany(
      { role: "customer" as any },
      { 
        $set: { role: ROLES.TENANT_OWNER },
        $inc: { tokenVersion: 1 }
      }
    );

    console.log(`Migración completada. Documentos modificados: ${result.modifiedCount}`);
    
  } catch (error) {
    console.error("Error durante la migración:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Desconectado de MongoDB.");
    process.exit(0);
  }
}

migrateRoles();
