import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { fmtUSD, fmtBs } from "../../utils/salesFormatters";
import Button from "../atoms/Button";
import type { SaleDetailDTO, UserRole } from '@inventory/shared';

interface SaleDetailViewProps {
  sale: SaleDetailDTO;
  onBack: () => void;
  toBs: (val: number) => number;
  userRole?: UserRole;
  onCancel: () => void;
  onEdit: () => void;
}

/**
 * SaleDetailView — Vista de detalle de una venta individual.
 * Muestra los metadatos de la venta y la tabla de artículos vendidos.
 */
const SaleDetailView = ({
  sale,
  onBack,
  toBs,
  userRole,
  onCancel,
  onEdit,
}: SaleDetailViewProps) => {
  // Use historical exchange rate if available, otherwise fallback to current global rate
  const histToBs = sale.exchange_rate
    ? (val: number) => Number((val * (sale.exchange_rate as number)).toFixed(2))
    : toBs;

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-8 p-6 bg-[#1a1a24] border border-white/10 rounded-2xl shadow-xl"
    >
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-orange-500 hover:text-orange-400 shrink-0"
        >
          <ArrowLeft size={20} /> <span>Volver a Ventas</span>
        </Button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <p className="text-sm text-gray-400">ID: {sale._id}</p>
          {userRole === "TENANT_OWNER" && sale.status !== "cancelled" && sale.status !== "Anulada" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
              >
                Editar Venta
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={onCancel}
                className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30"
              >
                Anular Venta
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Método de Pago", value: sale.payment_method, cls: "" },
          { label: "Fecha", value: new Date(sale.createdAt).toLocaleString(), cls: "" },
          { label: "Atendido por", value: sale.sold_by?.name || "Propietario", cls: "" },
          {
            label: "Total USD",
            value: fmtUSD(sale.total_amount),
            cls: "text-amber-500 text-2xl font-bold bg-amber-500/10 border-amber-500/20",
          },
          {
            label: "Total Bs",
            value: fmtBs(sale.total_amount, histToBs),
            cls: "text-blue-400 text-2xl font-bold bg-blue-500/10 border-blue-500/20",
          },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`p-4 rounded-xl border border-white/5 bg-black/20 ${cls}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg font-medium text-white ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-medium text-white mb-4">Artículos Vendidos</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-black/30 text-gray-400 text-sm uppercase tracking-wider">
              {["Producto", "Cantidad", "Precio USD", "Precio Bs", "Subtotal"].map((h) => (
                <th key={h} scope="col" className="px-6 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sale.items?.map((item, idx) => {
              const unit = item.product_id?.unit_type;
              const quantityNum = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
              const unitLabel =
                unit && unit !== "unidad"
                  ? unit
                  : quantityNum === 1
                  ? "unidad"
                  : "unidades";
              const sub = quantityNum * item.unit_price;
              return (
                <tr key={idx} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-3 text-orange-400 font-medium">
                    {item.product_id?.name || "Desconocido"}
                  </td>
                  <td className="px-6 py-3 text-gray-300">
                    {item.quantity} {unitLabel}
                  </td>
                  <td className="px-6 py-3 text-gray-300">{fmtUSD(item.unit_price)}</td>
                  <td className="px-6 py-3 text-blue-400">{fmtBs(item.unit_price, histToBs)}</td>
                  <td className="px-6 py-3">
                    <div className="text-amber-500 font-medium">{fmtUSD(sub)}</div>
                    <div className="text-xs text-blue-400">{fmtBs(sub, histToBs)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.article>
  );
};

export default SaleDetailView;
