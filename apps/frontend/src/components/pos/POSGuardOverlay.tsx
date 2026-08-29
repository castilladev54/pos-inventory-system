import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { useCurrentCashShiftQuery } from '../../hooks/queries/useCashShiftQueries';
import CashShiftManagerModal from './CashShiftManagerModal';
import { Loader2 } from 'lucide-react';

interface POSGuardOverlayProps {
  children: React.ReactNode;
}

const POSGuardOverlay = ({ children }: POSGuardOverlayProps) => {
  const { user, activeBranchId } = useAuthStore();
  const { data: currentShift, isLoading } = useCurrentCashShiftQuery(
    activeBranchId ?? null,
    user?._id
  );

  return (
    <>
      {/* Siempre renderizamos los children (el POS) para no perder el estado del carrito al montar/desmontar */}
      {children}

      {/* Si está cargando el estado de la caja, bloqueamos la UI con un loader */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
          <p className="text-white font-medium">Verificando turno de caja...</p>
        </div>
      )}

      {/* Si NO está cargando y NO hay turno, mostramos el modal imperativo */}
      {!isLoading && !currentShift && (
        <CashShiftManagerModal
          isOpen={true}
          onClose={() => {}} // No-op, el modal es imperativo
          isImperative={true}
        />
      )}
    </>
  );
};

export default POSGuardOverlay;
