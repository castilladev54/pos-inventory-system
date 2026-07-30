import { create } from 'zustand';
import toast from 'react-hot-toast';
import { ProductId } from '@inventory/shared';
import { itemSubtotal } from '../utils/salesFormatters';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type PaymentMethodLabel =
  | 'Efectivo'
  | 'Divisas'
  | 'Tarjeta'
  | 'Pago Movil'
  | 'Transferencia'
  | 'Zelle';

export interface CartItem {
  product_id: ProductId;
  name: string;
  quantity: number;
  unit_price: number;
  maxStock: number;
  unit_type: 'unidad' | 'kg' | 'litro' | 'metro';
}

/** Subconjunto de datos del producto necesario para agregar al carrito */
export interface AddableProduct {
  _id: ProductId;
  name: string;
  price: number;
  stock: number;
  unit_type?: 'unidad' | 'kg' | 'litro' | 'metro';
}

const PAYMENT_METHODS: PaymentMethodLabel[] = [
  'Efectivo', 'Divisas', 'Tarjeta', 'Pago Movil', 'Transferencia', 'Zelle',
];

// ─── Store Interface ─────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  paymentMethod: PaymentMethodLabel;
  cartPulse: boolean;

  // Getters calculados
  currentTotal: () => number;

  // Actions
  addItem: (product: AddableProduct, quantity?: number) => void;
  changeQty: (index: number, value: string | number) => void;
  removeItem: (index: number) => void;
  cyclePaymentMethod: () => void;
  clearCart: (force?: boolean) => void;
  modifyLastItemQty: (delta: number) => void;
  resetCart: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  paymentMethod: 'Efectivo',
  cartPulse: false,

  currentTotal: () => get().items.reduce((acc, item) => acc + itemSubtotal(item), 0),

  addItem: (product, quantity = 1) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} no tiene stock`);
      return;
    }

    set((state) => {
      const idx = state.items.findIndex((i) => i.product_id === product._id);

      if (idx >= 0) {
        const existing = state.items[idx];
        if (!existing) return state;

        if (existing.quantity + quantity > product.stock) {
          setTimeout(() => toast.error(`Sin más stock de ${product.name}`), 0);
          return state;
        }
        return {
          items: state.items.map((item, i) =>
            i === idx ? { ...item, quantity: item.quantity + quantity } : item
          ),
          cartPulse: true,
        };
      }

      return {
        items: [
          ...state.items,
          {
            product_id: product._id,
            name: product.name,
            quantity,
            unit_price: product.price,
            maxStock: product.stock,
            unit_type: product.unit_type ?? 'unidad',
          },
        ],
        cartPulse: true,
      };
    });

    // Apagar el pulso visual tras 300ms
    setTimeout(() => set({ cartPulse: false }), 300);
  },

  changeQty: (index, value) => {
    const qty = parseFloat(String(value));
    if (String(value) !== '' && (isNaN(qty) || qty < 0)) return;

    set((state) => {
      const item = state.items[index];
      if (!item) return state;
      if (qty > item.maxStock) {
        toast.error(`Máximo stock: ${item.maxStock}`);
        return state;
      }
      return {
        items: state.items.map((it, i) =>
          i === index ? { ...it, quantity: value as number } : it
        ),
      };
    });
  },

  removeItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index) })),

  cyclePaymentMethod: () =>
    set((state) => {
      const next =
        PAYMENT_METHODS[(PAYMENT_METHODS.indexOf(state.paymentMethod) + 1) % PAYMENT_METHODS.length]
        ?? 'Efectivo';
      toast.success(`Método: ${next}`, { duration: 1200, icon: '💳' });
      return { paymentMethod: next };
    }),

  clearCart: (force = false) => {
    if (get().items.length === 0) return;
    if (!force && !window.confirm('¿Vaciar todo el carrito?')) return;
    set({ items: [] });
    if (!force) toast.success('Carrito vaciado', { icon: '🗑️' });
  },

  modifyLastItemQty: (delta) => {
    set((state) => {
      if (state.items.length === 0) return state;
      const lastIdx = state.items.length - 1;
      const last = state.items[lastIdx];
      if (!last) return state;

      const newQty = (parseFloat(String(last.quantity)) || 0) + delta;

      if (newQty <= 0) {
        return { items: state.items.filter((_, i) => i !== lastIdx) };
      }
      if (newQty > last.maxStock) {
        toast.error(`Stock máx: ${last.maxStock}`);
        return state;
      }
      return {
        items: state.items.map((item, i) =>
          i === lastIdx ? { ...item, quantity: newQty } : item
        ),
      };
    });
  },

  resetCart: () => set({ items: [], paymentMethod: 'Efectivo', cartPulse: false }),
}));

// ─── Listeners externos ──────────────────────────────────────────────────────

/**
 * Al cambiar de sucursal, el authStore emite el evento 'branch-changed'.
 * Este listener vacía el carrito de forma forzada (sin confirmación del usuario)
 * para evitar mezclar inventario de distintas sucursales en una misma venta.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('branch-changed', () => {
    useCartStore.getState().clearCart(true);
    toast('Sucursal cambiada — carrito vaciado', { icon: '🏪', duration: 2500 });
  });
}
