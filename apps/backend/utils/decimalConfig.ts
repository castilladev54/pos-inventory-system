import Big from 'big.js';
import mongoose from 'mongoose';

interface DecimalOptions {
  required?: boolean;
  default?: mongoose.Types.Decimal128 | string | number | null;
}

export const createDecimalConfig = (options: DecimalOptions = { required: true }) => {
  const isRequired = options.required ?? true;

  return {
    type: mongoose.Schema.Types.Decimal128,
    required: isRequired,
    default: options.default,
    
    // Eliminamos la mutación silenciosa (ceros mágicos).
    // Si llega null/falsy, se devuelve null. Si la propiedad es required: true,
    // el validador nativo de Mongoose bloqueará el guardado y lanzará la excepción.
    set: (v: mongoose.Types.Decimal128 | string | number | null | undefined) => {
      if (v == null || v === "") {
        return null;
      }
      
      // Uniformamos usando Big.js y convertimos de vuelta a Decimal128 seguro
      return mongoose.Types.Decimal128.fromString(Big(v.toString()).toString());
    },
    
    // Tipado Estricto (Cero any): Unión exacta desde BD.
    // Tampoco inyectamos ceros al recuperar; si la DB no lo tiene, es honestamente null.
    get: (v: mongoose.Types.Decimal128 | null | undefined): string | null => {
      if (!v) {
        return null;
      }
      return v.toString();
    }
  };
};

export const DecimalConfig = createDecimalConfig({ required: true });
export const DecimalOptionalConfig = createDecimalConfig({ required: false, default: null });
