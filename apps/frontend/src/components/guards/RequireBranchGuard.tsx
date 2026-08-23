import { ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Store } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export const RequireBranchGuard = ({ children }: Props) => {
  const { activeBranchId } = useAuthStore();

  if (!activeBranchId) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[60vh] p-8 border-2 border-dashed border-gray-600/50 rounded-xl bg-[#1a1a24]/50">
        <Store className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-200 mb-3">Contexto Físico Requerido</h2>
        <p className="text-gray-400 text-center max-w-md text-sm leading-relaxed">
          Para operar este módulo, debe seleccionar una sucursal. Las transacciones de inventario y caja no pueden ejecutarse en modo global.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
