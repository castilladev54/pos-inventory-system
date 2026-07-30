import { useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { itemSubtotal } from "../utils/salesFormatters";

const PAYMENT_METHODS = ["Efectivo", "Divisas", "Tarjeta", "Pago Movil", "Transferencia", "Zelle"];

export function usePOSCart() {
  const [items, setItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [cartPulse, setCartPulse] = useState(false);

  const handleAddItem = useCallback((product, quantity = 1) => {
    if (product.stock <= 0) return toast.error(`${product.name} no tiene stock`);
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === product._id);
      if (idx >= 0) {
        if (prev[idx].quantity + quantity > product.totalStock) {
          setTimeout(() => toast.error(`Sin más stock de ${product.name}`), 0);
          return prev;
        }
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, {
        product_id: product._id, name: product.name, quantity,
        unit_price: product.price, maxStock: product.totalStock,
        unit_type: product.unit_type || "unidad",
      }];
    });
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 300);
  }, []);

  const handleQtyChange = (index, value) => {
    const qty = parseFloat(value);
    if (value !== "" && (isNaN(qty) || qty < 0)) return;
    setItems((prev) => {
      if (qty > prev[index].maxStock) { toast.error(`Máximo stock: ${prev[index].maxStock}`); return prev; }
      return prev.map((item, i) => i === index ? { ...item, quantity: value } : item);
    });
  };

  const handleRemoveItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const cyclePaymentMethod = useCallback(() => {
    setPaymentMethod((prev) => {
      const next = PAYMENT_METHODS[(PAYMENT_METHODS.indexOf(prev) + 1) % PAYMENT_METHODS.length];
      toast.success(`Método: ${next}`, { duration: 1200, icon: "💳" });
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    if (items.length === 0) return;
    if (window.confirm("¿Vaciar todo el carrito?")) {
      setItems([]);
      toast.success("Carrito vaciado", { icon: "🗑️" });
    }
  }, [items.length]);

  const modifyLastItemQty = useCallback((delta) => {
    if (items.length === 0) return;
    const last = items.length - 1;
    setItems((prev) => {
      const next = [...prev];
      const newQty = (parseFloat(next[last].quantity) || 0) + delta;
      if (newQty <= 0) { next.splice(last, 1); }
      else if (newQty > next[last].maxStock) { toast.error(`Stock máx: ${next[last].maxStock}`); return prev; }
      else { next[last].quantity = newQty; }
      return next;
    });
  }, [items]);

  const resetCart = useCallback(() => {
    setItems([]);
    setPaymentMethod("Efectivo");
  }, []);

  const currentTotal = useMemo(() => items.reduce((a, i) => a + itemSubtotal(i), 0), [items]);

  return {
    items, paymentMethod, cartPulse, currentTotal,
    setPaymentMethod,
    handleAddItem, handleQtyChange, handleRemoveItem,
    cyclePaymentMethod, clearCart, modifyLastItemQty, resetCart,
  };
}
