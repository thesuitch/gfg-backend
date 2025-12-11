import pool from '../database/connection';
import { hashPassword, comparePassword, generateToken, generateTokenHash } from '../utils/jwt';
import { User, UserWithPassword, LoginRequest, RegisterRequest, UpdateProfileRequest, AuthResponse, UserRole } from '../types/auth';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { sendRegistrationNotification, sendPasswordResetEmail } from '../utils/email';
import crypto from 'crypto';

export class AuthService {
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const client = await pool.connect();
    
    try {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw createError('User with this email already exists', 400);
      }

      // Hash password
      const passwordHash = await hashPassword(userData.password);

      // Set default role to member if not specified
      const roleId = userData.role_id || 2; // 2 = member role

      // Create user
      const result = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, country, street_address, city, state, zip_code, phone, role_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, email, first_name, last_name, country, street_address, city, state, zip_code, phone, role_id, is_active, email_verified, last_login, created_at, updated_at
      `, [
        userData.email, 
        passwordHash, 
        userData.first_name, 
        userData.last_name, 
        userData.country || null,
        userData.street_address || null,
        userData.city || null,
        userData.state || null,
        userData.zip_code || null,
        userData.phone || null,
        roleId
      ]);

      const user = result.rows[0];

      // Get role name
      const roleResult = await client.query('SELECT name FROM roles WHERE id = $1', [roleId]);
      const roleName = roleResult.rows[0].name;

      const userWithRole: User = {
        ...user,
        role_name: roleName
      };

      // Generate token
      const token = generateToken(userWithRole);

      // Store token hash in sessions
      const tokenHash = generateTokenHash(token);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      await client.query(`
        INSERT INTO user_sessions (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `, [user.id, tokenHash, expiresAt]);

      logger.info(`User registered successfully: ${user.email}`);

      // Send registration notification email to admin
      try {
        await sendRegistrationNotification({
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone || undefined,
          country: user.country || undefined,
          city: user.city || undefined,
          state: user.state || undefined
        });
      } catch (emailError) {
        // Log error but don't fail registration
        logger.error('Failed to send registration notification email:', emailError);
      }

      return {
        user: userWithRole,
        token,
        expires_in: 24 * 60 * 60 // 24 hours in seconds
      };

    } finally {
      client.release();
    }
  }

  async login(loginData: LoginRequest): Promise<AuthResponse> {
    const client = await pool.connect();
    
    try {
      // Get user with role
      const result = await client.query(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.country, u.street_address, u.city, u.state, u.zip_code, u.phone, u.role_id, u.is_active, u.email_verified, u.last_login, u.created_at, u.updated_at, u.password_hash, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.email = $1 AND u.is_active = true
      `, [loginData.email]);

      if (result.rows.length === 0) {
        throw createError('Invalid email or password', 401);
      }

      const user: UserWithPassword = result.rows[0];

      // Verify password
      const isValidPassword = await comparePassword(loginData.password, user.password_hash);
      if (!isValidPassword) {
        throw createError('Invalid email or password', 401);
      }

      // Update last login
      await client.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Generate token
      const token = generateToken(user);

      // Store token hash in sessions
      const tokenHash = generateTokenHash(token);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      await client.query(`
        INSERT INTO user_sessions (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `, [user.id, tokenHash, expiresAt]);

      // Clean up expired sessions
      await client.query(
        'DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP'
      );

      logger.info(`User logged in successfully: ${user.email}`);

      const { password_hash, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token,
        expires_in: 24 * 60 * 60 // 24 hours in seconds
      };

    } finally {
      client.release();
    }
  }

  async logout(token: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      const tokenHash = generateTokenHash(token);
      
      await client.query(
        'DELETE FROM user_sessions WHERE token_hash = $1',
        [tokenHash]
      );

      logger.info('User logged out successfully');
    } finally {
      client.release();
    }
  }

  async getCurrentUser(userId: number): Promise<User> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.country, u.street_address, u.city, u.state, u.zip_code, u.phone, u.role_id, u.is_active, u.email_verified, u.last_login, u.created_at, u.updated_at, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 AND u.is_active = true
      `, [userId]);

      if (result.rows.length === 0) {
        throw createError('User not found', 404);
      }

      const { password_hash, ...user } = result.rows[0];
      return user;
    } finally {
      client.release();
    }
  }

  async getAllUsers(): Promise<User[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.country, u.street_address, u.city, u.state, u.zip_code, u.phone, u.role_id, 
               u.is_active, u.email_verified, u.last_login, u.created_at, u.updated_at,
               r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        ORDER BY u.created_at DESC
      `);

      return result.rows;
    } finally {
      client.release();
    }
  }

  async getAllMembers(): Promise<User[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.country, u.street_address, u.city, u.state, u.zip_code, u.phone, u.role_id, 
               u.is_active, u.email_verified, u.last_login, u.created_at, u.updated_at,
               r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.role_id = 2 AND u.is_active = true
        ORDER BY u.created_at DESC
      `);

      return result.rows;
    } finally {
      client.release();
    }
  }

  async updateMember(userId: number, updateData: Partial<User>): Promise<User> {
    const client = await pool.connect();
    
    try {
      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      // Only update provided fields
      if (updateData.first_name !== undefined) {
        updateFields.push(`first_name = $${paramCount++}`);
        values.push(updateData.first_name);
      }
      if (updateData.last_name !== undefined) {
        updateFields.push(`last_name = $${paramCount++}`);
        values.push(updateData.last_name);
      }
      if (updateData.email !== undefined) {
        updateFields.push(`email = $${paramCount++}`);
        values.push(updateData.email);
      }
      if (updateData.phone !== undefined) {
        updateFields.push(`phone = $${paramCount++}`);
        values.push(updateData.phone);
      }
      if (updateData.country !== undefined) {
        updateFields.push(`country = $${paramCount++}`);
        values.push(updateData.country);
      }
      if (updateData.street_address !== undefined) {
        updateFields.push(`street_address = $${paramCount++}`);
        values.push(updateData.street_address);
      }
      if (updateData.city !== undefined) {
        updateFields.push(`city = $${paramCount++}`);
        values.push(updateData.city);
      }
      if (updateData.state !== undefined) {
        updateFields.push(`state = $${paramCount++}`);
        values.push(updateData.state);
      }
      if (updateData.zip_code !== undefined) {
        updateFields.push(`zip_code = $${paramCount++}`);
        values.push(updateData.zip_code);
      }

      if (updateFields.length === 0) {
        throw createError('No fields to update', 400);
      }

      // Add updated_at
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add user ID as last parameter
      values.push(userId);

      const result = await client.query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND role_id = 2
        RETURNING id, email, first_name, last_name, country, street_address, city, state, zip_code, phone, role_id, 
                  is_active, email_verified, last_login, created_at, updated_at
      `, values);

      if (result.rows.length === 0) {
        throw createError('Member not found', 404);
      }

      const user = result.rows[0];

      // Get role name
      const roleResult = await client.query('SELECT name FROM roles WHERE id = $1', [user.role_id]);
      const roleName = roleResult.rows[0].name;

      return {
        ...user,
        role_name: roleName as any
      };
    } finally {
      client.release();
    }
  }

  async deleteMember(userId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Soft delete by setting is_active to false
      const result = await client.query(`
        UPDATE users 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND role_id = 2
        RETURNING id
      `, [userId]);

      if (result.rows.length === 0) {
        throw createError('Member not found', 404);
      }
    } finally {
      client.release();
    }
  }

  async updateUserRole(userId: number, newRoleId: number): Promise<User> {
    const client = await pool.connect();
    
    try {
      // Verify role exists
      const roleResult = await client.query('SELECT id FROM roles WHERE id = $1', [newRoleId]);
      if (roleResult.rows.length === 0) {
        throw createError('Invalid role ID', 400);
      }

      // Update user role
      const result = await client.query(`
        UPDATE users 
        SET role_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, email, first_name, last_name, role_id, is_active, email_verified, last_login, created_at, updated_at
      `, [newRoleId, userId]);

      if (result.rows.length === 0) {
        throw createError('User not found', 404);
      }

      const user = result.rows[0];

      // Get role name
      const roleNameResult = await client.query('SELECT name FROM roles WHERE id = $1', [newRoleId]);
      const roleName = roleNameResult.rows[0].name;

      const userWithRole: User = {
        ...user,
        role_name: roleName
      };

      logger.info(`User role updated: ${user.email} -> ${roleName}`);

      return userWithRole;
    } finally {
      client.release();
    }
  }

  async updateUserProfile(userId: number, profileData: UpdateProfileRequest): Promise<User> {
    const client = await pool.connect();
    
    try {
      // Build dynamic update query based on provided fields
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (profileData.first_name !== undefined) {
        updateFields.push(`first_name = $${paramCount++}`);
        values.push(profileData.first_name);
      }
      if (profileData.last_name !== undefined) {
        updateFields.push(`last_name = $${paramCount++}`);
        values.push(profileData.last_name);
      }
      if (profileData.country !== undefined) {
        updateFields.push(`country = $${paramCount++}`);
        values.push(profileData.country);
      }
      if (profileData.street_address !== undefined) {
        updateFields.push(`street_address = $${paramCount++}`);
        values.push(profileData.street_address);
      }
      if (profileData.city !== undefined) {
        updateFields.push(`city = $${paramCount++}`);
        values.push(profileData.city);
      }
      if (profileData.state !== undefined) {
        updateFields.push(`state = $${paramCount++}`);
        values.push(profileData.state);
      }
      if (profileData.zip_code !== undefined) {
        updateFields.push(`zip_code = $${paramCount++}`);
        values.push(profileData.zip_code);
      }
      if (profileData.phone !== undefined) {
        updateFields.push(`phone = $${paramCount++}`);
        values.push(profileData.phone);
      }

      if (updateFields.length === 0) {
        throw createError('No fields to update', 400);
      }

      // Add updated_at field
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add user ID as last parameter
      values.push(userId);

      const result = await client.query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, first_name, last_name, country, street_address, city, state, zip_code, phone, role_id, is_active, email_verified, last_login, created_at, updated_at
      `, values);

      if (result.rows.length === 0) {
        throw createError('User not found', 404);
      }

      const user = result.rows[0];

      // Get role name
      const roleResult = await client.query('SELECT name FROM roles WHERE id = $1', [user.role_id]);
      const roleName = roleResult.rows[0].name;

      const userWithRole: User = {
        ...user,
        role_name: roleName
      };

      logger.info(`User profile updated: ${user.email}`);

      return userWithRole;
    } finally {
      client.release();
    }
  }

  async deactivateUser(userId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        UPDATE users 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `, [userId]);

      if (result.rows.length === 0) {
        throw createError('User not found', 404);
      }

      // Remove all active sessions
      await client.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );

      logger.info(`User deactivated: ${userId}`);
    } finally {
      client.release();
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Check if user exists
      const result = await client.query(
        'SELECT id, email, first_name, last_name FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      // Always return success to prevent email enumeration
      // But only send email if user exists
      if (result.rows.length > 0) {
        const user = result.rows[0];
        
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        // Store reset token (expires in 1 hour)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        
        // Check if password_reset_tokens table exists, if not create it
        await client.query(`
          CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            used BOOLEAN DEFAULT FALSE
          )
        `);
        
        // Invalidate any existing reset tokens for this user
        await client.query(
          'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
          [user.id]
        );
        
        // Insert new reset token
        await client.query(
          'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
          [user.id, tokenHash, expiresAt]
        );
        
        // Send password reset email
        try {
          await sendPasswordResetEmail(user.email, resetToken);
          logger.info(`Password reset email sent to: ${user.email}`);
        } catch (emailError) {
          logger.error('Failed to send password reset email:', emailError);
          // Don't throw error, just log it
        }
      } else {
        // Log attempt for non-existent user (for security monitoring)
        logger.warn(`Password reset requested for non-existent email: ${email}`);
      }
    } finally {
      client.release();
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Hash the token to compare with stored hash
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find valid reset token
      const tokenResult = await client.query(
        `SELECT prt.user_id, prt.expires_at, prt.used
         FROM password_reset_tokens prt
         WHERE prt.token_hash = $1 
         AND prt.used = false 
         AND prt.expires_at > NOW()`,
        [tokenHash]
      );

      if (tokenResult.rows.length === 0) {
        throw createError('Invalid or expired reset token', 400);
      }

      const resetToken = tokenResult.rows[0];
      
      // Check if token is expired
      if (new Date(resetToken.expires_at) < new Date()) {
        throw createError('Reset token has expired', 400);
      }

      // Check if token is already used
      if (resetToken.used) {
        throw createError('Reset token has already been used', 400);
      }

      // Hash the new password
      const passwordHash = await hashPassword(newPassword);

      // Update user password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, resetToken.user_id]
      );

      // Mark token as used
      await client.query(
        'UPDATE password_reset_tokens SET used = true WHERE token_hash = $1',
        [tokenHash]
      );

      logger.info(`Password reset successful for user ID: ${resetToken.user_id}`);
    } finally {
      client.release();
    }
  }
}

export const authService = new AuthService();
