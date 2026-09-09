import mongoose, { Types } from "mongoose";

export interface InventoryAggregationResult {
  _id: Types.ObjectId;
  product_id: Types.ObjectId;
  branch_id: Types.ObjectId;
  owner_id: Types.ObjectId;
  quantity: mongoose.Types.Decimal128;
  min_stock_alert: mongoose.Types.Decimal128;
  createdAt: Date;
  updatedAt: Date;
}

export interface BranchInventoryAggregationResult {
  _id: Types.ObjectId;
  product_id: Types.ObjectId;
  branch_id: Types.ObjectId;
  stock: mongoose.Types.Decimal128;
  min_stock: mongoose.Types.Decimal128;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductAggregationResult {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  barcode?: string;

  price: mongoose.Types.Decimal128;

  category:
    | {
        _id: Types.ObjectId;
        name: string;
        user: Types.ObjectId;
      }
    | null;

  unit_type: "unidad" | "kg" | "litro" | "metro";

  user: Types.ObjectId;

  isActive?: boolean;

  max_debt_limit?: mongoose.Types.Decimal128 | null;

  createdAt: Date;
  updatedAt: Date;

  __v: number;

  branchInventories: BranchInventoryAggregationResult[];

  totalStock: mongoose.Types.Decimal128;
}

export interface ProductFacetAggregationResult {
  metadata: Array<{
    total: number;
  }>;

  data: ProductAggregationResult[];
}

export interface GetProductsResult {
  products: ProductAggregationResult[];
  total: number;
  totalPages: number;
  currentPage: number;
}
