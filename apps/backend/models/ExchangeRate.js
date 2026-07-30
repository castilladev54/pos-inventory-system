import mongoose from 'mongoose';

const exchangeRateSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0.01
  },
  date: {
    type: Date,
    required: true
  }
}, { timestamps: true });

// Garantizar que solo haya una tasa registrada por día para cada negocio
exchangeRateSchema.index({ customer_id: 1, date: 1 }, { unique: true });

export const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema);
