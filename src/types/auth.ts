export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  country?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  role_id: number;
  role_name: string;
  is_active: boolean;
  email_verified: boolean;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  country?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  role_id?: number;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  country?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
}

export interface AuthResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  expires_in: number;
}

export interface JwtPayload {
  user_id: number;
  email: string;
  role_id: number;
  role_name: string;
  iat: number;
  exp: number;
}

export interface UserSession {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  FINANCE = 'finance',
  MANAGER = 'manager'
}
