import { Router, Request, Response, NextFunction } from 'express';
import { query, body, param, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { MemberActivityService } from '../services/memberActivityService';
import { authenticateToken, requireRole, isStaffUser } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
let service: MemberActivityService;

const requireStaff = requireRole(['admin', 'finance', 'manager']);

export const initializeMemberActivityRoutes = (pool: Pool) => {
  service = new MemberActivityService(pool);
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

const ACTIVITY_TYPES = [
  'direct_purchase', 'direct_sale', 'marketplace_purchase', 'marketplace_sale',
  'deposit', 'withdrawal', 'adjustment', 'prior_balance',
  'online_service_fee', 'marketplace_processing_fee',
];

// Staff: optional memberId filter. Members: always scoped to their own user id.
router.get(
  '/',
  authenticateToken,
  [
    query('memberId').optional().isInt({ min: 1 }),
    query('horseId').optional().isInt({ min: 1 }),
    query('activityType').optional().isIn(ACTIVITY_TYPES),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const staff = isStaffUser(req.user);
      if (!staff && req.user.role_name !== 'member') {
        res.status(403).json({ success: false, error: 'Insufficient permissions' });
        return;
      }

      const memberId = staff
        ? (req.query.memberId ? parseInt(req.query.memberId as string, 10) : undefined)
        : req.user.user_id;

      const items = await service.getActivities({
        memberId,
        horseId: req.query.horseId ? parseInt(req.query.horseId as string, 10) : undefined,
        activityType: req.query.activityType as any,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      });
      res.json({ success: true, data: items });
    } catch (error) {
      logger.error('GET /member-activities:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch member activities' });
    }
  }
);

router.post(
  '/',
  authenticateToken,
  requireStaff,
  [
    body('memberId').isInt({ min: 1 }),
    body('activityType').isIn(ACTIVITY_TYPES),
    body('horseId').optional({ nullable: true }).isInt({ min: 1 }),
    body('activityDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('activityDate must be YYYY-MM-DD'),
    body('percentage').optional({ nullable: true }).isFloat({ min: 0 }),
    body('amount').isFloat(),
    body('fee').optional({ nullable: true }).isFloat(),
    body('notes').optional({ nullable: true, checkFalsy: true }).isString().trim(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }
      const created = await service.createActivity(req.body, userId);
      res.status(201).json({ success: true, data: created, message: 'Activity created' });
    } catch (error: any) {
      logger.error('POST /member-activities:', error);
      res.status(500).json({ success: false, error: error?.message || 'Failed to create activity' });
    }
  }
);

router.post(
  '/marketplace-transfer',
  authenticateToken,
  [
    body('buyerId').isInt({ min: 1 }),
    body('sellerId').isInt({ min: 1 }),
    body('horseId').isInt({ min: 1 }),
    body('percentage').isFloat({ min: 0.01 }),
    body('amount').isFloat({ min: 0 }),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }
      const { buyerId, sellerId, horseId, percentage, amount } = req.body;
      await service.logMarketplaceTransfer({
        buyerId,
        sellerId,
        horseId,
        percentage,
        amount,
        createdBy: userId,
      });
      res.status(201).json({ success: true, message: 'Marketplace transfer logged' });
    } catch (error: unknown) {
      logger.error('POST /member-activities/marketplace-transfer:', error);
      const msg = error instanceof Error ? error.message : 'Failed to log transfer';
      res.status(500).json({ success: false, error: msg });
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
      const deleted = await service.deleteActivity(parseInt(req.params.id, 10));
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Activity not found' });
        return;
      }
      res.json({ success: true, message: 'Activity deleted' });
    } catch (error) {
      logger.error('DELETE /member-activities/:id:', error);
      res.status(500).json({ success: false, error: 'Failed to delete activity' });
    }
  }
);

export { router as memberActivityRoutes };
