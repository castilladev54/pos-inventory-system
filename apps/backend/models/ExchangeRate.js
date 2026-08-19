import mongoose from 'mongoose';
import { DecimalConfig } from '../utils/decimalConfig.js';

const exchangeRateSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rate: DecimalConfig,
  date: {
    type: Date,
    required: true
  },
  is_manual_override: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true },
  id: false
});

// Garantizar que solo haya una tasa registrada por día para cada negocio
exchangeRateSchema.index({ customer_id: 1, date: 1 }, { unique: true });

export const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema);
