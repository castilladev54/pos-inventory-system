import { Schema, model, Document } from "mongoose";
import { BusinessOwnerId } from "../types/brands.js";
import { DecimalConfig, DecimalOptionalConfig } from "../utils/decimalConfig.js";

export interface IProduct extends Document {
  name: string;
  description?: string;
  barcode?: string;
  price: string;
  category: Schema.Types.ObjectId;
  unit_type: "unidad" | "kg" | "litro" | "metro";
  user: BusinessOwnerId; // Inquilino / Dueño del negocio
  max_debt_limit?: string | null; // Override del límite de deuda

  // Virtual
  totalStock?: number;
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

// Relación virtual con Inventory
productSchema.virtual('inventories', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'product_id'
});

// Virtual para el stock consolidado (requiere `.populate('inventories')`)
productSchema.virtual("totalStock").get(function (this: any) {
  if (!this.inventories) {
    return 0;
  }
  return this.inventories.reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);
});

productSchema.index({ barcode: 1, user: 1 }, { unique: true, sparse: true });
productSchema.index({ user: 1, createdAt: -1 });

export const Product = model<IProduct>("Product", productSchema);
