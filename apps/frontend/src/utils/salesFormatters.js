/**
 * salesFormatters.js
 * Utilidades de formato y cálculo para el módulo de ventas (POS + historial).
 * Sin dependencias de React — son funciones puras, fáciles de testear.
 */

/** Formatea un valor numérico como precio en dólares. */
export const fmtUSD = (v) => `$${Number(v || 0).toFixed(2)}`;

/** Formatea un valor numérico como precio en bolívares usando la tasa del día. */
export const fmtBs = (v, toBs) => `Bs ${toBs(Number(v || 0)).toFixed(2)}`;

/** Calcula el subtotal de un ítem del carrito (cantidad × precio unitario). */
export const itemSubtotal = (item) => (parseFloat(item.quantity) || 0) * item.unit_price;

/**
 * Analiza la fecha de vencimiento de un producto y devuelve un objeto
 * con el estado, días restantes, etiqueta legible y clases de color CSS.
 * Devuelve `null` si el campo no existe o no es una fecha válida.
 *
 * @param {string|Date|undefined} expirationDate
 * @returns {{ status: "expired"|"warning"|"ok", days: number, label: string, color: string }|null}
 */
export const getExpirationInfo = (expirationDate) => {
  if (!expirationDate) return null;

  const now = new Date();
  const exp = new Date(expirationDate);
  if (isNaN(exp.getTime())) return null;

  const diffMs   = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const label    = exp.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (diffDays < 0)   return { status: "expired", days: diffDays, label: `VENCIDO: ${label}`,  color: "text-red-400 bg-red-500/15 border-red-500/20" };
  if (diffDays <= 30) return { status: "warning", days: diffDays, label: `Vence: ${label}`,    color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/20" };
  return               { status: "ok",      days: diffDays, label: `Vence: ${label}`,    color: "text-gray-400 bg-white/5 border-white/10" };
};
