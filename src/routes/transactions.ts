import { Router, Request, Response, NextFunction } from 'express';
import { query, body, param, validationResult } from 'express-validator';
import { TransactionService } from '../services/transactionService';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Pool } from 'pg';

const router = Router();
let transactionService: TransactionService;

export const initializeTransactionRoutes = (pool: Pool) => {
  transactionService = new TransactionService(pool);
  return router;
};

const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
    return;
  }
  next();
};

// GET /api/transactions/categories - list transaction categories
router.get(
  '/categories',
  authenticateToken,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const categories = await transactionService.getCategories();
      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      logger.error('Error in GET /transactions/categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction categories',
      });
    }
  }
);

// POST /api/transactions/categories - create category (admin)
router.post(
  '/categories',
  authenticateToken,
  requireAdmin,
  [
    body('id').isString().trim().notEmpty().withMessage('id is required'),
    body('name').isString().trim().notEmpty().withMessage('name is required'),
    body('type').isIn(['revenue', 'expense', 'adjustment']).withMessage('type must be revenue, expense, or adjustment'),
    body('description').optional().trim().isString().isLength({ max: 10000 }),
    body('allowsNegative').optional().isBoolean(),
    body('signage').optional().isIn(['positive', 'negative', 'both']),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, name, type, description, allowsNegative, signage } = req.body;
      const category = await transactionService.createCategory({
        id,
        name,
        type,
        description,
        allowsNegative,
        signage,
      });
      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created',
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        res.status(409).json({ success: false, error: 'A category with this id already exists.' });
        return;
      }
      logger.error('Error in POST /transactions/categories:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to create category',
      });
    }
  }
);

// PUT /api/transactions/categories/:id - update category (admin)
router.put(
  '/categories/:id',
  authenticateToken,
  requireAdmin,
  [
    body('name').optional().trim().isString().notEmpty(),
    body('type').optional().isIn(['revenue', 'expense', 'adjustment']),
    body('description').optional().trim().isString().isLength({ max: 10000 }),
    body('allowsNegative').optional().isBoolean(),
    body('signage').optional().isIn(['positive', 'negative', 'both']),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const { name, type, description, allowsNegative, signage } = req.body;
      const category = await transactionService.updateCategory(id, {
        name,
        type,
        description,
        allowsNegative,
        signage,
      });
      if (!category) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }
      res.json({
        success: true,
        data: category,
        message: 'Category updated',
      });
    } catch (error) {
      logger.error('Error in PUT /transactions/categories/:id:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update category',
      });
    }
  }
);

// DELETE /api/transactions/categories/:id - delete category (admin, non-core only)
router.delete(
  '/categories/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const deleted = await transactionService.deleteCategory(id);
      if (!deleted) {
        res.status(400).json({
          success: false,
          error: 'Category not found or is a core category and cannot be deleted.',
        });
        return;
      }
      res.json({
        success: true,
        message: 'Category deleted',
      });
    } catch (error) {
      logger.error('Error in DELETE /transactions/categories/:id:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete category',
      });
    }
  }
);

// GET /api/transactions - list horse revenue/expense items with optional filters
router.get(
  '/',
  authenticateToken,
  [
    query('horseId').optional().isInt({ min: 1 }),
    query('categoryId').optional().isString().trim(),
    query('type').optional().isIn(['revenue', 'expense', 'adjustment']),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const horseId = req.query.horseId ? parseInt(req.query.horseId as string) : undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const type = req.query.type as 'revenue' | 'expense' | 'adjustment' | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      const items = await transactionService.getTransactions({
        horseId,
        categoryId,
        type,
        dateFrom,
        dateTo,
      });

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      logger.error('Error in GET /transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
      });
    }
  }
);

// POST /api/transactions - add one or more horse revenue/expense items (admin)
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.horseId').isInt({ min: 1 }).withMessage('horseId is required and must be a positive integer'),
    body('items.*.categoryId').isString().trim().notEmpty().withMessage('categoryId is required'),
    body('items.*.date').isISO8601().withMessage('date must be a valid date'),
    body('items.*.amount').isFloat().withMessage('amount is required and must be a number'),
    body('items.*.notes').optional().isString().trim(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const items = req.body.items as Array<{
        horseId: number;
        categoryId: string;
        date: string;
        amount: number;
        notes?: string;
      }>;

      const added = await transactionService.addTransactions(
        items.map((i) => ({
          horseId: i.horseId,
          categoryId: i.categoryId,
          date: i.date.slice(0, 10),
          amount: i.amount,
          notes: i.notes,
        })),
        userId
      );

      res.status(201).json({
        success: true,
        data: added,
        message: `Added ${added.length} transaction(s)`,
      });
    } catch (error: any) {
      logger.error('Error in POST /transactions:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to add transactions',
      });
    }
  }
);

// PUT /api/transactions/:id - update one horse revenue/expense line (admin)
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('horseId').isInt({ min: 1 }).withMessage('horseId is required'),
    body('categoryId').isString().trim().notEmpty().withMessage('categoryId is required'),
    body('date').isString().trim().notEmpty().withMessage('date is required'),
    body('amount').isFloat().withMessage('amount must be a number'),
    body('notes').optional().isString().trim(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { horseId, categoryId, date, amount, notes } = req.body as {
        horseId: number;
        categoryId: string;
        date: string;
        amount: number;
        notes?: string;
      };

      const updated = await transactionService.updateTransaction(id, {
        horseId,
        categoryId,
        date: date.slice(0, 10),
        amount,
        notes,
      });

      if (!updated) {
        res.status(404).json({ success: false, error: 'Financial item not found' });
        return;
      }

      res.json({
        success: true,
        data: updated,
        message: 'Financial item updated',
      });
    } catch (error: any) {
      logger.error('Error in PUT /transactions/:id:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to update financial item',
      });
    }
  }
);

// DELETE /api/transactions/:id - delete one horse revenue/expense line (admin)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await transactionService.deleteTransaction(id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Financial item not found' });
        return;
      }
      res.json({ success: true, message: 'Financial item deleted' });
    } catch (error) {
      logger.error('Error in DELETE /transactions/:id:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete financial item',
      });
    }
  }
);

export { router as transactionRoutes };
