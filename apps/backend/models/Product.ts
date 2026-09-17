import mongoose, { Schema, model, Document, Types } from "mongoose";
import { BusinessOwnerId, CategoryId, ProductId } from "../types/brands.js";
import { DecimalConfig, DecimalOptionalConfig } from "../utils/decimalConfig.js";

export interface IProduct extends Document {
  _id: ProductId;
  name: string;
  description?: string;
  barcode?: string;
  price: mongoose.Types.Decimal128;
  category: CategoryId;
  unit_type: "unidad" | "kg" | "litro" | "metro";
  user: BusinessOwnerId; // Inquilino / Dueño del negocio
  max_debt_limit?: mongoose.Types.Decimal128 | null; // Override del límite de deuda
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    barcode: {
      type: String,
      trim: true,
    },
    price: DecimalConfig,
    // El campo stock global ha sido eliminado
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    unit_type: {
      type: String,
      enum: ["unidad", "kg", "litro", "metro"],
      default: "unidad",
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    max_debt_limit: DecimalOptionalConfig,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
    id: false
  }
);


productSchema.index({ barcode: 1, user: 1 }, { unique: true, sparse: true });
productSchema.index({ user: 1, createdAt: -1 });

export const Product = model<IProduct>("Product", productSchema);
