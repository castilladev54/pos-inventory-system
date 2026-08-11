import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICustomer extends Document {
  name: string;
  email?: string;
  phone?: string;
  document_id?: string; // RUT, DNI, etc.
  address?: string;
  businessOwnerId: Types.ObjectId; // Aislamiento de Tenant
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    document_id: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
    },
    businessOwnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure that a customer document_id or email might be unique per tenant if needed.
// customerSchema.index({ businessOwnerId: 1, document_id: 1 }, { unique: true, partialFilterExpression: { document_id: { $exists: true } } });

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
