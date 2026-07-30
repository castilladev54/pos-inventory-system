import { LabelHTMLAttributes, ReactNode } from 'react';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  className?: string;
}

const Label = ({ children, className = '', ...props }: LabelProps) => (
  <label className={`block text-sm font-medium text-gray-300 mb-1 ${className}`} {...props}>
    {children}
  </label>
);

export default Label;
