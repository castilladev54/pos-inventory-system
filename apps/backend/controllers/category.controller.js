import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { getOrSetCache, invalidateCache, getCacheVersion, bumpCacheVersion, buildPaginatedKey } from '../lib/redis.js';

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const categoryExists = await Category.findOne({ name, user: req.businessOwnerId });
    if (categoryExists) {
      return res.status(400).json({ success: false, message: "La categoría ya existe" });
    }

    const category = new Category({ name, description, user: req.businessOwnerId });
    await category.save();

    await bumpCacheVersion('categories', req.businessOwnerId);

    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const version = await getCacheVersion('categories', req.businessOwnerId);
    const cacheKey = buildPaginatedKey('categories', version, page, limit, req.businessOwnerId);

    const { data, fromCache } = await getOrSetCache(cacheKey, async () => {
      const filter = { user: req.businessOwnerId };

      const [categories, total] = await Promise.all([
        Category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Category.countDocuments(filter)
      ]);

      return {
        categories,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    }, 600);

    res.status(200).json({
      success: true,
      categories: data.categories,
      total: data.total,
      totalPages: data.totalPages,
      currentPage: data.currentPage,
      fromCache
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `category:${id}:${req.businessOwnerId}`;
    const { data: category, fromCache } = await getOrSetCache(cacheKey, () =>
      Category.findOne({ _id: id, user: req.businessOwnerId }).lean()
    );

    if (!category) {
      return res.status(404).json({ success: false, message: "Categoría no encontrada" });
    }
    res.status(200).json({ success: true, category, fromCache });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};

    const category = await Category.findOneAndUpdate(
      { _id: id, user: req.businessOwnerId },
      { name, description },
      { returnDocument: 'after', runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ success: false, message: "Categoría no encontrada" });
    }

    await Promise.all([
      bumpCacheVersion('categories', req.businessOwnerId),
      invalidateCache(`category:${id}:${req.businessOwnerId}`)
    ]);

    res.status(200).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que la categoría tiene productos asociados (también scoped al tenant)
        const hasProducts = await Product.findOne({ category: id, user: req.businessOwnerId });
        if (hasProducts) {
            return res.status(400).json({ 
                success: false, 
                message: "No se puede eliminar la categoría porque tiene productos asociados. Elimínelos o reasígnelos primero." 
            });
        }

        // Verificación de ownership y eliminación en una sola operación atómica (elimina TOCTOU)
        const deleted = await Category.findOneAndDelete({ _id: id, user: req.businessOwnerId });
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Categoría no encontrada" });
        }

        await Promise.all([
          bumpCacheVersion('categories', req.businessOwnerId),
          invalidateCache(`category:${id}:${req.businessOwnerId}`)
        ]);

        res.status(200).json({ success: true, message: "Categoría eliminada correctamente" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
