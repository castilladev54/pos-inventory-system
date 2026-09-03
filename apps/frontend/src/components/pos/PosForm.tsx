import React, { FormEvent, useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useCreateSale } from '../../hooks/queries/useSaleQueries';
import { usePOSCart } from '../../hooks/usePOSCart';
import { useProductStore } from '../../store/productStore';
import { useAuthStore } from '../../store/authStore';
import { useExchangeRateQuery } from '../../hooks/queries/useExchangeRateQueries';
import { useCurrentCashShiftQuery } from '../../hooks/queries/useCashShiftQueries';
import { usePOSKeyboard } from '../../hooks/usePOSKeyboard';
import SalePOSForm from './SalePOSForm';
import POSGuardOverlay from './POSGuardOverlay';
import toast from 'react-hot-toast';
import { PaymentMethod } from '@inventory/shared';

interface PosFormProps {
  onCancel: () => void;
  onOpenScanner: () => void;
  onOpenCashShift: () => void;
  isScannerOpen: boolean;
  isFormOpen: boolean;
  setIsCartOpenExternal: (open: boolean) => void;
  isCartOpenExternal: boolean;
}

export default function PosForm({
  onCancel,
  onOpenScanner,
  onOpenCashShift,
  isScannerOpen,
  isFormOpen,
  setIsCartOpenExternal,
  isCartOpenExternal,
}: PosFormProps) {
  const createSaleMutation = useCreateSale();
  const { posProducts, isPosLoading, fetchAllForPOS, fetchProductByBarcode } = useProductStore();
  const { user, activeBranchId } = useAuthStore();
  
  const { data: rateData } = useExchangeRateQuery();
  const exchangeRate = Number(rateData?.rate ?? 1);
  
  const { data: currentShift } = useCurrentCashShiftQuery(activeBranchId, user?._id);

  const {
    items,
    paymentMethod,
    cartPulse,
    currentTotal,
    setPaymentMethod,
    handleAddItem,
    handleQtyChange,
    handleRemoveItem,
    cyclePaymentMethod,
    clearCart,
    modifyLastItemQty,
    resetCart,
    idempotencyKeyRef,
  } = usePOSCart();

  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const paymentSelectRef = useRef<HTMLSelectElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isFormOpen) fetchAllForPOS();
  }, [isFormOpen, fetchAllForPOS]);

  useEffect(() => {
    if (!isScannerOpen && isFormOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isScannerOpen, isFormOpen]);

  const handleCloseCart = useCallback((open: boolean) => {
    if (!open) {
      if (createSaleMutation.isPending && abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsCartOpenExternal(false);
    } else {
      setIsCartOpenExternal(true);
    }
  }, [createSaleMutation.isPending, setIsCartOpenExternal]);

  usePOSKeyboard({
    isFormOpen,
    viewedSale: null,
    showHelp: false,
    isScannerOpen,
    isCartOpen: isCartOpenExternal,
    items,
    hasOpenShift: !!currentShift,
    setShowHelp: () => {}, // Handled globally
    setIsFormOpen: () => {},
    setIsScannerOpen: onOpenScanner,
    setIsCartOpen: handleCloseCart,
    searchInputRef,
    submitBtnRef,
    cyclePaymentMethod,
    clearCart,
    modifyLastItemQty,
    handleBarcodeScan: async (code: string) => {
      const qty = 1;
      const local = posProducts.find((p: any) => p.barcode === code || p._id === code);
      if (local) {
        handleAddItem(local, qty);
        toast.success(`Añadido: ${qty}x ${local.name}`);
        setSearchTerm("");
        return;
      }
      try {
        const res = await fetchProductByBarcode(code);
        const product = res?.product || res;
        if (product?._id) {
          handleAddItem(product, qty);
          toast.success(`Añadido: ${qty}x ${product.name}`);
          setSearchTerm("");
        } else {
          throw new Error();
        }
      } catch {
        toast.error(`Código "${code}" no encontrado`);
      }
    },
    cancelForm: onCancel,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return toast.error("Agrega al menos un artículo");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    const payload = {
      items: items.map((i: any) => ({
        product_id: i.product_id,
        quantity: String(i.quantity),
        unit_price: String(i.unit_price),
      })),
      payment_method: paymentMethod as PaymentMethod,
      exchange_rate: String(exchangeRate),
      signal: controller.signal,
      idempotencyKey: idempotencyKeyRef.current,
    };

    createSaleMutation.mutate(payload, {
      onSuccess: () => {
        idempotencyKeyRef.current = null;
        toast.success("Venta registrada con éxito");
        resetCart();
        onCancel();
        fetchAllForPOS();
      },
      onError: (err: any) => {
        if (err?.response?.status === 403) {
          idempotencyKeyRef.current = null;
          fetchAllForPOS();
        }
        if (err.name === "CanceledError" || err.name === "AbortError" || (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError")) {
          toast.error("Venta cancelada (operación abortada)");
        } else {
          const errMsg = err?.response?.data?.message 
            || (!err?.response ? "Error de red: El servidor no responde." : "Error inesperado al registrar la venta");
          toast.error(errMsg);
        }
      },
      onSettled: () => {
        abortControllerRef.current = null;
      },
    });
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return posProducts;
    return posProducts.filter(
      (p: any) =>
        p.name.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
    );
  }, [posProducts, searchTerm]);

  return (
    <POSGuardOverlay>
      <SalePOSForm
        items={items}
        onCancel={onCancel}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onQtyChange={handleQtyChange}
        onSubmit={handleSubmit}
        paymentMethod={paymentMethod}
        onPaymentChange={setPaymentMethod}
        isLoading={createSaleMutation.isPending || isPosLoading}
        currentTotal={currentTotal}
        filteredProducts={filteredProducts}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        onOpenScanner={onOpenScanner}
        exchangeRate={String(exchangeRate)}
        cartPulse={cartPulse}
        submitBtnRef={submitBtnRef}
        paymentSelectRef={paymentSelectRef}
        searchInputRef={searchInputRef}
        isCartOpen={isCartOpenExternal}
        setIsCartOpen={handleCloseCart}
        hasOpenShift={!!currentShift}
        onOpenCashShift={onOpenCashShift}
      />
    </POSGuardOverlay>
  );
}
