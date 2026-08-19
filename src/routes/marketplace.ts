import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Pool } from 'pg';
import { MarketplaceService } from '../services/marketplaceService';
import { authenticateToken, isStaffUser } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
let service: MarketplaceService;

export const initializeMarketplaceRoutes = (pool: Pool) => {
  service = new MarketplaceService(pool);
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
    NO_OWNERSHIP: 400,
    INVALID_PERCENTAGE: 400,
    INVALID_STATUS: 400,
    NO_OFFERS: 400,
    HAS_PENDING: 409,
    INSUFFICIENT_SHARES: 400,
  };
  const status = err.code && map[err.code] ? map[err.code] : 500;
  if (status === 500) logger.error(fallback, error);
  res.status(status).json({
    success: false,
    error: err.code || 'ERROR',
    message: err.message || fallback,
  });
};

router.get(
  '/listings',
  authenticateToken,
  [query('status').optional().isString(), query('sellerId').optional().isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const status = req.query.status as string | undefined;
      const sellerId = req.query.sellerId
        ? parseInt(req.query.sellerId as string, 10)
        : undefined;
      const data = await service.listListings({ status, sellerId });
      res.json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to fetch listings');
    }
  }
);

router.post(
  '/listings',
  authenticateToken,
  [
    body('horseId').isInt({ min: 1 }),
    body('percentageOffered').isFloat({ min: 1, max: 100 }),
    body('pricePerPercent').isFloat({ min: 0.01 }),
    body('acceptOffers').isBoolean(),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('listingDurationDays').isIn([7, 14, 30, 60]),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.user_id;
      const data = await service.createListing(userId, {
        horseId: Number(req.body.horseId),
        percentageOffered: Number(req.body.percentageOffered),
        pricePerPercent: Number(req.body.pricePerPercent),
        acceptOffers: Boolean(req.body.acceptOffers),
        description: req.body.description,
        listingDurationDays: Number(req.body.listingDurationDays),
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to create listing');
    }
  }
);

router.patch(
  '/listings/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }),
    body('percentageOffered').isFloat({ min: 1, max: 100 }),
    body('pricePerPercent').isFloat({ min: 0.01 }),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.updateListing(
        parseInt(req.params.id, 10),
        { userId: req.user!.user_id, isStaff: isStaffUser(req.user) },
        {
          percentageOffered: Number(req.body.percentageOffered),
          pricePerPercent: Number(req.body.pricePerPercent),
        }
      );
      res.json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to update listing');
    }
  }
);

router.delete(
  '/listings/:id',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await service.cancelListing(parseInt(req.params.id, 10), {
        userId: req.user!.user_id,
        isStaff: isStaffUser(req.user),
      });
      res.json({ success: true, message: 'Listing removed' });
    } catch (error) {
      sendError(res, error, 'Failed to remove listing');
    }
  }
);

router.post(
  '/listings/:id/purchase',
  authenticateToken,
  [param('id').isInt({ min: 1 }), body('percentage').isFloat({ min: 1, max: 100 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.requestPurchase(
        parseInt(req.params.id, 10),
        req.user!.user_id,
        Number(req.body.percentage)
      );
      res.status(201).json({
        success: true,
        data,
        message: 'Purchase initiated. Waiting for seller to confirm payment received.',
      });
    } catch (error) {
      sendError(res, error, 'Failed to initiate purchase');
    }
  }
);

router.post(
  '/listings/:id/offers',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }),
    body('percentageRequested').isFloat({ min: 1, max: 100 }),
    body('offerAmount').isFloat({ min: 0.01 }),
    body('message').optional().isString().isLength({ max: 2000 }),
    body('expiryDays').isIn([3, 7, 14, 30]),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.createOffer(parseInt(req.params.id, 10), req.user!.user_id, {
        percentageRequested: Number(req.body.percentageRequested),
        offerAmount: Number(req.body.offerAmount),
        message: req.body.message,
        expiryDays: Number(req.body.expiryDays),
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to submit offer');
    }
  }
);

router.get(
  '/offers',
  authenticateToken,
  [
    query('buyerId').optional().isInt({ min: 1 }),
    query('listingId').optional().isInt({ min: 1 }),
    query('sellerId').optional().isInt({ min: 1 }),
    query('status').optional().isString(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: {
        buyerId?: number;
        listingId?: number;
        sellerId?: number;
        status?: string;
      } = {};
      if (req.query.buyerId) filters.buyerId = parseInt(req.query.buyerId as string, 10);
      if (req.query.listingId) filters.listingId = parseInt(req.query.listingId as string, 10);
      if (req.query.sellerId) filters.sellerId = parseInt(req.query.sellerId as string, 10);
      if (req.query.status) filters.status = req.query.status as string;

      // Members may only query their own buyer/seller offers unless staff
      if (!isStaffUser(req.user)) {
        const uid = req.user!.user_id;
        if (filters.buyerId != null && filters.buyerId !== uid) {
          res.status(403).json({ success: false, error: 'FORBIDDEN' });
          return;
        }
        if (filters.sellerId != null && filters.sellerId !== uid) {
          res.status(403).json({ success: false, error: 'FORBIDDEN' });
          return;
        }
        if (filters.buyerId == null && filters.sellerId == null && filters.listingId == null) {
          filters.buyerId = uid;
        }
      }

      const data = await service.listOffers(filters);
      res.json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to fetch offers');
    }
  }
);

router.post(
  '/offers/:id/accept',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.acceptOffer(parseInt(req.params.id, 10), req.user!.user_id);
      res.json({
        success: true,
        data,
        message: 'Offer accepted. Confirm payment when received to complete transfer.',
      });
    } catch (error) {
      sendError(res, error, 'Failed to accept offer');
    }
  }
);

router.post(
  '/offers/:id/reject',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await service.rejectOffer(parseInt(req.params.id, 10), req.user!.user_id);
      res.json({ success: true, message: 'Offer rejected' });
    } catch (error) {
      sendError(res, error, 'Failed to reject offer');
    }
  }
);

router.get(
  '/transfers',
  authenticateToken,
  [
    query('sellerId').optional().isInt({ min: 1 }),
    query('buyerId').optional().isInt({ min: 1 }),
    query('listingId').optional().isInt({ min: 1 }),
    query('status').optional().isString(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: {
        sellerId?: number;
        buyerId?: number;
        listingId?: number;
        status?: string;
      } = {};
      if (req.query.sellerId) filters.sellerId = parseInt(req.query.sellerId as string, 10);
      if (req.query.buyerId) filters.buyerId = parseInt(req.query.buyerId as string, 10);
      if (req.query.listingId) filters.listingId = parseInt(req.query.listingId as string, 10);
      if (req.query.status) filters.status = req.query.status as string;

      if (!isStaffUser(req.user)) {
        const uid = req.user!.user_id;
        if (!filters.sellerId && !filters.buyerId && !filters.listingId) {
          filters.sellerId = uid;
        }
      }

      const data = await service.listTransfers(filters);
      res.json({ success: true, data });
    } catch (error) {
      sendError(res, error, 'Failed to fetch transfers');
    }
  }
);

router.post(
  '/transfers/:id/confirm',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.confirmTransfer(parseInt(req.params.id, 10), {
        userId: req.user!.user_id,
        isStaff: isStaffUser(req.user),
      });
      res.json({
        success: true,
        data,
        message: 'Payment confirmed. Ownership transferred.',
      });
    } catch (error) {
      sendError(res, error, 'Failed to confirm transfer');
    }
  }
);

router.post(
  '/transfers/:id/cancel',
  authenticateToken,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await service.cancelTransfer(parseInt(req.params.id, 10), {
        userId: req.user!.user_id,
        isStaff: isStaffUser(req.user),
      });
      res.json({ success: true, message: 'Transfer cancelled' });
    } catch (error) {
      sendError(res, error, 'Failed to cancel transfer');
    }
  }
);
