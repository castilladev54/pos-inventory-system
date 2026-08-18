import { ReactNode } from 'react';
import { useExchangeRateQuery } from '../../hooks/queries/useExchangeRateQueries';
import ExchangeRateBar from './ExchangeRateBar';
import Button from '../atoms/Button';
import { RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react';

interface RateGuardProps {
  children: ReactNode;
}

export const RateGuard = ({ children }: RateGuardProps) => {
  const { data, isLoading, isError, refetch } = useExchangeRateQuery();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center">
        <RefreshCw className="animate-spin text-blue-500 mb-4" size={48} />
        <h2 className="text-xl text-white font-bold">Sincronizando tasa BCV...</h2>
        <p className="text-gray-400 mt-2">Por favor espere.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center">
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl text-white font-bold mb-2">Error de Conexión</h2>
        <p className="text-gray-400 mb-6">No se pudo obtener la tasa de cambio del servidor.</p>
        <Button onClick={() => refetch()} variant="primary">
          Reintentar Conexión
        </Button>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center">
        <AlertCircle className="text-yellow-500 mb-4" size={48} />
        <h2 className="text-xl text-white font-bold mb-2">Tasa de Cambio Ausente</h2>
        <p className="text-gray-400 mb-8 max-w-md text-center">
          No hay una tasa de cambio registrada para hoy. Establezca una manualmente para continuar.
        </p>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <ExchangeRateBar />
        </div>
      </div>
    );
  }

  // Renderizado Condicional Estricto: Si llegamos aquí, data no es nulo, la tasa existe.
  return <>{children}</>;
};
