import { ExchangeRate } from '../models/ExchangeRate.js';
import { getOrSetCache, invalidateCache } from '../lib/redis.js';

const VE_OFFSET_MS = 4 * 60 * 60 * 1000;

function getStartOfDayVE(dateInput = null) {
  const nowVE = new Date((dateInput ? new Date(dateInput).getTime() : Date.now()) - VE_OFFSET_MS);
  const y = nowVE.getUTCFullYear();
  const m = nowVE.getUTCMonth();
  const d = nowVE.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) + VE_OFFSET_MS);
}

export const setDailyRate = async (req, res) => {
  try {
    const { rate, date } = req.body;
    const ownerId = req.businessOwnerId; // from injectBusinessContext

    const startOfDay = getStartOfDayVE(date);

    const exchangeRate = await ExchangeRate.findOneAndUpdate(
      { customer_id: ownerId, date: startOfDay },
      { rate, is_manual_override: true },
      { returnDocument: 'after', upsert: true }
    );

    await invalidateCache(`rate:today:${ownerId}`, `rate:history:${ownerId}:30`);

    res.status(200).json({ success: true, message: 'Tasa actualizada correctamente', exchangeRate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDailyRate = async (req, res) => {
  try {
    const ownerId = req.businessOwnerId;
    const cacheKey = `rate:today:${ownerId}`;

    const { data, fromCache } = await getOrSetCache(cacheKey, async () => {
      // Intentamos traer la tasa más reciente registrada por este negocio
      const latestRate = await ExchangeRate.findOne({ customer_id: ownerId })
        .sort({ date: -1 })
        .lean();
      return latestRate || null;
    }, 3600);

    res.status(200).json({ success: true, rate: data, fromCache });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRateHistory = async (req, res) => {
  try {
    const ownerId = req.businessOwnerId;
    const limit = parseInt(req.query.limit) || 30;

    const cacheKey = `rate:history:${ownerId}:${limit}`;
    const { data, fromCache } = await getOrSetCache(cacheKey, async () => {
      return await ExchangeRate.find({ customer_id: ownerId })
        .sort({ date: -1 })
        .limit(limit)
        .lean();
    }, 3600);

    res.status(200).json({ success: true, history: data, fromCache });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
