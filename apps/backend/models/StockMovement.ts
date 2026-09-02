import mongoose, { Schema, model, Document, Types } from "mongoose";
import { DecimalConfig } from "../utils/decimalConfig.js";

export enum StockMovementType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  RETURN = 'RETURN'
}

export interface IStockMovement extends Document {
  _id: Types.ObjectId;
  inventory_id: Types.ObjectId;
  product_id: Types.ObjectId;
  branch_id: Types.ObjectId;
  owner_id: Types.ObjectId;
  type: StockMovementType;
  quantity_change: mongoose.Types.Decimal128; // Positivo para entradas, negativo para salidas
  previous_quantity: mongoose.Types.Decimal128;
  new_quantity: mongoose.Types.Decimal128;
  reference_id?: Types.ObjectId; // ID de Sale, Purchase o Transfer
  created_by: Types.ObjectId;
  reason?: string;
  idempotency_key?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    inventory_id: { type: Schema.Types.ObjectId, required: true, ref: "Inventory" },
    product_id: { type: Schema.Types.ObjectId, required: true, ref: "Product" },
    branch_id: { type: Schema.Types.ObjectId, required: true, ref: "Branch" },
    owner_id: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    type: {
      type: String,
      enum: Object.values(StockMovementType),
      required: true
    },
    quantity_change: { ...DecimalConfig, required: true } as any,
    previous_quantity: { ...DecimalConfig, required: true } as any,
    new_quantity: { ...DecimalConfig, required: true } as any,
    reference_id: { type: Schema.Types.ObjectId },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    reason: { type: String },
    idempotency_key: { type: String, sparse: true, unique: true }
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
    id: false
  }
);

// Índice compuesto para consultas eficientes de Kárdex o Event Sourcing por sucursal/producto
stockMovementSchema.index({ branch_id: 1, product_id: 1, createdAt: -1 });
stockMovementSchema.index({ owner_id: 1, createdAt: -1 });

export const StockMovement = model<IStockMovement>("StockMovement", stockMovementSchema);
