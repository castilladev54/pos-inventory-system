import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ElementType } from 'react';
import Label from '../atoms/Label';

interface FormFieldBaseProps {
  label?: string;
  error?: string;
  required?: boolean;
  as?: 'input' | 'textarea' | ElementType;
  className?: string;
  rows?: number;
}

// Combinamos las propiedades para soportar tanto input como textarea
type FormFieldProps = FormFieldBaseProps & 
  InputHTMLAttributes<HTMLInputElement> & 
  TextareaHTMLAttributes<HTMLTextAreaElement>;

const baseInputClass =
  'w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition';

const FormField = forwardRef<HTMLInputElement | HTMLTextAreaElement, FormFieldProps>(
  ({ label, error, required = false, as: Tag = 'input', className = '', rows = 3, ...rest }, ref) => {
    // Para evitar advertencias de React sobre pasar propiedades incorrectas
    // extraemos id y name para el label y la asociación aria
    const id = rest.id || rest.name;

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label && (
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-orange-500 ml-0.5" aria-hidden="true">*</span>}
          </Label>
        )}

        {Tag === 'textarea' ? (
          <textarea
            ref={ref as any}
            id={id}
            rows={rows}
            aria-invalid={!!error}
            aria-describedby={error ? `${rest.name}-error` : undefined}
            className={`${baseInputClass} ${error ? 'border-red-500/50 focus:ring-red-500/30' : ''}`}
            {...(rest as any)}
          />
        ) : (
          <input
            ref={ref as any}
            id={id}
            aria-invalid={!!error}
            aria-describedby={error ? `${rest.name}-error` : undefined}
            className={`${baseInputClass} ${error ? 'border-red-500/50 focus:ring-red-500/30' : ''}`}
            {...(rest as any)}
          />
        )}

        {error && (
          <p id={`${rest.name}-error`} role="alert" className="text-red-400 text-xs mt-0.5">
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
export default FormField;
