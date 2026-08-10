import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { invalidateCache, getOrSetCache, getCacheVersion, bumpCacheVersion, buildPaginatedKey } from '../lib/redis.js';
import { createAdjustmentProcess } from '../services/adjustment.service.js';

export const createProduct = async (req, res) => {
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
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Si hay stock inicial, la sucursal es obligatoria
  const branchId = branch_id || req.branchId;
  if (!branchId) {
    return res.status(400).json({
      success: false,
      message: "branch_id es requerido para establecer un stock inicial."
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
      product._id,
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

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const getProducts = async (req, res) => {
  try {
    // ─── Parámetros de paginación con defaults seguros ────────────────
    const page = Math.max(1, parseInt(req.query.page) || 1);
    // Subimos el cap a 5000 para soportar fetchAllForPOS (carga masiva del POS)
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // ─── CORRECCIÓN A: Normalización antes de todo ───────────────────
    // trim() + toLowerCase() garantiza que "Harina ", "HARINA" y "harina"
    // comparten el mismo slot de caché (o el mismo bypass de corto).
    const normalizedSearch = (req.query.search || "").trim().toLowerCase();

    // ─── CORRECCIÓN B: Bypass de caché para búsquedas cortas ─────────
    // 1–2 caracteres generan demasiadas claves efímeras ("h", "ha", …).
    // Para esos casos vamos directo a MongoDB sin tocar Redis.
    const useCache = normalizedSearch.length === 0 || normalizedSearch.length >= 3;

    // ─── CORRECCIÓN C: TTL diferenciado ──────────────────────────────
    // Búsquedas son volátiles → 30 s. Listados sin búsqueda → 5 min.
    const ttl = normalizedSearch.length >= 3 ? 30 : 300;

    // ─── Cache key versionada ─────────────────────────────────────────
    const version = useCache ? await getCacheVersion('products', req.businessOwnerId) : null;
    const searchSlug = normalizedSearch
      ? `:s${Buffer.from(normalizedSearch).toString("base64url")}`
      : "";
    const cacheKey = useCache
      ? buildPaginatedKey('products', version, page, limit, req.businessOwnerId) + searchSlug
      : null;

    // ─── Función de consulta compartida (usada con o sin caché) ──────
    const fetchFromDB = async () => {
      const filter = { user: req.businessOwnerId };

      if (normalizedSearch) {
        // La regex ya corre sobre texto normalizado; "i" es redundante pero
        // inofensivo y cubre diferencias de acento en algunos drivers.
        const regex = new RegExp(normalizedSearch, "i");
        filter.$or = [{ name: regex }, { barcode: regex }];
      }

      const [products, total] = await Promise.all([
        Product.find(filter)
          .populate('category', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter)
      ]);

      return {
        products,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        currentPage: page
      };
    };

    // ─── Decidir si ir a Redis o directo a MongoDB ────────────────────
    let data, fromCache;
    if (useCache) {
      ({ data, fromCache } = await getOrSetCache(cacheKey, fetchFromDB, ttl));
    } else {
      // Búsqueda de 1–2 chars: sin Redis, sin drama.
      data = await fetchFromDB();
      fromCache = false;
    }

    // Protección: si la página pedida no existe, devolver vacío sin error
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req, res) => {
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
    const branchId = branch_id || req.branchId;
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "branch_id es requerido para realizar un ajuste de stock."
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
