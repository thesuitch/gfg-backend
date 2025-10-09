import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JwtPayload, User } from '../types/auth';
import { logger } from './logger';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export const generateToken = (user: User): string => {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    user_id: user.id,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    logger.error('JWT verification failed:', error);
    return null;
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateTokenHash = (token: string): string => {
  return bcrypt.hashSync(token, 10);
};

export const compareTokenHash = (token: string, hash: string): boolean => {
  return bcrypt.compareSync(token, hash);
};
