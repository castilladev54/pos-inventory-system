import { create } from 'zustand';
import toast from 'react-hot-toast';
import { ProductId } from '@inventory/shared';
import { itemSubtotal } from '../utils/salesFormatters';
import Big from 'big.js';

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
  quantity: string;
  unit_price: string;
  maxStock: string;
  unit_type: 'unidad' | 'kg' | 'litro' | 'metro';
}

/** Subconjunto de datos del producto necesario para agregar al carrito */
export interface AddableProduct {
  _id: ProductId;
  name: string;
  price: number | string;
  stock: number | string;
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
  addItem: (product: AddableProduct, quantity?: string | number) => void;
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

  currentTotal: () => get().items.reduce((acc, item) => {
    try {
      const qty = new Big(item.quantity || "0");
      const price = new Big(item.unit_price || "0");
      return acc + qty.times(price).toNumber();
    } catch {
      return acc;
    }
  }, 0),

  addItem: (product, quantity = "1") => {
    const pStock = new Big(product.stock || "0");
    if (pStock.lte(0)) {
      toast.error(`${product.name} no tiene stock`);
      return;
    }

    set((state) => {
      const idx = state.items.findIndex((i) => i.product_id === product._id);
      const qtyToAdd = new Big(quantity);

      if (idx >= 0) {
        const existing = state.items[idx];
        if (!existing) return state;

        const newQty = new Big(existing.quantity).plus(qtyToAdd);
        if (newQty.gt(pStock)) {
          setTimeout(() => toast.error(`Sin más stock de ${product.name}`), 0);
          return state;
        }
        return {
          items: state.items.map((item, i) =>
            i === idx ? { ...item, quantity: newQty.toString() } : item
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
            quantity: qtyToAdd.toString(),
            unit_price: String(product.price),
            maxStock: String(product.stock),
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
    let qty: Big;
    try {
      qty = new Big(value || "0");
      if (qty.lt(0)) return;
    } catch {
      if (String(value) !== '') return;
      qty = new Big(0);
    }

    set((state) => {
      const item = state.items[index];
      if (!item) return state;
      const mStock = new Big(item.maxStock || "0");
      if (qty.gt(mStock)) {
        toast.error(`Máximo stock: ${item.maxStock}`);
        return state;
      }
      return {
        items: state.items.map((it, i) =>
          i === index ? { ...it, quantity: String(value) } : it
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

      try {
        const currentQty = new Big(last.quantity || "0");
        const newQty = currentQty.plus(delta);
        const mStock = new Big(last.maxStock || "0");

        if (newQty.lte(0)) {
          return { items: state.items.filter((_, i) => i !== lastIdx) };
        }
        if (newQty.gt(mStock)) {
          toast.error(`Stock máx: ${last.maxStock}`);
          return state;
        }
        return {
          items: state.items.map((item, i) =>
            i === lastIdx ? { ...item, quantity: newQty.toString() } : item
          ),
        };
      } catch (e) {
        console.error(e);
        return state;
      }
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
