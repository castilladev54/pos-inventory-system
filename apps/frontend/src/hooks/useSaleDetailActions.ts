import { useSaleUIStore } from '../store/saleUIStore';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { useCancelSale, saleKeys } from './queries/useSaleQueries';
import API from '../api/axios';
import type { SaleId, SaleDetailDTO } from '@inventory/shared';

export function useSaleDetailActions() {
  const queryClient = useQueryClient();
  const cancelSaleMutation = useCancelSale();
  const { activeBranchId } = useAuthStore();
  const {
    viewedSaleId,
    viewedSale,
    isEditModalOpen,
    openSaleDetail,
    openEditMode,
    closeModals,
  } = useSaleUIStore();

  const handleViewDetail = async (id: SaleId) => {
    try {
      const sale = await queryClient.fetchQuery<SaleDetailDTO>({
        queryKey: [...saleKeys.all(activeBranchId), "detail", id],
        queryFn: async () => {
          const res = await API.get(`/sales/${id}`);
          return res.data.sale ?? res.data;
        },
      });
      // Update store with fetched sale
      useSaleUIStore.setState({ viewedSale: sale });
      // Optionally set active ID
      openSaleDetail(id);
      // Return for callers that may need it
      return sale;
    } catch {
      toast.error("No se pudo cargar el detalle de la venta");
    }
  };

  const handleCancelSale = async (id: SaleId) => {
    if (
      !window.confirm(
        "¿Estás seguro de que deseas anular esta venta? El stock será devuelto y el monto quedará en 0."
      )
    ) return;

    cancelSaleMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Venta anulada con éxito");
        closeModals();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Error al anular la venta");
      },
    });
  };

  const handleUpdateSale = (updatedSale: SaleDetailDTO) => {
    // Update store with new sale data and close edit mode
    useSaleUIStore.setState({ viewedSale: updatedSale, isEditModalOpen: false });
    toast.success("Venta actualizada con éxito");
  };

  return {
    viewedSale,
    viewedSaleId,
    isEditModalOpen,
    openSaleDetail,
    openEditMode,
    closeModals,
    handleViewDetail,
    handleCancelSale,
    handleUpdateSale,
  };
}
