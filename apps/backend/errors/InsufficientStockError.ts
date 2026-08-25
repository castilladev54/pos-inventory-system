import { AppError } from '../lib/error.js';

/**
 * Excepción de dominio para operaciones de inventario donde
 * el stock disponible es insuficiente para completar la transacción.
 *
 * Status 409 (Conflict): el estado actual del recurso (stock) entra en
 * conflicto con la operación solicitada (venta/ajuste).
 */
export class InsufficientStockError extends AppError {
  public readonly productName: string;
  public readonly productId: string;

  constructor(productName: string, productId: string) {
    super(409, `Stock insuficiente para "${productName}". La operación fue rechazada.`);
    this.name = 'InsufficientStockError';
    this.productName = productName;
    this.productId = productId;
  }
}
