import mongoose, { Document, Schema, Types } from "mongoose";

// 1. Interfaz que define la estructura del documento en TS
export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'customer' | 'employee';
  owner_id?: Types.ObjectId | null;
  permissions: string[];
  assigned_branches: Types.ObjectId[];
  av_inventory_cost: number;
  lastLogin: Date;
  resetPasswordToken?: string;
  resetPasswordExpiresAt?: Date;
  subscriptionExpiresAt?: Date;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Definición del Schema
const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'customer', 'employee'],
    required: true,
    default: 'customer'
  },
  owner_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  permissions: {
    type: [String],
    default: []
  },
  // Sucursales a las que este empleado tiene acceso autorizado.
  // FUENTE DE VERDAD: solo el dueño puede modificar este array.
  // El backend lo lee de la DB en cada request — jamás del cliente.
  assigned_branches: {
    type: [Schema.Types.ObjectId],
    ref: 'Branch',
    default: []
  },
  av_inventory_cost: {
    type: Number,
    default: 0
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  resetPasswordToken: String,
  resetPasswordExpiresAt: Date,
  subscriptionExpiresAt: {
    type: Date
  },
  // Versión del token activo. Se incrementa en cada login y al revocar acceso.
  // verifyToken lo compara contra Redis (key tokenVersion:<userId>) para
  // invalidar tokens viejos sin usar una blacklist por userId.
  tokenVersion: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// 3. Exportación del modelo tipado
export const User = mongoose.model<IUser>('User', userSchema);
