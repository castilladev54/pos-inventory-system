import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import Button from '../atoms/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  message: string;
  detail?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ConfirmDialog = ({
  isOpen,
  message,
  detail,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={onCancel}
          aria-hidden="true"
        />
        <motion.dialog
          key="dialog"
          open
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 m-auto w-full max-w-sm h-fit bg-[#1a1a24] border border-white/10 rounded-2xl p-6 shadow-2xl"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={detail ? 'confirm-dialog-detail' : undefined}
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p id="confirm-dialog-title" className="text-white font-semibold text-base">{message}</p>
              {detail && <p id="confirm-dialog-detail" className="text-gray-400 text-sm mt-1">{detail}</p>}
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={isLoading}>{cancelLabel}</Button>
              <Button variant="danger" className="flex-1" onClick={onConfirm} isLoading={isLoading}>{confirmLabel}</Button>
            </div>
          </div>
        </motion.dialog>
      </>
    )}
  </AnimatePresence>
);

export default ConfirmDialog;
