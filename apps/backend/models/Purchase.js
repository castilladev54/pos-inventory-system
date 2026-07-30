import mongoose from 'mongoose';

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
  total_cost: {
    type: Number,
    required: true
  },
  exchange_rate: {
    type: Number,
    default: null
  },
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
    type: Number,
    default: 0
  },
  payment_date: {
    type: Date
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

purchaseSchema.index({ admin_id: 1, createdAt: -1 });

export const Purchase = mongoose.model('Purchase', purchaseSchema);
