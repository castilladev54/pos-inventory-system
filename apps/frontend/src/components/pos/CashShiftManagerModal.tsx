import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Check, AlertTriangle } from 'lucide-react';
import Button from '../atoms/Button';
import { useAuthStore } from '../../store/authStore';
import { useExchangeRateQuery } from '../../hooks/queries/useExchangeRateQueries';
import { 
  useCurrentCashShiftQuery, 
  useOpenCashShift, 
  useCloseCashShift 
} from '../../hooks/queries/useCashShiftQueries';
import { fmtUSD, fmtBs } from '../../utils/salesFormatters';
import toast from 'react-hot-toast';

interface CashShiftManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isImperative?: boolean;
}

const CashShiftManagerModal = ({ isOpen, onClose, isImperative = false }: CashShiftManagerModalProps) => {
  const { user, activeBranchId } = useAuthStore();
  const { data: rateData } = useExchangeRateQuery();
  const exchangeRate = rateData?.rate ?? 1;
  
  const branchId = activeBranchId ?? null;
  const userId = user?._id;

  const { data: currentShift, isLoading: isLoadingShift } = useCurrentCashShiftQuery(branchId, userId);
  
  const { mutate: openShift, isPending: isOpening } = useOpenCashShift();
  const { mutate: closeShift, isPending: isClosing } = useCloseCashShift();

  const [initialCashUSD, setInitialCashUSD] = useState<string>('');
  const [initialCashCOP, setInitialCashCOP] = useState<string>('');
  const [initialCashBS, setInitialCashBS] = useState<string>('');

  const [declaredCashUSD, setDeclaredCashUSD] = useState<string>('');
  const [declaredCashCOP, setDeclaredCashCOP] = useState<string>('');
  const [declaredCashBS, setDeclaredCashBS] = useState<string>('');
  
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleOpenShift = () => {
    if (!branchId || !userId) return;
    openShift({
      branchId,
      userId,
      payload: {
        opening_balance: (initialCashUSD || "0").replace(',', '.')
      }
    }, {
      onSuccess: () => {
        toast.success("Turno de caja abierto exitosamente");
        onClose();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Error al abrir el turno");
      }
    });
  };

  const handleCloseShift = () => {
    if (!branchId || !userId || !currentShift) return;
    if (!window.confirm("¿Estás seguro de cerrar el turno de caja actual? No podrás registrar más ventas hasta abrir uno nuevo.")) return;
    
    closeShift({
      shiftId: currentShift._id,
      branchId,
      userId,
      payload: {
        closing_balance: (declaredCashUSD || "0").replace(',', '.')
      }
    }, {
      onSuccess: () => {
        toast.success("Turno de caja cerrado exitosamente");
        onClose();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Error al cerrar el turno");
      }
    });
  };

  const renderOpenShiftForm = () => (
    <div className="space-y-4">
      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl mb-4">
        <h3 className="text-orange-400 font-semibold flex items-center gap-2">
          <AlertTriangle size={18} />
          Apertura de Caja
        </h3>
        <p className="text-sm text-gray-300 mt-1">
          Ingresa el fondo de caja inicial. Este monto se usará para dar vueltos.
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Efectivo Inicial (USD)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={initialCashUSD}
          onChange={(e) => setInitialCashUSD(e.target.value)}
          className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500"
          placeholder="0.00"
        />
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-white/10 mt-6">
        {!isImperative && (
          <Button variant="ghost" onClick={onClose} disabled={isOpening}>
            Cancelar
          </Button>
        )}
        <Button variant="primary" onClick={handleOpenShift} disabled={isOpening}>
          {isOpening ? "Abriendo..." : "Abrir Turno"}
        </Button>
      </div>
    </div>
  );

  const renderCloseShiftForm = () => {
    if (!currentShift) return null;

    const openDateStr = currentShift.opened_at || (currentShift as any).createdAt;
    const openDate = openDateStr ? new Date(openDateStr) : null;
    const dateDisplay = openDate && !isNaN(openDate.getTime()) 
      ? openDate.toLocaleString() 
      : 'Fecha no disponible';

    return (
      <div className="space-y-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl mb-4">
          <h3 className="text-emerald-400 font-semibold flex items-center gap-2">
            <Wallet size={18} />
            Turno Abierto
          </h3>
          <p className="text-sm text-gray-300 mt-1">
            Abierto el: {dateDisplay}
          </p>
        </div>

        <div className="bg-[#1a1a24] p-4 rounded-xl border border-white/5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Fondo Inicial:</span>
            <span className="text-white font-medium">{fmtUSD(Number(currentShift.opening_balance || 0))}</span>
          </div>
        </div>

        {/* Arqueo Declarado */}
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-3 mt-2">Arqueo de Caja (Declarado)</p>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Efectivo Final (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={declaredCashUSD}
              onChange={(e) => setDeclaredCashUSD(e.target.value)}
              className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div className="pt-4 flex justify-end gap-3 border-t border-white/10 mt-6">
          {!isImperative && (
            <Button variant="ghost" onClick={onClose} disabled={isClosing}>
              Cancelar
            </Button>
          )}
          <Button variant="danger" onClick={handleCloseShift} disabled={isClosing}>
            {isClosing ? "Cerrando..." : "Cerrar Turno"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-5 border-b border-white/10 bg-gradient-to-r from-white/[0.02] to-transparent">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="text-amber-500" />
              Gestión de Turno de Caja
            </h2>
            {!isImperative && (
              <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                <X size={24} />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6">
            {isLoadingShift ? (
              <div className="flex justify-center p-8 text-orange-500 animate-pulse">Cargando estado de caja...</div>
            ) : currentShift ? (
              renderCloseShiftForm()
            ) : (
              renderOpenShiftForm()
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CashShiftManagerModal;
