import { Schema, model, Document } from "mongoose";
import { BusinessOwnerId } from "../types/brands.js";

export interface IBranch extends Document {
  name: string;
  address: string;
  phone?: string;
  is_active: boolean;
  owner_id: BusinessOwnerId;
  max_debt_limit: number;
}

const branchSchema = new Schema<IBranch>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String },
    is_active: { type: Boolean, default: true },
    owner_id: { type: Schema.Types.ObjectId, required: true },
    max_debt_limit: { type: Number, default: -20 },
  },
  {
    timestamps: true,
  }
);

export const Branch = model<IBranch>("Branch", branchSchema);
