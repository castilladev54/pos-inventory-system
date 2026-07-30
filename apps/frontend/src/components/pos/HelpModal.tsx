import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

/* ── Datos estáticos de atajos ─────────────────────────── */
const SHORTCUTS_GENERAL = [
  ['F1', 'Mostrar / ocultar esta ayuda'],
  ['F2', 'Nueva venta'],
  ['Esc', 'Cerrar formulario / vista de detalle'],
];
const SHORTCUTS_FORM = [
  ['F3 ó /', 'Enfocar buscador de productos'],
  ['F4', 'Abrir carrito de compras'],
  ['F9', 'Confirmar / Procesar venta'],
  ['F5', 'Ciclar método de pago'],
  ['F6', 'Abrir escáner de cámara'],
  ['F8', 'Vaciar carrito (con confirmación)'],
  ['+', 'Aumentar cantidad del último ítem'],
  ['−', 'Disminuir cantidad del último ítem'],
];

/* ── Átomo interno: lista de atajos ───────────────────── */
interface ShortcutListProps {
  items: string[][];
  keyClass: string;
}

const ShortcutList = ({ items, keyClass }: ShortcutListProps) => (
  <ul className="space-y-2">
    {items.map(([key, desc]) => (
      <li key={key} className="flex items-center justify-between text-sm">
        <span className="text-gray-300">{desc}</span>
        <kbd className={`px-2 py-1 text-xs font-mono font-semibold rounded-md ${keyClass}`}>{key}</kbd>
      </li>
    ))}
  </ul>
);

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * HelpModal — Modal de atajos de teclado (se abre con F1).
 */
const HelpModal = ({ isOpen, onClose }: HelpModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.aside
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
        >
          <header className="flex items-center justify-between p-5 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-2">
              <Keyboard size={22} className="text-orange-500" aria-hidden="true" />
              <h3 id="help-modal-title" className="text-lg font-bold text-white">Atajos de Teclado</h3>
            </div>
            <button onClick={onClose} aria-label="Cerrar ayuda" className="p-1 text-gray-400 hover:text-white transition">
              <X size={22} />
            </button>
          </header>

          <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
            <section>
              <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">General</h4>
              <ShortcutList items={SHORTCUTS_GENERAL} keyClass="text-orange-400 bg-orange-500/10 border border-orange-500/20" />
            </section>
            <section>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Formulario de Venta</h4>
              <ShortcutList items={SHORTCUTS_FORM} keyClass="text-blue-400 bg-blue-500/10 border border-blue-500/20" />
            </section>
            <section>
              <h4 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">Escáner Físico</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                El sistema detecta automáticamente escáneres USB / Bluetooth. Solo apunta y escanea — el producto se añade al carrito al instante.
              </p>
            </section>
          </div>

          <footer className="p-4 border-t border-white/5 bg-black/20 text-center">
            <p className="text-xs text-gray-500">
              Presiona <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-black/40 border border-white/10 rounded">F1</kbd> o{' '}
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-black/40 border border-white/10 rounded">Esc</kbd> para cerrar
            </p>
          </footer>
        </motion.aside>
      </div>
    )}
  </AnimatePresence>
);

export default HelpModal;
