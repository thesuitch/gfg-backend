import { Router, Request, Response, NextFunction } from 'express';
import { query, body, param, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { UpdateService } from '../services/updateService';
import { authenticateToken, requireRole, isStaffUser } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
let service: UpdateService;

const requireStaff = requireRole(['admin', 'finance', 'manager']);

export const initializeUpdateRoutes = (pool: Pool) => {
  service = new UpdateService(pool);
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

router.get(
  '/',
  authenticateToken,
  [
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('year').optional().isInt({ min: 2000, max: 2100 }),
    query('horseId').optional().isInt({ min: 1 }),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: {
        month?: number;
        year?: number;
        horseId?: number;
        memberHorseIds?: number[];
      } = {};

      if (req.query.month) filters.month = parseInt(req.query.month as string, 10);
      if (req.query.year) filters.year = parseInt(req.query.year as string, 10);
      if (req.query.horseId) filters.horseId = parseInt(req.query.horseId as string, 10);

      if (!isStaffUser(req.user)) {
        const userId = req.user?.user_id;
        if (!userId) {
          res.status(401).json({ success: false, error: 'Not authenticated' });
          return;
        }
        filters.memberHorseIds = await service.getMemberHorseIds(userId);
      }

      const updates = await service.getUpdates(filters);
      res.json({ success: true, data: updates });
    } catch (error) {
      logger.error('GET /updates:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch updates' });
    }
  }
);

router.post(
  '/',
  authenticateToken,
  requireStaff,
  [
    body('title').isString().trim().notEmpty(),
    body('description').isString().trim().notEmpty(),
    body('type').isIn(['news', 'activity']),
    body('horseId').optional({ nullable: true }).isInt({ min: 1 }),
    body('isGeneral').isBoolean(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }
      const created = await service.createUpdate(req.body, userId);
      res.status(201).json({ success: true, data: created, message: 'Update created' });
    } catch (error: any) {
      logger.error('POST /updates:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to create update' });
    }
  }
);

router.delete(
  '/:id',
  authenticateToken,
  requireStaff,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const deleted = await service.deleteUpdate(parseInt(req.params.id, 10));
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Update not found' });
        return;
      }
      res.json({ success: true, message: 'Update deleted' });
    } catch (error) {
      logger.error('DELETE /updates/:id:', error);
      res.status(500).json({ success: false, error: 'Failed to delete update' });
    }
  }
);

router.post(
  '/:id/email',
  authenticateToken,
  requireStaff,
  [
    param('id').isInt({ min: 1 }),
    body('audience').isIn(['all', 'horse_owners']),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await service.emailUpdate(
        parseInt(req.params.id, 10),
        req.body.audience
      );
      res.json({
        success: true,
        data: result,
        message: result.sent > 0
          ? `Update emailed to ${result.sent} member(s)`
          : 'No recipients found for this audience',
      });
    } catch (error: any) {
      logger.error('POST /updates/:id/email:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to send email' });
    }
  }
);

export { router as updateRoutes };
