import { ComponentType, InputHTMLAttributes, SVGProps } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const Input = ({ icon: Icon, ...props }: InputProps) => (
  <div className="relative mb-6">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="size-5 text-amber-500/80" />
    </div>
    <input
      {...props}
      className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 text-white placeholder-white/40 transition-all outline-none"
    />
  </div>
);

export default Input;
