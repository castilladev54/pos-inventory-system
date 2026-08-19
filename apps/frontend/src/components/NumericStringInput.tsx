import React from 'react';

interface NumericStringInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChangeString: (val: string) => void;
}

/**
 * Componente controlado que intercepta el teclado y previene la coerción a `number`.
 * Obligatorio usar inputMode="decimal" y pattern para accesibilidad en móviles (Punto de Venta).
 */
export const NumericStringInput: React.FC<NumericStringInputProps> = ({ 
  value, 
  onChangeString, 
  ...props 
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Regex permisivo durante la escritura: permite números, un guion inicial y un solo punto decimal.
    // Esto asegura que "10." o "-0." no bloqueen la escritura, pero impide "10.5.2" o "abc".
    if (/^-?\d*\.?\d*$/.test(val)) {
      onChangeString(val);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="-?\d*(\.\d+)?"
      value={value}
      onChange={handleChange}
      className={`border rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${props.className || ''}`}
      {...props}
    />
  );
};
