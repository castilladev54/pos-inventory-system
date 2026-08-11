import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { invalidateCache, getOrSetCache, getCacheVersion, bumpCacheVersion, buildPaginatedKey, getBranchCacheVersion } from '../lib/redis.js';
import { createAdjustmentProcess } from '../services/adjustment.service.js';

export const createProduct = async (req: any, res: any) => {
  // stock_inicial es opcional. Si el usuario lo provee, se registra en el Kardex
  // atómicamente junto con la creación del producto (transacción ACID) en una sucursal específica.
  const { name, description, price, category, unit_type, barcode, stock_inicial, branch_id } = req.body;

  // Verificar si la categoría existe y pertenece al usuario
  const categoryExists = await Category.findOne({ _id: category, user: req.businessOwnerId });
  if (!categoryExists) {
    return res.status(400).json({
      success: false,
      message: "La categoría especificada no existe"
    });
  }

  // Si se envía barcode, verificar que no esté duplicado para este usuario
  if (barcode) {
    const barcodeExists = await Product.findOne({ barcode, user: req.businessOwnerId });
    if (barcodeExists) {
      return res.status(400).json({
        success: false,
        message: `El código de barras "${barcode}" ya está asignado al producto "${barcodeExists.name}"`
      });
    }
  }

  const initialStock = Number(stock_inicial) || 0;

  // ── Sin stock inicial: flujo simple sin transacción ──────────────────────────
  if (initialStock === 0) {
    try {
      const product = new Product({
        name, description, price,
        category, unit_type,
        ...(barcode ? { barcode } : {}),
        user: req.businessOwnerId
      });
      await product.save();
      await bumpCacheVersion('products', req.businessOwnerId);
      return res.status(201).json({ success: true, product });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Si hay stock inicial, la sucursal es obligatoria
  const branchId = req.branchId;
  if (!branchId) {
    return res.status(400).json({
      success: false,
      message: "Contexto de sucursal no válido o no autorizado (branch_id es requerido)."
    });
  }

  // ── Con stock inicial: transacción ACID (Producto + Kardex en un solo commit) ─
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Crear el producto (el stock se inicializará mediante el ajuste en BranchInventory)
    const [product] = await Product.create([{
      name, description, price,
      category, unit_type,
      ...(barcode ? { barcode } : {}),
      user: req.businessOwnerId
    }], { session });

    // 2. Registrar apertura de inventario en el Kardex y BranchInventory (comparte la sesión)
    await createAdjustmentProcess(
      req.actorId,
      req.businessOwnerId,
      branchId,
      product._id as any,
      initialStock,
      'initial_count',
      'Stock de apertura al crear el producto',
      session  // <-- sesión compartida, el servicio NO confirmará por su cuenta
    );

    // 3. Confirmar ambas operaciones en un solo commit atómico
    await session.commitTransaction();
    session.endSession();

    await product.populate('branchInventories');

    await bumpCacheVersion('products', req.businessOwnerId);

    return res.status(201).json({
      success: true,
      product,
      message: `Producto creado con stock inicial de ${initialStock} en la sucursal especificada.`
    });

  } catch (error: any) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProducts = async (req: Request | any, res: Response | any): Promise<void> => {
  try {
    const ownerId = req.businessOwnerId;
    const branchId = req.branchId;

    // 1. Extracción y sanitización de paginación
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Normalización de búsqueda
    const normalizedSearch = (req.query.search as string || "").trim().toLowerCase();
    const useCache = normalizedSearch.length === 0 || normalizedSearch.length >= 3;
    const ttl = normalizedSearch.length >= 3 ? 30 : 300;

    // 2. Validación estricta de ordenación (Whitelist)
    const allowedSortFields = ['createdAt', 'name', 'price', 'stock'];
    const sortBy = allowedSortFields.includes(req.query.sortBy as string) 
      ? (req.query.sortBy as string) 
      : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // 3. Llave de caché determinista con versión de sucursal (Lectura pasiva)
    const version = useCache ? await getBranchCacheVersion('products', ownerId, branchId) : null;
    const searchSlug = normalizedSearch
      ? `:s${Buffer.from(normalizedSearch).toString("base64url")}`
      : "";
    const cacheKey = useCache
      ? `products:v${version}:${ownerId}:${branchId}:p${page}:l${limit}${searchSlug}:sort:${sortBy}:${sortOrder}`
      : null;

    // Función de base de datos
    const fetchFromDB = async () => {
      // Construcción del Match inicial
      const matchStage: any = { user: new mongoose.Types.ObjectId(ownerId) };
      if (normalizedSearch) {
        const regex = new RegExp(normalizedSearch, "i");
        matchStage.$or = [
          { name: regex },
          { barcode: regex }
        ];
      }

      // Aggregation Pipeline
      const [result] = await Product.aggregate([
        { $match: matchStage },
        
        // Cruce aislado del inventario por sucursal
        {
          $lookup: {
            from: 'branchinventories',
            let: { productId: '$_id', activeBranchId: new mongoose.Types.ObjectId(branchId) },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$product_id', '$$productId'] },
                      { $eq: ['$branch_id', '$$activeBranchId'] }
                    ]
                  }
                }
              }
            ],
            as: 'inventoryData'
          }
        },
        {
          $unwind: {
            path: '$inventoryData',
            preserveNullAndEmptyArrays: true
          }
        },
        // Aplanamiento del stock determinista
        {
          $addFields: {
            stock: { $ifNull: ['$inventoryData.stock', 0] }
          }
        },
        
        // Cruce y proyección estricta de la categoría
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            pipeline: [
              { $project: { _id: 1, name: 1 } }
            ],
            as: 'category'
          }
        },
        {
          $unwind: {
            path: '$category',
            preserveNullAndEmptyArrays: true
          }
        },

        // Limpieza de datos intermedios
        { $project: { inventoryData: 0 } },

        // Ordenación dinámica segura
        { $sort: { [sortBy]: sortOrder } },

        // Facet para conteo y paginación paralela
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: skip }, { $limit: limit }]
          }
        }
      ]);

      const total = result?.metadata[0]?.total || 0;
      const products = result?.data || [];

      return {
        products,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: page
      };
    };

    // Cache logic
    let data, fromCache;
    if (useCache && cacheKey) {
      ({ data, fromCache } = await getOrSetCache(cacheKey, fetchFromDB, ttl));
    } else {
      data = await fetchFromDB();
      fromCache = false;
    }

    if (data.currentPage > data.totalPages && data.totalPages > 0) {
      return res.status(200).json({
        success: true,
        products: [],
        total: data.total,
        totalPages: data.totalPages,
        currentPage: page,
        fromCache
      });
    }

    res.status(200).json({
      success: true,
      products: data.products,
      total: data.total,
      totalPages: data.totalPages,
      currentPage: data.currentPage,
      fromCache
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const cacheKey = `product:${id}:${req.businessOwnerId}`;
    const { data: product, fromCache } = await getOrSetCache(cacheKey, () =>
      Product.findOne({ _id: id, user: req.businessOwnerId }).populate('category', 'name').lean()
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Producto no encontrado" });
    }

    res.status(200).json({ success: true, product, fromCache });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Buscar producto por código de barras ──────────────────────
export const getProductByBarcode = async (req, res) => {
  try {
    const { code } = req.params;
    const cacheKey = `barcode:${code}:${req.businessOwnerId}`;

    const { data: product, fromCache } = await getOrSetCache(cacheKey, () =>
      Product.findOne({ barcode: code, user: req.businessOwnerId })
        .populate('category', 'name')
        .lean()
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "No se encontró un producto con ese código de barras"
      });
    }

    res.status(200).json({ success: true, product, fromCache });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, unit_type, barcode, new_stock, stock_reason, branch_id } = req.body;

    // ── 0. Capturar barcode actual SOLO si viene en la request ────────────────
    // Sin esto, la invalidación del caché de barcode viejo sería imposible.
    let oldBarcode;
    if (barcode !== undefined) {
      const old = await Product.findOne({ _id: id, user: req.businessOwnerId }, 'barcode').lean();
      oldBarcode = old?.barcode;
    }

    // ── 1. Validar categoría si se envía ─────────────────────────────────────
    if (category) {
      const categoryExists = await Category.findOne({ _id: category, user: req.businessOwnerId });
      if (!categoryExists) {
        return res.status(400).json({ success: false, message: "La categoría especificada no existe" });
      }
    }

    // ── 2. Validar barcode duplicado si se envía ──────────────────────────────
    if (barcode) {
      const barcodeExists = await Product.findOne({ barcode, user: req.businessOwnerId, _id: { $ne: id } });
      if (barcodeExists) {
        return res.status(400).json({
          success: false,
          message: `El código de barras "${barcode}" ya está asignado al producto "${barcodeExists.name}"`
        });
      }
    }

    // ── 3. Construir payload de actualización (solo campos de metadata) ───────
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (category !== undefined) updateData.category = category;
    if (unit_type !== undefined) updateData.unit_type = unit_type;
    if (barcode !== undefined) updateData.barcode = barcode;

    // ── 4a. SIN corrección de stock → update simple ──────────────────────────
    if (new_stock === undefined) {
      const product = await Product.findOneAndUpdate(
        { _id: id, user: req.businessOwnerId },
        updateData,
        { returnDocument: 'after', runValidators: true }
      ).populate('category', 'name');

      if (!product) {
        return res.status(404).json({ success: false, message: "Producto no encontrado" });
      }

      // Invalidar caché paginada (bump de versión) + claves individuales
      const keysToInvalidate = [`product:${id}:${req.businessOwnerId}`];
      if (oldBarcode) keysToInvalidate.push(`barcode:${oldBarcode}:${req.businessOwnerId}`);
      if (barcode && barcode !== oldBarcode) keysToInvalidate.push(`barcode:${barcode}:${req.businessOwnerId}`);
      await Promise.all([
        bumpCacheVersion('products', req.businessOwnerId),
        invalidateCache(...keysToInvalidate)
      ]);

      return res.status(200).json({ success: true, product });
    }

    // Si hay corrección de stock, la sucursal es obligatoria
    const branchId = req.branchId;
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Contexto de sucursal no válido o no autorizado para realizar un ajuste de stock."
      });
    }

    // ── 4b. CON corrección de stock → transacción ACID única ─────────────────
    // Pasamos la sesión al servicio de ajuste para que metadata + stock + Kardex
    // se confirmen en UN SOLO commit atómico.
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 4b.1 Actualizar campos de metadata del producto (comparte sesión)
      const product = await Product.findOneAndUpdate(
        { _id: id, user: req.businessOwnerId },
        updateData,
        { returnDocument: 'after', runValidators: true, session }
      ).populate('category', 'name');

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: "Producto no encontrado" });
      }

      // 4b.2 Ajuste de stock + registro en Kardex dentro de la MISMA sesión.
      await createAdjustmentProcess(
        req.actorId,
        req.businessOwnerId,
        branchId,
        id,
        new_stock,
        stock_reason,
        'Corrección desde edición de producto',
        session
      );

      // 4b.3 Commit único: metadata + stock + Kardex son atómicos
      await session.commitTransaction();
      session.endSession();

      // Invalidar caché paginada (bump de versión) + claves individuales
      const keysToInvalidate = [
        `product:${id}:${req.businessOwnerId}`,
        `adjustments:${req.businessOwnerId}`,
      ];
      if (oldBarcode) keysToInvalidate.push(`barcode:${oldBarcode}:${req.businessOwnerId}`);
      if (barcode && barcode !== oldBarcode) keysToInvalidate.push(`barcode:${barcode}:${req.businessOwnerId}`);
      await Promise.all([
        bumpCacheVersion('products', req.businessOwnerId),
        invalidateCache(...keysToInvalidate)
      ]);

      return res.status(200).json({
        success: true,
        product,
        stockAdjusted: true,
        message: `Producto actualizado. Stock ajustado a ${new_stock} en la sucursal.`
      });

    } catch (innerError) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      throw innerError;
    }

  } catch (error) {
    console.error('updateProduct error:', error.message);
    const status = error.message.includes('igual al stock actual') ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOneAndDelete({ _id: id, user: req.businessOwnerId });

    if (!product) {
      return res.status(404).json({ success: false, message: "Producto no encontrado" });
    }

    // Invalidar caché paginada (bump de versión) + claves individuales
    const keysToInvalidate = [`product:${id}:${req.businessOwnerId}`];
    if (product.barcode) {
      keysToInvalidate.push(`barcode:${product.barcode}:${req.businessOwnerId}`);
    }
    await Promise.all([
      bumpCacheVersion('products', req.businessOwnerId),
      invalidateCache(...keysToInvalidate)
    ]);

    res.status(200).json({ success: true, message: "Producto eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
