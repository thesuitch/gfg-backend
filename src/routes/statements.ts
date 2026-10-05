import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { StatementService } from '../services/statementService';
import { authenticateToken, requireRole, isStaffUser } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
let service: StatementService;

const requireStaff = requireRole(['admin', 'finance', 'manager']);

export const initializeStatementRoutes = (pool: Pool) => {
  service = new StatementService(pool);
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

const sendError = (res: Response, error: unknown, fallback: string) => {
  const err = error as Error & { code?: string };
  const map: Record<string, number> = {
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    INVALID_PERIOD: 400,
    NO_EMAIL: 400,
  };
  const status = err.code && map[err.code] ? map[err.code] : 500;
  if (status === 500) logger.error(fallback, error);
  res.status(status).json({
    success: false,
    error: err.code || 'ERROR',
    message: err.message || fallback,
  });
};

router.post(
  '/generate',
  authenticateToken,
  requireStaff,
  [
    body('year').isInt({ min: 2000, max: 2100 }),
    body('month').isInt({ min: 1, max: 12 }),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.generatePeriod(
        Number(req.body.year),
        Number(req.body.month),
        req.user!.user_id
      );
      res.status(201).json({ success: true, data, message: 'Statements generated' });
    } catch (error) {
      sendError(res, error, 'Failed to generate statements');
    }
  }
);

router.get(
  '/',
  authenticateToken,
  [
    query('memberId').optional().isInt({ min: 1 }),
    query('year').optional().isInt({ min: 2000, max: 2100 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('status').optional().isIn(['paid', 'unpaid']),
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
      const status = req.query.status as string | undefined;
      const data = await service.listStatements({
        memberId,
        year: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
        month: req.query.month ? parseInt(req.query.month as string, 10) : undefined,
        isPaid: status === 'paid' ? true : status === 'unpaid' ? false : undefined,
      });
      res.json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to fetch statements');
    }
  }
);

router.post(
  '/email-all',
  authenticateToken,
  requireStaff,
  [body('ids').isArray({ min: 1 }), body('ids.*').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const ids = (req.body.ids as number[]).map(Number);
      let sent = 0;
      const failures: number[] = [];
      for (const id of ids) {
        try {
          await service.emailStatement(id, 'member');
          sent += 1;
        } catch {
          failures.push(id);
        }
      }
      res.json({ success: failures.length === 0, data: { sent, failed: failures.length } });
    } catch (error) {
      sendError(res, error, 'Failed to email statements');
    }
  }
);

router.get(
  '/:id',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await service.getStatement(id);
      if (!data) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Statement not found' });
        return;
      }
      if (!isStaffUser(req.user) && String(data.memberId) !== String(req.user!.user_id)) {
        res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Insufficient permissions' });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to fetch statement');
    }
  }
);

router.get(
  '/:id/pdf',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await service.getStatement(id);
      if (!data) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Statement not found' });
        return;
      }
      if (!isStaffUser(req.user) && String(data.memberId) !== String(req.user!.user_id)) {
        res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Insufficient permissions' });
        return;
      }
      const html = service.renderHtml(data);
      const filename = `${data.invoiceNumber}.html`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(html);
    } catch (error) {
      sendError(res, error, 'Failed to export statement');
    }
  }
);

router.post(
  '/:id/mark-paid',
  authenticateToken,
  requireStaff,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.markPaid(parseInt(req.params.id, 10), req.user!.user_id);
      res.json({ success: true, data, message: 'Statement marked as paid' });
    } catch (error) {
      sendError(res, error, 'Failed to mark statement paid');
    }
  }
);

router.post(
  '/:id/email',
  authenticateToken,
  requireStaff,
  [
    param('id').isInt({ min: 1 }),
    body('recipient').isIn(['member', 'admin']),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await service.emailStatement(parseInt(req.params.id, 10), req.body.recipient);
      res.json({ success: true, message: 'Statement emailed' });
    } catch (error) {
      sendError(res, error, 'Failed to email statement');
    }
  }
);
