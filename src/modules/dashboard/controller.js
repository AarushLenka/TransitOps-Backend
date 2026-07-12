import { asyncHandler } from '../../utils/asyncHandler.js';
import { getKpis } from './service.js';
import { cachedGet, KEYS, TTL } from '../../lib/cache.js';

// Dashboard KPIs are 8 parallel counts over the fleet — a perfect cache target.
// The scope filters (type/region) are part of the cache key, and every write that
// could change the counts busts the dashboard namespace (see cache.js).
export const getKpisCtrl = asyncHandler(async (req, res) => {
  const kpis = await cachedGet(
    KEYS.dashboard(req.query),
    () => getKpis(req.query),
    TTL.dashboard,
  );
  res.json(kpis);
});
