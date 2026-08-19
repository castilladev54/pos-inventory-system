import { Schema, model, Document } from "mongoose";
import { BusinessOwnerId, BranchId, ProductId } from "../types/brands.js";
import { DecimalConfig } from "../utils/decimalConfig.js";

export interface IBranchInventory extends Document {
  owner_id: BusinessOwnerId;
  product_id: ProductId;
  branch_id: BranchId;
  stock: string;
  min_stock: string;
}

const branchInventorySchema = new Schema<IBranchInventory>(
  {
    owner_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product_id: { type: Schema.Types.ObjectId, required: true, ref: "Product" },
    branch_id: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    stock: {
      ...DecimalConfig,
      default: mongoose.Types.Decimal128.fromString('0')
    },
    min_stock: {
      ...DecimalConfig,
      default: mongoose.Types.Decimal128.fromString('0')
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
    id: false
  }
);

// Asegurarse de que no haya duplicados de producto en una misma sucursal
branchInventorySchema.index({ branch_id: 1, product_id: 1 }, { unique: true });
branchInventorySchema.index({ owner_id: 1, branch_id: 1 });

export const BranchInventory = model<IBranchInventory>("BranchInventory", branchInventorySchema);
