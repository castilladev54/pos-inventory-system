import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Check, AlertTriangle } from 'lucide-react';
import Button from '../atoms/Button';
import { useAuthStore } from '../../store/authStore';
import { useCurrencyStore } from '../../store/currencyStore';
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
}

const CashShiftManagerModal = ({ isOpen, onClose }: CashShiftManagerModalProps) => {
  const { user, activeBranchId } = useAuthStore();
  const { exchangeRate, toBs } = useCurrencyStore();
  
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
        initial_cash: {
          USD: parseFloat(initialCashUSD) || 0,
          COP: parseFloat(initialCashCOP) || 0,
          BS: parseFloat(initialCashBS) || 0,
        }
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
        declared_amounts: {
          cash: {
            USD: parseFloat(declaredCashUSD) || 0,
            COP: parseFloat(declaredCashCOP) || 0,
            BS: parseFloat(declaredCashBS) || 0,
          },
          // Por defecto asumimos que tarjetas y transferencias coinciden con el sistema a menos que se implemente conciliación completa
          card_bouchers: currentShift.system_summary.card_sales,
          transfers: currentShift.system_summary.transfer_sales,
        },
        notes
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

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Efectivo (USD)</label>
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
        <div>
          <label className="block text-xs text-gray-400 mb-1">Efectivo (COP)</label>
          <input
            type="number"
            min="0"
            step="1000"
            value={initialCashCOP}
            onChange={(e) => setInitialCashCOP(e.target.value)}
            className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Efectivo (BS)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={initialCashBS}
            onChange={(e) => setInitialCashBS(e.target.value)}
            className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-white/10 mt-6">
        <Button variant="ghost" onClick={onClose} disabled={isOpening}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleOpenShift} disabled={isOpening}>
          {isOpening ? "Abriendo..." : "Abrir Turno"}
        </Button>
      </div>
    </div>
  );

  const renderCloseShiftForm = () => {
    if (!currentShift) return null;
    const sys = currentShift.system_summary;

    return (
      <div className="space-y-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl mb-4">
          <h3 className="text-emerald-400 font-semibold flex items-center gap-2">
            <Wallet size={18} />
            Turno Abierto
          </h3>
          <p className="text-sm text-gray-300 mt-1">
            Abierto el: {new Date(currentShift.opened_at).toLocaleString()}
          </p>
        </div>

        {/* Resumen del Sistema */}
        <div className="bg-[#1a1a24] p-4 rounded-xl border border-white/5 space-y-3">
          <p className="text-sm font-semibold text-gray-300 border-b border-white/10 pb-2">Ventas del Sistema (Esperado)</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Ventas en Efectivo:</span>
            <span className="text-white font-medium">{fmtUSD(sys.cash_sales.USD)} / {fmtBs(sys.cash_sales.USD, toBs)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Esperado en Caja (con fondo):</span>
            <span className="text-emerald-400 font-bold">{fmtUSD(sys.expected_cash.USD)}</span>
          </div>
        </div>

        {/* Arqueo Declarado */}
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-3 mt-2">Arqueo de Caja (Declarado)</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Efectivo (USD)</label>
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
            <div>
              <label className="block text-xs text-gray-400 mb-1">Efectivo (COP)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={declaredCashCOP}
                onChange={(e) => setDeclaredCashCOP(e.target.value)}
                className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Efectivo (BS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={declaredCashBS}
                onChange={(e) => setDeclaredCashBS(e.target.value)}
                className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-400 mb-1">Notas de Cierre (Opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500 resize-none h-20"
            placeholder="Observaciones sobre descuadres, vales, etc."
          ></textarea>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-white/10 mt-6">
          <Button variant="ghost" onClick={onClose} disabled={isClosing}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleCloseShift} disabled={isClosing}>
            {isClosing ? "Cerrando..." : "Cerrar Turno y Guardar Arqueo"}
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
            <button onClick={onClose} className="text-gray-400 hover:text-white transition">
              <X size={24} />
            </button>
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
