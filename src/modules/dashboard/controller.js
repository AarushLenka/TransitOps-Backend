import { asyncHandler } from '../../utils/asyncHandler.js';
import { getKpis } from './service.js';

export const getKpisCtrl = asyncHandler(async (req, res) => {
  res.json(await getKpis(req.query));
});
