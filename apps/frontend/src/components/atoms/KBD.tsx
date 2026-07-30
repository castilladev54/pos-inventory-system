import { ReactNode } from 'react';

interface KBDProps { children: ReactNode; }

const KBD = ({ children }: KBDProps) => (
  <kbd className="ml-1.5 hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-400 bg-black/40 border border-white/10 rounded-md leading-none">
    {children}
  </kbd>
);

export default KBD;
