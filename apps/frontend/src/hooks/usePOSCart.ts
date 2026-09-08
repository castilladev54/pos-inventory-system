import { useState, useCallback, useMemo, useRef } from "react";
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

export function usePOSCart() {
  const [items, setItems] = useState<POSCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [cartPulse, setCartPulse] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleAddItem = useCallback((product: Product, quantity: string | number = "1", getBranchStock: (p: Product) => string) => {
    idempotencyKeyRef.current = null;
    const maxStockStr = getBranchStock(product);
    const maxStock = new Big(maxStockStr || "0");
    const qtyToAdd = new Big(quantity);

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === product._id);
      if (idx >= 0) {
        const item = prev[idx];
        if (!item) return prev;
        const newQty = new Big(item.quantity).plus(qtyToAdd);
        if (newQty.gt(maxStock)) {
          toast.error("Stock insuficiente en la sucursal");
          return prev;
        }
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: newQty.toString() } : item
        );
      }
      
      if (qtyToAdd.gt(maxStock)) {
        toast.error("Stock insuficiente en la sucursal");
        return prev;
      }

      return [...prev, {
        product_id: product._id, name: product.name, quantity: qtyToAdd.toString(),
        unit_price: String(product.price), maxStock: maxStockStr,
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
      
      setItems((prev) => {
        const item = prev[index];
        if (!item) return prev;
        const maxStock = new Big(item.maxStock || "0");
        if (qty.gt(maxStock)) {
          toast.error("Stock insuficiente en la sucursal");
          return prev;
        }
        return prev.map((it, i) => i === index ? { ...it, quantity: value } : it);
      });
    } catch {
      if (value !== "") return;
      setItems((prev) => prev.map((it, i) => i === index ? { ...it, quantity: value } : it));
    }
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
        const item = next[last];
        if (!item) return next;
        const currentQty = new Big(item.quantity || "0");
        const newQty = currentQty.plus(delta);
        const maxStock = new Big(item.maxStock || "0");
        
        if (newQty.gt(maxStock)) {
          toast.error("Stock insuficiente en la sucursal");
          return prev;
        }

        if (newQty.lte(0)) { next.splice(last, 1); }
        else { item.quantity = newQty.toString(); }
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
