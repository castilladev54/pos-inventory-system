import { useState, ChangeEvent, FormEvent } from 'react';
import { Tag, Plus } from 'lucide-react';
import {
  useCategoriesQuery,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../hooks/queries';
import toast from 'react-hot-toast';
import type { Category, CategoryId } from '@inventory/shared';

import Button from './atoms/Button';
import Modal from './molecules/Modal';
import SectionHeader from './molecules/SectionHeader';
import ConfirmDialog from './molecules/ConfirmDialog';
import FormField from './molecules/FormField';
import DataTable, { DataTableColumn } from './organisms/DataTable';

const ITEMS_PER_PAGE = 10;

const COLUMNS: DataTableColumn<Category>[] = [
  {
    key: 'name',
    label: 'Nombre',
    render: (val, row) => (
      <div>
        <p className="font-semibold text-white text-sm sm:text-base">{val}</p>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">ID: {row._id?.slice(-6)}</p>
      </div>
    ),
  },
  {
    key: 'description',
    label: 'Descripción',
    headerClassName: 'hidden md:table-cell',
    className: 'hidden md:table-cell text-gray-400 max-w-xs truncate',
  },
];

const EMPTY_FORM = { name: '', description: '' };

const CategoryManager = () => {
  const [currentPage, setCurrentPage] = useState(1);

  // Queries
  const { data, isLoading, error } = useCategoriesQuery(currentPage, ITEMS_PER_PAGE);

  // Mutations
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<CategoryId | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const categories = data?.categories ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (category: Category) => {
    setEditingId(category._id);
    setFormData({ name: category.name, description: (category as any).description || '' });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const isEditing = !!editingId;
    const mutation = isEditing ? updateMutation : createMutation;

    toast.promise(
      isEditing
        ? updateMutation.mutateAsync({ id: editingId as CategoryId, data: formData })
        : createMutation.mutateAsync(formData),
      {
        loading: isEditing ? 'Actualizando categoría...' : 'Creando categoría...',
        success: () => {
          closeForm();
          return isEditing ? 'Categoría actualizada' : 'Categoría creada';
        },
        error: (err: any) => err.response?.data?.message || 'Error al procesar la categoría',
      }
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    toast.promise(
      deleteMutation.mutateAsync(deleteTarget._id),
      {
        loading: 'Eliminando categoría...',
        success: () => {
          setDeleteTarget(null);
          return 'Categoría eliminada exitosamente';
        },
        error: (err: any) =>
          err.response?.data?.message || 'Error al eliminar la categoría. ¿Tiene productos activos?',
      }
    );
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <section aria-labelledby="category-heading" className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <SectionHeader
        id="category-heading"
        title={<>Gestión de <span className="text-orange-500">Categorías</span></>}
        onAdd={() => setIsFormOpen(true)}
        addLabel={<><Plus size={18} /> Nueva Categoría</>}
      />

      {error && !isFormOpen && (
        <p role="alert" className="p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          {error.message || 'Error al obtener las categorías'}
        </p>
      )}

      <DataTable
        columns={COLUMNS}
        data={categories}
        isLoading={isLoading && !isFormOpen}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
        emptyMessage="No hay categorías"
        emptyDetail="Aún no has agregado ninguna categoría a tu inventario."
        emptyAction={{ label: 'Agregar mi primera categoría', onClick: () => setIsFormOpen(true) }}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Formulario */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingId ? 'Editar Categoría' : 'Agregar Nueva Categoría'}
        icon={<Tag size={20} />}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Nombre de la categoría"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Ej. Laptops, Teléfonos..."
          />
          <FormField
            as="textarea"
            label="Descripción"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Breve descripción de la categoría..."
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={closeForm} disabled={isMutating}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={isMutating}>
              {editingId ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmación de borrado */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        message={`¿Eliminar "${deleteTarget?.name}"?`}
        detail="Esta acción no se puede deshacer. Las categorías con productos activos no pueden eliminarse."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMutation.isPending}
      />
    </section>
  );
};

export default CategoryManager;
