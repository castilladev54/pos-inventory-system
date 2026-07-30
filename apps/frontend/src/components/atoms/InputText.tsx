import { forwardRef, InputHTMLAttributes } from 'react';

interface InputTextProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const InputText = forwardRef<HTMLInputElement, InputTextProps>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition ${className}`}
    {...props}
  />
));
InputText.displayName = 'InputText';
export default InputText;
