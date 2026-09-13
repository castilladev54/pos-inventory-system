import { useState, useCallback, useMemo, useRef, useEffect, useReducer } from "react";
import toast from "react-hot-toast";
import Big from "big.js";
import type { Product, ProductId, UnitType } from "@inventory/shared";

const PAYMENT_METHODS = ["Efectivo", "Divisas", "Tarjeta", "Pago Movil", "Transferencia", "Zelle"];

export interface POSCartItem {
  product_id: ProductId;
  name: string;
  quantity: string;
  unit_price: string;
  maxStock: string;
  unit_type?: UnitType;
  discount?: string;
}

export type CartError =
  | { id: string; code: "INSUFFICIENT_STOCK"; productId: ProductId }
  | { id: string; code: "INVALID_QUANTITY"; productId: ProductId }
  | { id: string; code: "INVALID_NUMERIC_VALUE"; productId?: ProductId };

export interface CartState {
  items: POSCartItem[];
  error: CartError | null;
}

export type CartAction =
  | { type: 'ADD_ITEM'; product: Product; quantity: string | number; maxStockStr: string; operationId: string }
  | { type: 'CHANGE_ITEM_QTY'; index: number; quantity: string; operationId: string }
  | { type: 'REMOVE_ITEM'; index: number }
  | { type: 'MODIFY_LAST_ITEM_QTY'; delta: number; operationId: string }
  | { type: 'CLEAR_CART' }
  | { type: 'RESET_CART' };

function parseBig(val: string | number | undefined): Big | null {
  if (val === "" || val == null) return null;
  try {
    return new Big(val);
  } catch {
    return null;
  }
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity, maxStockStr, operationId } = action;
      
      const maxStock = parseBig(maxStockStr || "0");
      const qtyToAdd = parseBig(quantity);

      if (!maxStock || !qtyToAdd) {
        return { ...state, error: { id: operationId, code: "INVALID_NUMERIC_VALUE", productId: product._id } };
      }

      if (qtyToAdd.lte(0)) {
        return { 
          ...state, 
          error: { id: operationId, code: "INVALID_QUANTITY", productId: product._id } 
        };
      }

      const idx = state.items.findIndex((i) => i.product_id === product._id);
      if (idx >= 0) {
        const item = state.items[idx];
        if (!item) return state;
        const currentQty = parseBig(item.quantity);
        if (!currentQty) {
          return { ...state, error: { id: operationId, code: "INVALID_NUMERIC_VALUE", productId: product._id } };
        }
        const newQty = currentQty.plus(qtyToAdd);
        if (newQty.gt(maxStock)) {
          return { ...state, error: { id: operationId, code: "INSUFFICIENT_STOCK", productId: product._id } };
        }
        const nextItems = state.items.map((it, i) =>
          i === idx ? { ...it, quantity: newQty.toString() } : it
        );
        return { ...state, items: nextItems, error: null };
      }

      if (qtyToAdd.gt(maxStock)) {
        return { ...state, error: { id: operationId, code: "INSUFFICIENT_STOCK", productId: product._id } };
      }

      const newItem: POSCartItem = {
        product_id: product._id,
        name: product.name,
        quantity: qtyToAdd.toString(),
        unit_price: String(product.price),
        maxStock: maxStockStr,
        unit_type: product.unit_type || "unidad",
      };
      return { ...state, items: [...state.items, newItem], error: null };
    }
    
    case 'CHANGE_ITEM_QTY': {
      const { index, quantity, operationId } = action;
      const item = state.items[index];
      if (!item) return state;

      if (quantity === "") {
        const nextItems = state.items.map((it, i) => i === index ? { ...it, quantity: "" } : it);
        return { ...state, items: nextItems, error: null };
      }

      const qty = parseBig(quantity);
      if (!qty) {
        return { ...state, error: { id: operationId, code: "INVALID_NUMERIC_VALUE", productId: item.product_id } };
      }

      if (qty.lt(0)) {
        return { ...state, error: { id: operationId, code: "INVALID_QUANTITY", productId: item.product_id } };
      }

      const maxStock = parseBig(item.maxStock);
      if (!maxStock) {
        return { ...state, error: { id: operationId, code: "INVALID_NUMERIC_VALUE", productId: item.product_id } };
      }

      if (qty.gt(maxStock)) {
        return { ...state, error: { id: operationId, code: "INSUFFICIENT_STOCK", productId: item.product_id } };
      }

      const nextItems = state.items.map((it, i) => i === index ? { ...it, quantity } : it);
      return { ...state, items: nextItems, error: null };
    }

    case 'REMOVE_ITEM': {
      return { ...state, items: state.items.filter((_, i) => i !== action.index), error: null };
    }

    case 'MODIFY_LAST_ITEM_QTY': {
      const { delta, operationId } = action;
      if (state.items.length === 0) return state;
      
      const last = state.items.length - 1;
      const item = state.items[last];
    if (!item) return state;
      
      const currentQty = parseBig(item.quantity);
      const maxStock = parseBig(item.maxStock);
      const deltaBig = parseBig(delta);
      
      if (!currentQty || !maxStock || !deltaBig) {
        return { ...state, error: { id: operationId, code: "INVALID_NUMERIC_VALUE", productId: item.product_id } };
      }

      const newQty = currentQty.plus(deltaBig);
      
      if (newQty.lt(0)) {
        return { ...state, error: { id: operationId, code: "INVALID_QUANTITY", productId: item.product_id } };
      }

      if (newQty.gt(maxStock)) {
        return { ...state, error: { id: operationId, code: "INSUFFICIENT_STOCK", productId: item.product_id } };
      }

      const nextItems = [...state.items];
      if (newQty.eq(0)) {
        nextItems.splice(last, 1);
      } else {
        nextItems[last] = { ...item, quantity: newQty.toString() };
      }
      
      return { ...state, items: nextItems, error: null };
    }

    case 'CLEAR_CART':
    case 'RESET_CART': {
      return { ...state, items: [], error: null };
    }

    default:
      return state;
  }
}

export function usePOSCart() {
  const [state, dispatch] = useReducer(cartReducer, { items: [], error: null });
  const { items, error } = state;

  useEffect(() => {
    if (!error) return;

    switch (error.code) {
      case "INSUFFICIENT_STOCK":
        toast.error("Stock insuficiente en la sucursal");
        break;
      case "INVALID_QUANTITY":
        toast.error("La cantidad debe ser mayor que cero");
        break;
      case "INVALID_NUMERIC_VALUE":
        toast.error("Valor numérico inválido");
        break;
    }
  }, [error]);

  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [cartPulse, setCartPulse] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleAddItem = useCallback((product: Product, quantity: string | number = "1", getBranchStock: (p: Product) => string) => {
    idempotencyKeyRef.current = null;
    const maxStockStr = getBranchStock(product);
    const operationId = crypto.randomUUID();
    
    dispatch({ type: 'ADD_ITEM', product, quantity, maxStockStr, operationId });
    
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 300);
  }, []);

  const handleQtyChange = useCallback((index: number, value: string) => {
    idempotencyKeyRef.current = null;
    dispatch({ type: 'CHANGE_ITEM_QTY', index, quantity: value, operationId: crypto.randomUUID() });
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    idempotencyKeyRef.current = null;
    dispatch({ type: 'REMOVE_ITEM', index });
  }, []);

  const cyclePaymentMethod = useCallback(() => {
    idempotencyKeyRef.current = null;
    const next = PAYMENT_METHODS[(PAYMENT_METHODS.indexOf(paymentMethod) + 1) % PAYMENT_METHODS.length] ?? "Efectivo";
    setPaymentMethod(next);
    toast.success(`Método: ${next}`, { duration: 1200, icon: "💳" });
  }, [paymentMethod]);

  const clearCart = useCallback(() => {
    if (items.length === 0) return;
    if (window.confirm("¿Vaciar todo el carrito?")) {
      idempotencyKeyRef.current = null;
      dispatch({ type: 'CLEAR_CART' });
      toast.success("Carrito vaciado", { icon: "🗑️" });
    }
  }, [items.length]);

  const modifyLastItemQty = useCallback((delta: number) => {
    if (items.length === 0) return;
    idempotencyKeyRef.current = null;
    dispatch({ type: 'MODIFY_LAST_ITEM_QTY', delta, operationId: crypto.randomUUID() });
  }, [items.length]);

  const resetCart = useCallback(() => {
    idempotencyKeyRef.current = null;
    dispatch({ type: 'RESET_CART' });
    setPaymentMethod("Efectivo");
  }, []);

  const currentTotal = useMemo(() => items.reduce((a, i) => {
    const qty = parseBig(i.quantity);
    const price = parseBig(i.unit_price);
    if (!qty || !price) return a;
    return a + qty.times(price).toNumber();
  }, 0), [items]);

  return {
    items, paymentMethod, cartPulse, currentTotal, idempotencyKeyRef,
    setPaymentMethod: (method: string) => {
      idempotencyKeyRef.current = null;
      setPaymentMethod(method);
    },
    handleAddItem, handleQtyChange, handleRemoveItem,
    cyclePaymentMethod, clearCart, modifyLastItemQty, resetCart,
  };
}
