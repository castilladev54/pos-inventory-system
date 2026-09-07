import { fmtUSD, fmtBs } from '../../utils/salesFormatters';
import type { Product, UnitType } from '@inventory/shared';

// No extra interface; using Product directly

interface ProductCardProps {
  product: Product;
  stock: string;
  cartQty: number;
  onAdd: (product: Product) => void;
  exchangeRate: string;
}

/**
 * ProductCard — Tarjeta de producto del catálogo POS.
 * Clickeable: agrega el producto al carrito al hacer clic o Enter.
 * Muestra badge de stock, precio y estado de vencimiento si aplica.
 */
const ProductCard = ({ product, stock, cartQty, onAdd, exchangeRate }: ProductCardProps) => {
  const numericStock = Number(stock);
  return (
    <div
      onClick={() => onAdd(product)}
      role="button"
      tabIndex={0}
      aria-label={`Agregar ${product.name} al carrito`}
      onKeyDown={(e) => e.key === 'Enter' && onAdd(product)}
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden group cursor-pointer active:scale-95
        ${numericStock > 0
          ? 'bg-[#1a1a24] border-white/5 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10'
          : 'bg-red-500/10 border-red-500/30 hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/20'}`}
    >
      <div className={`p-3 sm:p-4 flex flex-col h-[110px] sm:h-[130px]`}>
        <div className="flex justify-between items-start mb-1 sm:mb-2">
          <span className="text-[10px] sm:text-xs font-bold text-gray-500 tracking-wider">STOCK: {stock}</span>
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
      </div>
    </div>
  );
};

export default ProductCard;
