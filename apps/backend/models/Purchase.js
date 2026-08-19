import mongoose from 'mongoose';
import { DecimalConfig, DecimalOptionalConfig } from '../utils/decimalConfig.js';

const purchaseSchema = new mongoose.Schema({
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  supplier: {
    type: String,
    required: true
  },
  total_cost: DecimalConfig,
  exchange_rate: DecimalOptionalConfig,
  status: {
    type: String,
    enum: ['PENDING', 'PARTIAL', 'PAID'],
    default: 'PENDING'
  },
  due_date: {
    type: Date,
    required: true
  },
  paid_amount: {
    ...DecimalConfig,
    default: mongoose.Types.Decimal128.fromString('0')
  },
  payment_date: {
    type: Date
  },
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

purchaseSchema.index({ admin_id: 1, createdAt: -1 });

export const Purchase = mongoose.model('Purchase', purchaseSchema);
