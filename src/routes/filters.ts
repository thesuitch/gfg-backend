import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { FilterService, filterTypeFromPath, FilterType } from '../services/filterService';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
let service: FilterService;

const requireStaff = requireRole(['admin', 'finance', 'manager']);

export const initializeFilterRoutes = (pool: Pool) => {
  service = new FilterService(pool);
  return router;
};

const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    return;
  }
  next();
};

const typeParam = param('type').custom((value) => {
  if (!filterTypeFromPath(value)) throw new Error('Invalid filter type');
  return true;
});

const resolveType = (req: Request): FilterType => {
  const type = filterTypeFromPath(req.params.type);
  if (!type) throw new Error('Invalid filter type');
  return type;
};

const sendServiceError = (res: Response, error: unknown, fallback: string) => {
  const err = error as Error & { code?: string; usage?: unknown };
  if (err.code === 'NOT_FOUND') {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: err.message });
    return;
  }
  if (err.code === 'DUPLICATE') {
    res.status(409).json({ success: false, error: 'DUPLICATE', message: err.message });
    return;
  }
  if (err.code === 'IN_USE') {
    res.status(409).json({
      success: false,
      error: 'IN_USE',
      message: err.message,
      data: err.usage,
    });
    return;
  }
  if (err.code === 'INVALID_REASSIGN') {
    res.status(400).json({ success: false, error: 'INVALID_REASSIGN', message: err.message });
    return;
  }
  logger.error(fallback, error);
  res.status(500).json({ success: false, error: fallback });
};

router.get('/', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.getAllActive();
    res.json({ success: true, data });
  } catch (error) {
    sendServiceError(res, error, 'Failed to fetch filter options');
  }
});

router.get(
  '/:type/:id/usage',
  authenticateToken,
  requireStaff,
  [typeParam, param('id').isString().trim().notEmpty()],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const type = resolveType(req);
      const usage = await service.getUsage(type, req.params.id);
      res.json({ success: true, data: usage });
    } catch (error) {
      sendServiceError(res, error, 'Failed to fetch filter usage');
    }
  }
);

router.get(
  '/:type',
  authenticateToken,
  [typeParam],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const type = resolveType(req);
      const data = await service.getByType(type);
      res.json({ success: true, data });
    } catch (error) {
      sendServiceError(res, error, 'Failed to fetch filter options');
    }
  }
);

router.post(
  '/:type',
  authenticateToken,
  requireStaff,
  [
    typeParam,
    body('value').isString().trim().isLength({ min: 1, max: 255 }),
    body('label').optional().isString().trim().isLength({ max: 255 }),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const type = resolveType(req);
      const data = await service.create(type, {
        value: req.body.value,
        label: req.body.label ?? req.body.value,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      sendServiceError(res, error, 'Failed to create filter option');
    }
  }
);

router.put(
  '/:type/:id',
  authenticateToken,
  requireStaff,
  [
    typeParam,
    param('id').isString().trim().notEmpty(),
    body('value').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('label').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('isActive').optional().isBoolean(),
    body('order').optional().isInt({ min: 0 }),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const type = resolveType(req);
      const data = await service.update(type, req.params.id, {
        value: req.body.value,
        label: req.body.label,
        isActive: req.body.isActive,
        order: req.body.order,
      });
      res.json({ success: true, data });
    } catch (error) {
      sendServiceError(res, error, 'Failed to update filter option');
    }
  }
);

router.delete(
  '/:type/:id',
  authenticateToken,
  requireStaff,
  [
    typeParam,
    param('id').isString().trim().notEmpty(),
    query('reassignToId').optional().isString().trim(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const type = resolveType(req);
      const reassignToId =
        typeof req.query.reassignToId === 'string'
          ? req.query.reassignToId
          : typeof req.body?.reassignToId === 'string'
            ? req.body.reassignToId
            : undefined;
      await service.delete(type, req.params.id, reassignToId);
      res.json({ success: true });
    } catch (error) {
      sendServiceError(res, error, 'Failed to delete filter option');
    }
  }
);
