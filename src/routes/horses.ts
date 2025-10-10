import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { HorseService } from '../services/horseService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Pool } from 'pg';

const router = Router();

// Initialize horse service
let horseService: HorseService;

export const initializeHorseRoutes = (pool: Pool) => {
  horseService = new HorseService(pool);
  return router;
};

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
};

// Get all horses with optional filtering and pagination
router.get('/', 
  authenticateToken,
  [
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['new', 'old', 'available', 'sold_out']),
    query('age').optional().isString(),
    query('gait').optional().isIn(['trotter', 'pacer']),
    query('jurisdiction').optional().isString(),
    query('sex').optional().isIn(['colt', 'filly', 'gelding', 'mare', 'stallion']),
    query('sire').optional().isString().trim(),
    query('trainer').optional().isString().trim(),
    query('horseType').optional().isIn(['standardbred', 'thoroughbred', 'quarter_horse', 'arabian', 'other']),
    query('priceRange').optional().isIn(['0-50', '51-100', '101-200', '200+']),
    query('sortBy').optional().isIn(['name', 'age', 'price_per_percent', 'shares_remaining', 'earnings', 'wins', 'purchase_date']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = {
        search: req.query.search as string,
        status: req.query.status as string,
        age: req.query.age as string,
        gait: req.query.gait as string,
        jurisdiction: req.query.jurisdiction as string,
        sex: req.query.sex as string,
        sire: req.query.sire as string,
        trainer: req.query.trainer as string,
        horseType: req.query.horseType as string,
        priceRange: req.query.priceRange as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const result = await horseService.getHorses(filters);
      
      res.json({
        success: true,
        data: result.horses,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      logger.error('Error in GET /horses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch horses'
      });
    }
  }
);

// Get a single horse by ID
router.get('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid horse ID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const horseId = parseInt(req.params.id);
      const horse = await horseService.getHorseById(horseId);
      
      if (!horse) {
        res.status(404).json({
          success: false,
          error: 'Horse not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: horse
      });
    } catch (error) {
      logger.error('Error in GET /horses/:id:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch horse'
      });
    }
  }
);

// Create a new horse
router.post('/',
  authenticateToken,
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Name is required and must be 1-255 characters'),
    body('sire').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Sire is required and must be 1-255 characters'),
    body('dam').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Dam is required and must be 1-255 characters'),
    body('sex').isIn(['colt', 'filly', 'gelding', 'mare', 'stallion']).withMessage('Invalid sex'),
    body('age').isInt({ min: 1, max: 30 }).withMessage('Age must be between 1 and 30'),
    body('ageCategory').isIn(['1YO', '2YO', '3YO', '4YO', '5YO', '6YO', '7YO', '8YO+']).withMessage('Invalid age category'),
    body('gait').isIn(['trotter', 'pacer']).withMessage('Invalid gait'),
    body('status').isIn(['new', 'old']).withMessage('Invalid status'),
    body('horseType').isIn(['standardbred', 'thoroughbred', 'quarter_horse', 'arabian', 'other']).withMessage('Invalid horse type'),
    body('jurisdiction').isArray({ min: 1 }).withMessage('At least one jurisdiction is required'),
    body('jurisdiction.*').isString().trim().isLength({ min: 1, max: 10 }).withMessage('Invalid jurisdiction'),
    body('trainer').optional().isString().trim().isLength({ max: 255 }),
    body('stableLocation').optional().isString().trim().isLength({ max: 255 }),
    body('purchaseDate').isISO8601().withMessage('Invalid purchase date'),
    body('purchasePrice').isFloat({ min: 0 }).withMessage('Purchase price must be a positive number'),
    body('currentValue').optional().isFloat({ min: 0 }).withMessage('Current value must be a positive number'),
    body('pricePerPercent').isFloat({ min: 0 }).withMessage('Price per percent must be a positive number'),
    body('initialShares').optional().isInt({ min: 1, max: 100 }).withMessage('Initial shares must be between 1 and 100'),
    body('currentShares').optional().isInt({ min: 0, max: 100 }).withMessage('Current shares must be between 0 and 100'),
    body('wins').optional().isInt({ min: 0 }).withMessage('Wins must be a non-negative integer'),
    body('places').optional().isInt({ min: 0 }).withMessage('Places must be a non-negative integer'),
    body('shows').optional().isInt({ min: 0 }).withMessage('Shows must be a non-negative integer'),
    body('races').optional().isInt({ min: 0 }).withMessage('Races must be a non-negative integer'),
    body('earnings').optional().isFloat({ min: 0 }).withMessage('Earnings must be a non-negative number'),
    body('imageUrl').optional().isURL().withMessage('Invalid image URL'),
    body('description').optional().isString().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters')
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const horse = await horseService.createHorse(req.body, userId);
      
      res.status(201).json({
        success: true,
        data: horse,
        message: 'Horse created successfully'
      });
    } catch (error) {
      logger.error('Error in POST /horses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create horse'
      });
    }
  }
);

// Update an existing horse
router.put('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid horse ID'),
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('sire').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('dam').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('sex').optional().isIn(['colt', 'filly', 'gelding', 'mare', 'stallion']),
    body('age').optional().isInt({ min: 1, max: 30 }),
    body('ageCategory').optional().isIn(['1YO', '2YO', '3YO', '4YO', '5YO', '6YO', '7YO', '8YO+']),
    body('gait').optional().isIn(['trotter', 'pacer']),
    body('status').optional().isIn(['new', 'old']),
    body('horseType').optional().isIn(['standardbred', 'thoroughbred', 'quarter_horse', 'arabian', 'other']),
    body('jurisdiction').optional().isArray({ min: 1 }),
    body('jurisdiction.*').optional().isString().trim().isLength({ min: 1, max: 10 }),
    body('trainer').optional().isString().trim().isLength({ max: 255 }),
    body('stableLocation').optional().isString().trim().isLength({ max: 255 }),
    body('purchaseDate').optional().isISO8601(),
    body('purchasePrice').optional().isFloat({ min: 0 }),
    body('currentValue').optional().isFloat({ min: 0 }),
    body('pricePerPercent').optional().isFloat({ min: 0 }),
    body('initialShares').optional().isInt({ min: 1, max: 100 }),
    body('currentShares').optional().isInt({ min: 0, max: 100 }),
    body('wins').optional().isInt({ min: 0 }),
    body('places').optional().isInt({ min: 0 }),
    body('shows').optional().isInt({ min: 0 }),
    body('races').optional().isInt({ min: 0 }),
    body('earnings').optional().isFloat({ min: 0 }),
    body('imageUrl').optional().isURL(),
    body('description').optional().isString().trim().isLength({ max: 1000 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const horseId = parseInt(req.params.id);
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const horse = await horseService.updateHorse(horseId, req.body, userId);
      
      if (!horse) {
        res.status(404).json({
          success: false,
          error: 'Horse not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: horse,
        message: 'Horse updated successfully'
      });
    } catch (error) {
      logger.error('Error in PUT /horses/:id:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update horse'
      });
    }
  }
);

// Delete a horse
router.delete('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid horse ID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const horseId = parseInt(req.params.id);
      const deleted = await horseService.deleteHorse(horseId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Horse not found'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Horse deleted successfully'
      });
    } catch (error) {
      logger.error('Error in DELETE /horses/:id:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete horse'
      });
    }
  }
);

// Get horses owned by a specific member
router.get('/member/:memberId',
  authenticateToken,
  [
    param('memberId').isInt({ min: 1 }).withMessage('Invalid member ID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const memberId = parseInt(req.params.memberId);
      const horses = await horseService.getHorsesByMember(memberId);
      
      res.json({
        success: true,
        data: horses
      });
    } catch (error) {
      logger.error('Error in GET /horses/member/:memberId:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch member horses'
      });
    }
  }
);

// Purchase shares in a horse
router.post('/:id/purchase',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid horse ID'),
    body('memberId').isInt({ min: 1 }).withMessage('Invalid member ID'),
    body('percentage').isFloat({ min: 0.01, max: 100 }).withMessage('Percentage must be between 0.01 and 100')
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const horseId = parseInt(req.params.id);
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const ownership = await horseService.purchaseShares(horseId, req.body, userId);
      
      res.status(201).json({
        success: true,
        data: ownership,
        message: 'Shares purchased successfully'
      });
    } catch (error) {
      logger.error('Error in POST /horses/:id/purchase:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to purchase shares'
      });
    }
  }
);

// Get horse statistics
router.get('/stats/overview',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await horseService.getHorseStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error in GET /horses/stats/overview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch horse statistics'
      });
    }
  }
);

// Update horse performance
router.patch('/:id/performance',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid horse ID'),
    body('wins').optional().isInt({ min: 0 }),
    body('places').optional().isInt({ min: 0 }),
    body('shows').optional().isInt({ min: 0 }),
    body('races').optional().isInt({ min: 0 }),
    body('earnings').optional().isFloat({ min: 0 }),
    body('updateDate').optional().isISO8601(),
    body('notes').optional().isString().trim().isLength({ max: 500 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const horseId = parseInt(req.params.id);
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const performanceUpdate = await horseService.updatePerformance(horseId, req.body, userId);
      
      res.json({
        success: true,
        data: performanceUpdate,
        message: 'Performance updated successfully'
      });
    } catch (error) {
      logger.error('Error in PATCH /horses/:id/performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update performance'
      });
    }
  }
);

// Update horse financials
router.patch('/:id/financials',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid horse ID'),
    body('currentValue').optional().isFloat({ min: 0 }),
    body('pricePerPercent').optional().isFloat({ min: 0 }),
    body('sharesRemaining').optional().isInt({ min: 0 }),
    body('updateDate').optional().isISO8601(),
    body('notes').optional().isString().trim().isLength({ max: 500 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const horseId = parseInt(req.params.id);
      const userId = req.user?.user_id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const financialUpdate = await horseService.updateFinancials(horseId, req.body, userId);
      
      res.json({
        success: true,
        data: financialUpdate,
        message: 'Financials updated successfully'
      });
    } catch (error) {
      logger.error('Error in PATCH /horses/:id/financials:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update financials'
      });
    }
  }
);

export { router as horseRoutes };
