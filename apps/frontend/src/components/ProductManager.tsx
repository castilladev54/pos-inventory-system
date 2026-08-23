import { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { Plus, PackageOpen, Camera, ScanBarcode, Tag as TagIcon } from 'lucide-react';
import {
  useProductsQuery,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useAllCategoriesQuery,
} from '../hooks/queries';
import { useExchangeRateQuery } from '../hooks/queries/useExchangeRateQueries';
import { toBs } from '../utils/currency';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import type { Product, ProductId } from '@inventory/shared';

import Button from './atoms/Button';
import Badge from './atoms/Badge';
import Modal from './molecules/Modal';
import FormField from './molecules/FormField';
import SectionHeader from './molecules/SectionHeader';
import ConfirmDialog from './molecules/ConfirmDialog';
import DataTable, { DataTableColumn } from './organisms/DataTable';
import BarcodeScanner from './BarcodeScanner';
import ProductSearchBar from './molecules/ProductSearchBar';
import { RateGuard } from './pos/RateGuard';
import { RequireBranchGuard } from './guards/RequireBranchGuard';

const ITEMS_PER_PAGE = 20;

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  unit_type: 'unidad' | 'kg' | 'litro' | 'metro';
  barcode: string;
  new_stock: string;
  stock_reason: string;
}

const EMPTY_FORM: ProductFormData = {
  name: '', description: '', price: '', stock: '',
  category: '', unit_type: 'unidad', barcode: '',
  new_stock: '', stock_reason: '',
};

const STOCK_REASONS = [
  { value: 'initial_count', label: 'Inventario Inicial' },
  { value: 'damaged', label: 'Dañado / Merma' },
  { value: 'stolen', label: 'Extravío / Robo' },
  { value: 'expired', label: 'Vencido' },
  { value: 'correction', label: 'Corrección' },
  { value: 'other', label: 'Otro motivo' },
];

const UNIT_OPTIONS = [
  { value: 'unidad', label: 'Unidad (ud)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'litro', label: 'Litros (l)' },
  { value: 'metro', label: 'Metros (m)' },
];

const stockVariant = (stock: number) => {
  if (stock > 10) return 'success';
  if (stock > 0) return 'warning';
  return 'danger';
};

const formatUnit = (stock: number, unit_type?: string) => {
  if (unit_type && unit_type !== 'unidad') return unit_type;
  return stock === 1 ? 'unidad' : 'unidades';
};

const buildColumns = (toBsFn: (usd: string, rate: string) => string, rate: number): DataTableColumn<Product>[] => [
  {
    key: 'name',
    label: 'Producto',
    render: (val, row) => (
      <div>
        <p className="font-semibold text-white text-sm sm:text-base">{val}</p>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">ID: {row._id?.slice(-6)}</p>
      </div>
    ),
  },
  {
    key: 'category',
    label: 'Categoría',
    headerClassName: 'hidden md:table-cell',
    className: 'hidden md:table-cell',
    render: (val) => (
      <span className="bg-white/5 px-2 py-1 rounded-md text-xs border border-white/10 text-gray-400">
        {val?.name || 'Sin Categoría'}
      </span>
    ),
  },
  {
    key: 'price',
    label: 'Precio',
    render: (val) => (
      <div>
        <p className="text-amber-500 font-medium text-sm sm:text-base">${Number(val).toFixed(2)}</p>
        <p className="text-[10px] sm:text-xs text-blue-400 mt-0.5">Bs {toBsFn(String(val), String(rate))}</p>
      </div>
    ),
  },
  {
    key: 'stock',
    label: 'Stock',
    render: (val, row) => {
      const formattedStock = new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }).format(val);
      return (
        <Badge variant={stockVariant(val)}>
          {formattedStock}{' '}
          <span className="hidden sm:inline">{formatUnit(val, row.unit_type)}</span>
        </Badge>
      );
    },
  },
  {
    key: 'barcode',
    label: 'Barcode',
    headerClassName: 'hidden lg:table-cell',
    className: 'hidden lg:table-cell font-mono text-xs text-gray-400',
  },
];

const ProductManagerInner = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showDebtOnly, setShowDebtOnly] = useState(false);

  // Queries
  const { data, isLoading, error } = useProductsQuery(currentPage, ITEMS_PER_PAGE, debouncedSearch, showDebtOnly);
  const { data: categories = [] } = useAllCategoriesQuery();
  const { data: rateData } = useExchangeRateQuery();
  const exchangeRate = rateData?.rate ?? 1;
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  // Mutations
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<ProductId | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const products = data?.products ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (searchTerm !== debouncedSearch) {
        setCurrentPage(1);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm, debouncedSearch]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (product: Product) => {
    const stockVal = String((product as any).stock ?? 0);
    setEditingId(product._id);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      stock: stockVal,
      category: typeof product.category === 'object' && product.category ? product.category._id : String(product.category),
      unit_type: product.unit_type || 'unidad',
      barcode: product.barcode || '',
      new_stock: stockVal,
      stock_reason: '',
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const isStockChanged = editingId && Number(formData.new_stock) !== Number(formData.stock);

    if (isStockChanged && !formData.stock_reason) {
      toast.error('Debe seleccionar un motivo para el ajuste de stock.');
      return;
    }

    // Payload base: solo campos de catálogo (sin dependencias logísticas)
    const payload: any = {
      name: formData.name,
      description: formData.description,
      price: Number(formData.price),
      category: formData.category,
      unit_type: formData.unit_type,
      barcode: formData.barcode || undefined,
    };

    if (editingId) {
      // Solo inyectar campos logísticos en el flujo de edición
      if (isStockChanged) {
        if (!activeBranchId) {
          toast.error('Debes seleccionar una sucursal activa para modificar el inventario');
          return;
        }
        payload.new_stock = Number(formData.new_stock);
        payload.stock_reason = formData.stock_reason;
        payload.branch_id = activeBranchId;
      }

      toast.promise(
        updateMutation.mutateAsync({ id: editingId, data: payload }),
        {
          loading: 'Actualizando producto...',
          success: () => {
            closeForm();
            return 'Producto actualizado';
          },
          error: (err: any) => err.response?.data?.message || 'Error al actualizar',
        }
      );
    } else {
      // Creación pura de catálogo — sin stock_inicial, sin branch_id
      toast.promise(
        createMutation.mutateAsync(payload),
        {
          loading: 'Creando producto...',
          success: () => {
            closeForm();
            return 'Producto creado';
          },
          error: (err: any) => err.response?.data?.message || 'Error al crear',
        }
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    toast.promise(
      deleteMutation.mutateAsync(deleteTarget._id),
      {
        loading: 'Eliminando producto...',
        success: () => {
          setDeleteTarget(null);
          return 'Producto eliminado exitosamente';
        },
        error: (err: any) => err.response?.data?.message || 'Error al eliminar el producto',
      }
    );
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const selectClass =
    'w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-3 text-white ' +
    'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition';

  const isWorking = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <section aria-labelledby="products-heading" className="w-full max-w-6xl mx-auto p-4 sm:p-6">
      <SectionHeader
        id="products-heading"
        title={<>Gestión de <span className="text-orange-500">Productos</span></>}
        onAdd={() => setIsFormOpen(true)}
        addLabel={<><Plus size={18} /> Nuevo Producto</>}
      />

      {error && !isFormOpen && (
        <p role="alert" className="p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          {error.message || 'Error al obtener los productos'}
        </p>
      )}

      {/* Buscador */}
      {!isFormOpen && (
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex-1 w-full">
            <ProductSearchBar
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
              placeholder="Buscar por nombre o código de barras..."
              onOpenScanner={() => setIsScannerOpen(true)}
            />
          </div>
          <Button
            type="button"
            variant={showDebtOnly ? 'primary' : 'outline'}
            onClick={() => {
              setShowDebtOnly(!showDebtOnly);
              setCurrentPage(1);
            }}
            className={`whitespace-nowrap ${showDebtOnly ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/50' : 'text-gray-400 border-white/10 hover:text-white'}`}
          >
            🚨 Ver Deuda Operativa
          </Button>
        </div>
      )}

      {/* Formulario */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingId ? 'Editar Producto' : 'Agregar Nuevo Producto'}
        icon={<TagIcon size={20} />}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <FormField
              label="Nombre del producto"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ej. iPhone 15 Pro"
            />

            {/* Categoría — select nativo */}
            <div className="flex flex-col gap-1">
              <label htmlFor="product-category" className="block text-sm font-medium text-gray-300 mb-1">
                Categoría <span className="text-orange-500" aria-hidden="true">*</span>
              </label>
              <select
                id="product-category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className={selectClass}
              >
                <option value="" disabled>Selecciona una categoría</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <FormField
              label="Precio ($)"
              name="price"
              type="number"
              value={formData.price}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="Ej. 999.99"
            />

            {editingId ? (
              <div className="flex flex-col gap-1 col-span-1 md:col-span-2 p-4 border border-white/5 bg-white/5 rounded-xl">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Stock en Estantería (Físico)
                  </label>
                  <span className="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded border border-white/5">
                    Stock actual del sistema: {formData.stock}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="number"
                    name="new_stock"
                    value={formData.new_stock}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="Cantidad real en tienda"
                    className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition font-bold"
                  />

                  {Number(formData.new_stock) !== Number(formData.stock) && (
                    <select
                      name="stock_reason"
                      value={formData.stock_reason}
                      onChange={handleChange}
                      required
                      className={selectClass}
                    >
                      <option value="" disabled>Motivo del ajuste...</option>
                      {STOCK_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ) : null}

            {/* Código de barras con botón escáner */}
            <div className="flex flex-col gap-1">
              <label htmlFor="product-barcode" className="block text-sm font-medium text-gray-300 mb-1">
                Código de Barras <span className="text-gray-500 text-xs">(Opcional)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ScanBarcode
                    size={18}
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
                  />
                  <input
                    id="product-barcode"
                    name="barcode"
                    type="text"
                    value={formData.barcode}
                    onChange={handleChange}
                    placeholder="Escanear o escribir..."
                    className="w-full pl-9 pr-3 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition"
                  />
                </div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  aria-label="Abrir escáner de cámara"
                  className="px-3"
                >
                  <Camera size={20} />
                </Button>
              </div>
            </div>

            {/* Unidad de medida */}
            <div className="flex flex-col gap-1">
              <label htmlFor="product-unit" className="block text-sm font-medium text-gray-300 mb-1">
                Unidad de Medida <span className="text-orange-500" aria-hidden="true">*</span>
              </label>
              <select
                id="product-unit"
                name="unit_type"
                value={formData.unit_type}
                onChange={handleChange}
                required
                className={selectClass}
              >
                {UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <FormField
            as="textarea"
            label="Descripción"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Detalles sobre el producto..."
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeForm} disabled={isWorking}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={isWorking}>
              {editingId ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>

      <DataTable
        columns={buildColumns(toBs, exchangeRate)}
        data={products}
        isLoading={isLoading && !isFormOpen}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay productos"
        emptyIcon={<PackageOpen size={30} />}
        emptyDetail="Aún no has agregado ningún producto al inventario."
        emptyAction={{ label: 'Agregar mi primer producto', onClick: () => setIsFormOpen(true) }}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Confirmación de borrado */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        message={`¿Eliminar "${deleteTarget?.name}"?`}
        detail="Esta acción no se puede deshacer y eliminará el producto del inventario."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMutation.isPending}
      />

      {/* Escáner de código de barras */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code: string) => {
          setIsScannerOpen(false);
          toast.success(`Código detectado: ${code}`);
          if (isFormOpen) {
            setFormData((prev) => ({ ...prev, barcode: code }));
          } else {
            setSearchTerm(code);
          }
        }}
      />
    </section>
  );
};

export default function ProductManager() {
  return (
    <RequireBranchGuard>
      <RateGuard>
        <ProductManagerInner />
      </RateGuard>
    </RequireBranchGuard>
  );
}
