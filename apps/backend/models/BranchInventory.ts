import { Schema, model, Document } from "mongoose";
import { BranchId, ProductId } from "../types/brands.js";

export interface IBranchInventory extends Document {
  product_id: ProductId;
  branch_id: BranchId;
  stock: number;
  min_stock: number;
}

const branchInventorySchema = new Schema<IBranchInventory>(
  {
    product_id: { type: Schema.Types.ObjectId, required: true, ref: "Product" },
    branch_id: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    stock: { type: Number, required: true, default: 0 },
    min_stock: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Asegurarse de que no haya duplicados de producto en una misma sucursal
branchInventorySchema.index({ product_id: 1, branch_id: 1 }, { unique: true });

export const BranchInventory = model<IBranchInventory>("BranchInventory", branchInventorySchema);
