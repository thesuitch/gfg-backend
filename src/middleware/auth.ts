import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { JwtPayload } from '../types/auth';
import { logger } from '../utils/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Token authentication failed:', error);
    res.status(403).json({ error: 'Invalid token' });
    return;
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role_name)) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required_roles: roles,
        user_role: req.user.role_name
      });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireMember = requireRole(['member', 'admin', 'finance', 'manager']);
export const requireFinance = requireRole(['finance', 'admin']);
export const requireManager = requireRole(['manager', 'admin']);
