import { forwardRef, TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition resize-none ${className}`}
    {...props}
  />
));
TextArea.displayName = 'TextArea';
export default TextArea;
