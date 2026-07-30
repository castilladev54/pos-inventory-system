import { useEffect, useRef, RefObject } from 'react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface UsePOSKeyboardOptions {
  isFormOpen: boolean;
  viewedSale: unknown;
  showHelp: boolean;
  isScannerOpen: boolean;
  isCartOpen: boolean;
  items: unknown[];

  setShowHelp: (fn: (prev: boolean) => boolean) => void;
  setIsFormOpen: (open: boolean) => void;
  setViewedSale: (sale: null) => void;
  setIsScannerOpen: (open: boolean) => void;
  setIsCartOpen: (open: boolean) => void;

  searchInputRef: RefObject<HTMLInputElement | null>;
  submitBtnRef: RefObject<HTMLButtonElement | null>;

  cyclePaymentMethod: () => void;
  clearCart: (force?: boolean) => void;
  modifyLastItemQty: (delta: number) => void;
  handleBarcodeScan: (barcode: string) => void;
  cancelForm: () => void;
}

// ─── Constantes del Escáner Físico ───────────────────────────────────────────

/**
 * Los lectores de códigos de barras USB/Bluetooth emiten cada tecla con un
 * intervalo típico de 5–30 ms. Los humanos tecleando raramente bajan de 80 ms.
 *
 * Usamos 40 ms como umbral conservador: detecta lectores físicos reales
 * sin interferir con la escritura manual rápida.
 */
const SCANNER_MAX_INTERVAL_MS = 40;
const MIN_BARCODE_LENGTH = 5;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * usePOSKeyboard — Handler global de teclado para el POS.
 *
 * Mejoras respecto a la versión JS original:
 *
 * 1. DETECCIÓN DE ESCÁNER POR VELOCIDAD (Fase 5 del plan):
 *    Si el intervalo entre teclas consecutivas es <= 40ms, asumimos que proviene
 *    de un lector físico. En ese caso, llamamos a `e.preventDefault()` SIEMPRE,
 *    independientemente de si hay un <input> enfocado. Esto evita que los
 *    caracteres del código de barras se inserten en el campo activo.
 *
 * 2. TIPADO ESTRICTO:
 *    Todos los parámetros están tipados, eliminando el riesgo de pasar
 *    callbacks incorrectos.
 *
 * 3. CLEANUP CORRECTO:
 *    El listener se registra y elimina en el mismo ciclo de vida del efecto,
 *    evitando listener leaks al desmontar el componente POS.
 */
export function usePOSKeyboard({
  isFormOpen,
  viewedSale,
  showHelp,
  isScannerOpen,
  isCartOpen,
  items,
  setShowHelp,
  setIsFormOpen,
  setViewedSale,
  setIsScannerOpen,
  setIsCartOpen,
  searchInputRef,
  submitBtnRef,
  cyclePaymentMethod,
  clearCart,
  modifyLastItemQty,
  handleBarcodeScan,
  cancelForm,
}: UsePOSKeyboardOptions) {

  /**
   * Usamos refs para el buffer del escáner para que no queden stale closures
   * dentro del handler de keydown. El buffer vive en el ref, no en el closure.
   */
  const scannerBuffer = useRef('');
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = ['input', 'textarea', 'select'].includes(
        target.tagName.toLowerCase()
      );

      // ── 1. Detección de escáner físico por velocidad ─────────────────────
      //
      // Si el intervalo desde la última tecla es <= SCANNER_MAX_INTERVAL_MS,
      // tratamos esta tecla como parte de un flujo de escáner físico.
      // Llamamos a preventDefault() ANTES de que el navegador la inserte en
      // el input activo, interceptándola a nivel del event bubble.
      const now = Date.now();
      const interval = now - lastKeyTime.current;
      lastKeyTime.current = now;

      const isScannerLikeSpeed = interval <= SCANNER_MAX_INTERVAL_MS;

      // Reiniciar buffer si el intervalo es muy largo (pausa humana)
      if (interval > SCANNER_MAX_INTERVAL_MS * 3) {
        scannerBuffer.current = '';
      }

      if (isScannerLikeSpeed && e.key.length === 1) {
        // Velocidad de escáner: capturar carácter y bloquear su inserción en el DOM
        e.preventDefault();
        scannerBuffer.current += e.key;
        return; // Salimos — el carácter va al buffer, no al input
      }

      if (isScannerLikeSpeed && e.key === 'Enter') {
        e.preventDefault();
        const code = scannerBuffer.current;
        scannerBuffer.current = '';
        if (code.length >= MIN_BARCODE_LENGTH) {
          handleBarcodeScan(code);
        }
        return;
      }

      // Si la tecla llega a velocidad humana normal, limpiamos el buffer
      // (puede ser un Enter manual del usuario, no de un escáner)
      if (e.key !== 'Enter') {
        scannerBuffer.current = '';
      }

      // ── 2. Hotkeys globales del POS ───────────────────────────────────────
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          setShowHelp((p) => !p);
          return;

        case 'F2':
          e.preventDefault();
          if (!isFormOpen) {
            setIsFormOpen(true);
            setViewedSale(null);
          }
          return;

        case 'F3':
          e.preventDefault();
          if (isFormOpen) searchInputRef.current?.focus();
          return;

        case 'F4':
          e.preventDefault();
          if (isFormOpen && items.length > 0 && !isCartOpen) setIsCartOpen(true);
          return;

        case 'F5':
          e.preventDefault();
          if (isFormOpen) cyclePaymentMethod();
          return;

        case 'F6':
          e.preventDefault();
          if (isFormOpen) setIsScannerOpen(true);
          return;

        case 'F8':
          e.preventDefault();
          if (isFormOpen) clearCart();
          return;

        case 'F9':
          e.preventDefault();
          if (isFormOpen && isCartOpen && items.length > 0) {
            submitBtnRef.current?.click();
          }
          return;

        case 'Escape':
          e.preventDefault();
          if (showHelp)      { setShowHelp(() => false); return; }
          if (isScannerOpen) { setIsScannerOpen(false);  return; }
          if (viewedSale)    { setViewedSale(null);       return; }
          if (isCartOpen)    { setIsCartOpen(false);      return; }
          if (isFormOpen)    { cancelForm();              return; }
          return;

        default:
          break;
      }

      // ── 3. Atajos de teclado solo si NO hay un input enfocado ─────────────
      if (isInputFocused) return;

      if (e.key === '/' && isFormOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isFormOpen) {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); modifyLastItemQty(1);  return; }
        if (e.key === '-')                  { e.preventDefault(); modifyLastItemQty(-1); return; }
      }

      // ── 4. Buffer de escáner para teclas a velocidad NORMAL (fallback) ────
      // Captura flujos lentos que aún podrían ser de un escáner defectuoso.
      if (e.key === 'Enter') {
        const code = scannerBuffer.current;
        scannerBuffer.current = '';
        if (code.length >= MIN_BARCODE_LENGTH) {
          handleBarcodeScan(code);
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        scannerBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', onKey);

    // Cleanup: se ejecuta cuando el componente se desmonta o las dependencias cambian.
    // Eliminar el listener es crítico para evitar memory leaks en React StrictMode.
    return () => {
      window.removeEventListener('keydown', onKey);
      scannerBuffer.current = '';
    };
  }, [
    isFormOpen, viewedSale, showHelp, isScannerOpen, isCartOpen, items,
    setShowHelp, setIsFormOpen, setViewedSale, setIsScannerOpen, setIsCartOpen,
    searchInputRef, submitBtnRef,
    cyclePaymentMethod, clearCart, modifyLastItemQty, handleBarcodeScan, cancelForm,
  ]);
}
