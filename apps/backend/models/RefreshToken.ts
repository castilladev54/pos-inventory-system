import mongoose, { Document, Schema } from 'mongoose';

export interface IRefreshToken extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  familyId: string;
  isRevoked: boolean;
  expiresAt: Date;
  replacedAt?: Date;
  replacedByToken?: string;
}

const refreshTokenSchema = new Schema<IRefreshToken>({
  token: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  familyId: { type: String, required: true }, // To track token rotation families
  isRevoked: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL index to auto-delete
  replacedAt: { type: Date, default: null },         // Cuándo fue rotado (ventana de gracia)
  replacedByToken: { type: String, default: null },  // Token hijo que lo reemplazó
}, { timestamps: true });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
