import { Schema, model, Document } from "mongoose";
import { BusinessOwnerId } from "../types/brands.js";

export interface IProduct extends Document {
  name: string;
  description?: string;
  barcode?: string;
  price: number;
  category: Schema.Types.ObjectId;
  unit_type: "unidad" | "kg" | "litro" | "metro";
  user: BusinessOwnerId; // Inquilino / Dueño del negocio

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
    price: {
      type: Number,
      required: true,
    },
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Relación virtual con BranchInventory
productSchema.virtual('branchInventories', {
  ref: 'BranchInventory',
  localField: '_id',
  foreignField: 'product_id'
});

// Virtual para el stock consolidado (requiere `.populate('branchInventories')`)
productSchema.virtual("totalStock").get(function (this: any) {
  if (!this.branchInventories) {
    return 0;
  }
  return this.branchInventories.reduce((acc: number, curr: any) => acc + (curr.stock || 0), 0);
});

productSchema.index({ barcode: 1, user: 1 }, { unique: true, sparse: true });
productSchema.index({ user: 1, createdAt: -1 });

export const Product = model<IProduct>("Product", productSchema);
