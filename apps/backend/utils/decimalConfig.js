import Big from 'big.js';
import mongoose from 'mongoose';

export const DecimalConfig = {
  type: mongoose.Schema.Types.Decimal128,
  required: true,
  set: (v) => {
    if (v == null || v === "") return mongoose.Types.Decimal128.fromString('0');
    try {
      let raw;
      if (v instanceof mongoose.Types.Decimal128) {
        raw = v.toString();
      } else if (typeof v === 'string' || typeof v === 'number') {
        raw = v;
      } else {
        throw new Error("Tipo de dato inyectado no soportado.");
      }
      const bigVal = Big(raw);
      return mongoose.Types.Decimal128.fromString(bigVal.toString());
    } catch (error) {
      throw new Error(`[Decimal Error] Intento de guardar un valor no matemático: ${v}`);
    }
  },
  get: (v) => (v ? v.toString() : '0')
};

export const DecimalOptionalConfig = {
  ...DecimalConfig,
  required: false,
  default: null,
  set: (v) => {
    if (v == null || v === "") return null;
    try {
      let raw;
      if (v instanceof mongoose.Types.Decimal128) {
        raw = v.toString();
      } else if (typeof v === 'string' || typeof v === 'number') {
        raw = v;
      } else {
        throw new Error("Tipo de dato inyectado no soportado.");
      }
      const bigVal = Big(raw);
      return mongoose.Types.Decimal128.fromString(bigVal.toString());
    } catch (error) {
      throw new Error(`[Decimal Error] Intento de guardar un valor no matemático: ${v}`);
    }
  },
  get: (v) => (v ? v.toString() : null)
};
