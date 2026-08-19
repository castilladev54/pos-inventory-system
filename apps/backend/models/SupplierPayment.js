import mongoose from 'mongoose';
import { DecimalConfig } from '../utils/decimalConfig.js';

const supplierPaymentSchema = new mongoose.Schema({
  purchase_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: DecimalConfig,
  date: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true },
  id: false
});

supplierPaymentSchema.index({ admin_id: 1, date: -1 });

export const SupplierPayment = mongoose.model('SupplierPayment', supplierPaymentSchema);
