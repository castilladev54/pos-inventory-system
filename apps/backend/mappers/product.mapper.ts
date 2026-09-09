// apps/backend/mappers/product.mapper.ts
import mongoose, { Types } from "mongoose";
import type {
  BranchId,
  BusinessOwnerId,
  Category,
  CategoryId,
  Product,
  ProductId,
} from "@inventory/shared";

import type {
  BranchInventoryAggregationResult,
  ProductAggregationResult,
} from "../types/aggregation.js";

function objectIdToString(value: Types.ObjectId, field: string): string {
  if (!(value instanceof Types.ObjectId)) {
    throw new TypeError(`${field} no contiene un ObjectId válido`);
  }
  return value.toHexString();
}

function decimal128ToString(
  value: mongoose.Types.Decimal128,
  field: string,
): string {
  if (!(value instanceof mongoose.Types.Decimal128)) {
    throw new TypeError(`${field} no contiene un Decimal128 válido`);
  }
  return value.toString();
}

function dateToISOString(value: Date, field: string): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${field} no contiene una fecha válida`);
  }
  return value.toISOString();
}

function toBranchInventoryDTO(
  raw: BranchInventoryAggregationResult,
): Product["branchInventories"][number] {
  return {
    _id: objectIdToString(raw._id, "branchInventories._id"),
    branch_id: objectIdToString(raw.branch_id, "branchInventories.branch_id") as BranchId,
    product_id: objectIdToString(raw.product_id, "branchInventories.product_id") as ProductId,
    stock: decimal128ToString(raw.stock, "branchInventories.stock"),
    min_stock: decimal128ToString(raw.min_stock, "branchInventories.min_stock"),
    createdAt: dateToISOString(raw.createdAt, "branchInventories.createdAt"),
    updatedAt: dateToISOString(raw.updatedAt, "branchInventories.updatedAt"),
  };
}

function toCategoryDTO(
  raw: NonNullable<ProductAggregationResult["category"]>,
): Category {
  return {
    _id: objectIdToString(raw._id, "category._id") as CategoryId,
    name: raw.name,
    user: objectIdToString(raw.user, "category.user") as BusinessOwnerId,
  };
}

export function toProductDTO(raw: ProductAggregationResult): Product {
  const productId = objectIdToString(raw._id, "product._id") as ProductId;

  if (raw.category === null) {
    throw new Error(`El producto ${productId} no tiene una categoría válida`);
  }

  return {
    _id: productId,
    id: productId,
    name: raw.name,
    description: raw.description ?? "",
    ...(raw.barcode !== undefined ? { barcode: raw.barcode } : {}),
    price: decimal128ToString(raw.price, "product.price"),
    category: toCategoryDTO(raw.category),
    unit_type: raw.unit_type,
    user: objectIdToString(raw.user, "product.user") as BusinessOwnerId,
    ...(raw.isActive !== undefined ? { isActive: raw.isActive } : {}),
    createdAt: dateToISOString(raw.createdAt, "product.createdAt"),
    updatedAt: dateToISOString(raw.updatedAt, "product.updatedAt"),
    __v: raw.__v,
    branchInventories: raw.branchInventories.map(toBranchInventoryDTO),
    totalStock: decimal128ToString(raw.totalStock, "product.totalStock"),
  };
}
