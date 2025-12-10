import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from '../services/authService';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('first_name').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('last_name').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('role_id').optional().isInt({ min: 1 }).withMessage('Role ID must be a positive integer')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const validateForgotPassword = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
];

const validateProfileUpdate = [
  body('first_name').optional().trim().isLength({ min: 1 }).withMessage('First name must not be empty'),
  body('last_name').optional().trim().isLength({ min: 1 }).withMessage('Last name must not be empty'),
  body('country').optional().trim().isLength({ max: 100 }).withMessage('Country must not exceed 100 characters'),
  body('street_address').optional().trim().isLength({ max: 500 }).withMessage('Street address must not exceed 500 characters'),
  body('city').optional().trim().isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),
  body('state').optional().trim().isLength({ max: 100 }).withMessage('State must not exceed 100 characters'),
  body('zip_code').optional().trim().isLength({ max: 20 }).withMessage('ZIP code must not exceed 20 characters'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone must not exceed 20 characters')
];

const validateAdminCreateMember = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('first_name').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('last_name').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('country').optional().trim().isLength({ max: 100 }).withMessage('Country must not exceed 100 characters'),
  body('street_address').optional().trim().isLength({ max: 500 }).withMessage('Street address must not exceed 500 characters'),
  body('city').optional().trim().isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),
  body('state').optional().trim().isLength({ max: 100 }).withMessage('State must not exceed 100 characters'),
  body('zip_code').optional().trim().isLength({ max: 20 }).withMessage('ZIP code must not exceed 20 characters'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone must not exceed 20 characters')
];

// Helper function to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
    return;
  }
  next();
};

// POST /api/auth/register
router.post('/register', 
  validateRegistration, 
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      message: 'User registered successfully',
      data: result
    });
  })
);

// POST /api/auth/login
router.post('/login', 
  validateLogin, 
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.json({
      message: 'Login successful',
      data: result
    });
  })
);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  validateForgotPassword,
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email);
    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account exists with this email, you will receive password reset instructions.'
    });
  })
);

// POST /api/auth/logout
router.post('/logout', 
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await authService.logout(token);
    }
    res.json({ message: 'Logout successful' });
  })
);

// GET /api/auth/me
router.get('/me', 
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getCurrentUser(req.user!.user_id);
    res.json({
      message: 'Current user retrieved successfully',
      data: user
    });
  })
);

// PUT /api/auth/profile
router.put('/profile', 
  authenticateToken,
  validateProfileUpdate,
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.updateUserProfile(req.user!.user_id, req.body);
    res.json({
      message: 'Profile updated successfully',
      data: user
    });
  })
);

// GET /api/auth/users (Admin only)
router.get('/users', 
  authenticateToken, 
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const users = await authService.getAllUsers();
    res.json({
      message: 'Users retrieved successfully',
      data: users
    });
  })
);

// GET /api/auth/members (Admin only)
router.get('/members', 
  authenticateToken, 
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const members = await authService.getAllMembers();
    res.json({
      message: 'Members retrieved successfully',
      data: members
    });
  })
);

// PUT /api/auth/users/:id/role (Admin only)
router.put('/users/:id/role', 
  authenticateToken, 
  requireAdmin,
  [
    body('role_id').isInt({ min: 1 }).withMessage('Role ID must be a positive integer')
  ],
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    const { role_id } = req.body;
    
    const user = await authService.updateUserRole(userId, role_id);
    res.json({
      message: 'User role updated successfully',
      data: user
    });
  })
);

// DELETE /api/auth/users/:id (Admin only)
router.delete('/users/:id', 
  authenticateToken, 
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    await authService.deactivateUser(userId);
    res.json({ message: 'User deactivated successfully' });
  })
);

// POST /api/auth/admin/create-member (Admin only)
router.post('/admin/create-member', 
  authenticateToken, 
  requireAdmin,
  validateAdminCreateMember,
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      message: 'Member created successfully',
      data: result
    });
  })
);

// PUT /api/auth/members/:id (Admin only)
router.put('/members/:id', 
  authenticateToken, 
  requireAdmin,
  validateProfileUpdate,
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const memberId = parseInt(req.params.id);
    const user = await authService.updateMember(memberId, req.body);
    res.json({
      message: 'Member updated successfully',
      data: user
    });
  })
);

// DELETE /api/auth/members/:id (Admin only)
router.delete('/members/:id', 
  authenticateToken, 
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const memberId = parseInt(req.params.id);
    await authService.deleteMember(memberId);
    res.json({ message: 'Member deleted successfully' });
  })
);

export { router as authRoutes };
