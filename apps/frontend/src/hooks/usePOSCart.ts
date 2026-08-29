import { useState, useCallback, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import Big from "big.js";

const PAYMENT_METHODS = ["Efectivo", "Divisas", "Tarjeta", "Pago Movil", "Transferencia", "Zelle"];

export interface POSCartItem {
  product_id: string;
  name: string;
  quantity: string;
  unit_price: string;
  maxStock: string;
  unit_type?: string;
}

export function usePOSCart() {
  const [items, setItems] = useState<POSCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [cartPulse, setCartPulse] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleAddItem = useCallback((product: any, quantity: string | number = "1") => {
    idempotencyKeyRef.current = null;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === product._id);
      const qtyToAdd = new Big(quantity);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: new Big(item.quantity).plus(qtyToAdd).toString() } : item
        );
      }
      return [...prev, {
        product_id: product._id, name: product.name, quantity: qtyToAdd.toString(),
        unit_price: String(product.price), maxStock: String(product.totalStock || product.stock || "0"),
        unit_type: product.unit_type || "unidad",
      }];
    });
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 300);
  }, []);

  const handleQtyChange = (index: number, value: string) => {
    idempotencyKeyRef.current = null;
    try {
      const qty = new Big(value || "0");
      if (qty.lt(0)) return;
    } catch {
      if (value !== "") return;
    }
    setItems((prev) => {
      return prev.map((item, i) => i === index ? { ...item, quantity: value } : item);
    });
  };

  const handleRemoveItem = (index: number) => {
    idempotencyKeyRef.current = null;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const cyclePaymentMethod = useCallback(() => {
    idempotencyKeyRef.current = null;
    setPaymentMethod((prev) => {
      const next = PAYMENT_METHODS[(PAYMENT_METHODS.indexOf(prev) + 1) % PAYMENT_METHODS.length] ?? "Efectivo";
      toast.success(`Método: ${next}`, { duration: 1200, icon: "💳" });
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    if (items.length === 0) return;
    if (window.confirm("¿Vaciar todo el carrito?")) {
      idempotencyKeyRef.current = null;
      setItems([]);
      toast.success("Carrito vaciado", { icon: "🗑️" });
    }
  }, [items.length]);

  const modifyLastItemQty = useCallback((delta: number) => {
    if (items.length === 0) return;
    idempotencyKeyRef.current = null;
    const last = items.length - 1;
    setItems((prev) => {
      const next = [...prev];
      try {
        const currentQty = new Big(next[last]?.quantity || "0");
        const newQty = currentQty.plus(delta);
        if (newQty.lte(0)) { next.splice(last, 1); }
        else if (next[last]) { next[last].quantity = newQty.toString(); }
      } catch (e) {
        console.error("Error modifying quantity", e);
      }
      return next;
    });
  }, [items]);

  const resetCart = useCallback(() => {
    idempotencyKeyRef.current = null;
    setItems([]);
    setPaymentMethod("Efectivo");
  }, []);

  const currentTotal = useMemo(() => items.reduce((a, i) => {
    try {
      const qty = new Big(i.quantity || "0");
      const price = new Big(i.unit_price || "0");
      return a + qty.times(price).toNumber();
    } catch {
      return a;
    }
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
