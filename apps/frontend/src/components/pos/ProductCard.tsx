import { AlertTriangle } from 'lucide-react';
import { fmtUSD, fmtBs, getExpirationInfo } from '../../utils/salesFormatters';
import type { Product } from '@inventory/shared';

export interface PosProduct extends Product {
  stock: number;
  expiration_date?: string;
}

interface ProductCardProps {
  product: PosProduct;
  cartQty: number;
  onAdd: (product: PosProduct) => void;
  exchangeRate: number;
}

/**
 * ProductCard — Tarjeta de producto del catálogo POS.
 * Clickeable: agrega el producto al carrito al hacer clic o Enter.
 * Muestra badge de stock, precio y estado de vencimiento si aplica.
 */
const ProductCard = ({ product, cartQty, onAdd, exchangeRate }: ProductCardProps) => {
  const expInfo = getExpirationInfo(product.expiration_date);
  return (
    <div
      onClick={() => onAdd(product)}
      role="button"
      tabIndex={0}
      aria-label={`Agregar ${product.name} al carrito`}
      onKeyDown={(e) => e.key === 'Enter' && onAdd(product)}
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden group cursor-pointer active:scale-95
        ${product.stock > 0
          ? 'bg-[#1a1a24] border-white/5 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10'
          : 'bg-red-500/10 border-red-500/30 hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/20'}`}
    >
      <div className={`p-3 sm:p-4 flex flex-col ${expInfo ? 'h-[130px] sm:h-[155px]' : 'h-[110px] sm:h-[130px]'}`}>
        <div className="flex justify-between items-start mb-1 sm:mb-2">
          <span className="text-[10px] sm:text-xs font-bold text-gray-500 tracking-wider">STOCK: {product.stock}</span>
          {cartQty > 0 && (
            <span className="bg-orange-500 text-black text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
              {cartQty}
            </span>
          )}
        </div>
        <h4 className="text-white font-medium text-xs sm:text-sm leading-tight mb-2 flex-1 line-clamp-2">
          {product.name}{product.unit_type && product.unit_type !== 'unidad' ? ` (${product.unit_type})` : ''}
        </h4>
        <div className="flex justify-between items-end mt-auto">
          <span className="text-[10px] sm:text-xs text-blue-400 font-medium">{fmtBs(product.price, exchangeRate)}</span>
          <span className="text-orange-500 font-bold text-base sm:text-lg leading-none">{fmtUSD(product.price)}</span>
        </div>
        {/* Badge de fecha de vencimiento — solo se muestra si el backend envía expiration_date */}
        {expInfo && (
          <div className={`flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg border text-[9px] sm:text-[10px] font-semibold tracking-wide w-fit ${expInfo.color}`}>
            {expInfo.status !== 'ok' && <AlertTriangle size={10} aria-hidden="true" />}
            <span>{expInfo.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
