import { Pool } from 'pg';
import { 
  Horse, 
  HorseOwnership, 
  HorseTransaction, 
  HorsePerformanceUpdate, 
  HorseFinancialUpdate,
  CreateHorseRequest, 
  UpdateHorseRequest, 
  HorseFilters, 
  HorseStatistics,
  PurchaseSharesRequest,
  UpdatePerformanceRequest,
  UpdateFinancialsRequest
} from '../types/horse';
import { logger } from '../utils/logger';

export class HorseService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Get all horses with optional filtering and pagination
  async getHorses(filters: HorseFilters = {}): Promise<{ horses: Horse[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const {
        search,
        status,
        age,
        gait,
        jurisdiction,
        sex,
        sire,
        trainer,
        horseType,
        priceRange,
        sortBy = 'name',
        sortOrder = 'asc',
        page = 1,
        limit = 50
      } = filters;

      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // Build WHERE conditions
      if (search) {
        whereConditions.push(`(h.name ILIKE $${paramIndex} OR h.sire ILIKE $${paramIndex} OR h.dam ILIKE $${paramIndex} OR h.trainer ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        if (status === 'available') {
          whereConditions.push(`h.shares_remaining > 0`);
        } else if (status === 'sold_out') {
          whereConditions.push(`h.shares_remaining = 0`);
        } else {
          whereConditions.push(`h.status = $${paramIndex}`);
          queryParams.push(status);
          paramIndex++;
        }
      }

      if (age) {
        if (age === '2-4') {
          whereConditions.push(`h.age >= 2 AND h.age <= 4`);
        } else if (age === '5-7') {
          whereConditions.push(`h.age >= 5 AND h.age <= 7`);
        } else if (age === '8+') {
          whereConditions.push(`h.age >= 8`);
        } else {
          whereConditions.push(`h.age = $${paramIndex}`);
          queryParams.push(parseInt(age));
          paramIndex++;
        }
      }

      if (gait) {
        whereConditions.push(`h.gait = $${paramIndex}`);
        queryParams.push(gait);
        paramIndex++;
      }

      if (jurisdiction) {
        whereConditions.push(`$${paramIndex} = ANY(h.jurisdiction)`);
        queryParams.push(jurisdiction);
        paramIndex++;
      }

      if (sex) {
        whereConditions.push(`h.sex = $${paramIndex}`);
        queryParams.push(sex);
        paramIndex++;
      }

      if (sire) {
        whereConditions.push(`h.sire = $${paramIndex}`);
        queryParams.push(sire);
        paramIndex++;
      }

      if (trainer) {
        whereConditions.push(`h.trainer = $${paramIndex}`);
        queryParams.push(trainer);
        paramIndex++;
      }

      if (horseType) {
        whereConditions.push(`h.horse_type = $${paramIndex}`);
        queryParams.push(horseType);
        paramIndex++;
      }

      if (priceRange) {
        if (priceRange === '0-50') {
          whereConditions.push(`h.price_per_percent <= 50`);
        } else if (priceRange === '51-100') {
          whereConditions.push(`h.price_per_percent > 50 AND h.price_per_percent <= 100`);
        } else if (priceRange === '101-200') {
          whereConditions.push(`h.price_per_percent > 100 AND h.price_per_percent <= 200`);
        } else if (priceRange === '200+') {
          whereConditions.push(`h.price_per_percent > 200`);
        }
      }

      // Build ORDER BY clause
      let orderBy = 'h.name ASC';
      if (sortBy) {
        const validSortFields = ['name', 'age', 'price_per_percent', 'shares_remaining', 'earnings', 'wins', 'purchase_date'];
        if (validSortFields.includes(sortBy)) {
          orderBy = `h.${sortBy} ${sortOrder.toUpperCase()}`;
        }
      }

      // Build WHERE clause
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM horses h
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get horses with pagination
      const horsesQuery = `
        SELECT 
          h.id, h.name, h.sire, h.dam, h.sex, h.age, h.age_category as "ageCategory",
          h.gait, h.status, h.horse_type as "horseType", h.jurisdiction, h.trainer,
          h.stable_location as "stableLocation", h.purchase_date as "purchaseDate",
          h.purchase_price as "purchasePrice", h.current_value as "currentValue",
          h.price_per_percent as "pricePerPercent", h.initial_shares as "initialShares",
          h.current_shares as "currentShares", h.shares_remaining as "sharesRemaining",
          h.wins, h.places, h.shows, h.races, h.earnings, h.image_url as "imageUrl",
          h.description, h.created_by as "createdBy", h.updated_by as "updatedBy",
          h.created_at as "createdAt", h.updated_at as "updatedAt"
        FROM horses h
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      const horsesResult = await this.pool.query(horsesQuery, queryParams);

      return {
        horses: horsesResult.rows,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      logger.error('Error getting horses:', error);
      throw new Error('Failed to fetch horses');
    }
  }

  // Get a single horse by ID
  async getHorseById(id: number): Promise<Horse | null> {
    try {
      const query = `
        SELECT 
          h.id, h.name, h.sire, h.dam, h.sex, h.age, h.age_category as "ageCategory",
          h.gait, h.status, h.horse_type as "horseType", h.jurisdiction, h.trainer,
          h.stable_location as "stableLocation", h.purchase_date as "purchaseDate",
          h.purchase_price as "purchasePrice", h.current_value as "currentValue",
          h.price_per_percent as "pricePerPercent", h.initial_shares as "initialShares",
          h.current_shares as "currentShares", h.shares_remaining as "sharesRemaining",
          h.wins, h.places, h.shows, h.races, h.earnings, h.image_url as "imageUrl",
          h.description, h.created_by as "createdBy", h.updated_by as "updatedBy",
          h.created_at as "createdAt", h.updated_at as "updatedAt"
        FROM horses h
        WHERE h.id = $1
      `;
      
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting horse by ID:', error);
      throw new Error('Failed to fetch horse');
    }
  }

  // Create a new horse
  async createHorse(horseData: CreateHorseRequest, userId: number): Promise<Horse> {
    try {
      const {
        name, sire, dam, sex, age, ageCategory, gait, status, horseType,
        jurisdiction, trainer, stableLocation, purchaseDate, purchasePrice,
        currentValue, pricePerPercent, initialShares = 100, currentShares = 100,
        wins = 0, places = 0, shows = 0, races = 0, earnings = 0,
        imageUrl, description
      } = horseData;

      const sharesRemaining = initialShares - currentShares;

      const query = `
        INSERT INTO horses (
          name, sire, dam, sex, age, age_category, gait, status, horse_type,
          jurisdiction, trainer, stable_location, purchase_date, purchase_price,
          current_value, price_per_percent, initial_shares, current_shares,
          shares_remaining, wins, places, shows, races, earnings, image_url,
          description, created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        ) RETURNING *
      `;

      const values = [
        name, sire, dam, sex, age, ageCategory, gait, status, horseType,
        Array.isArray(jurisdiction) ? jurisdiction : [jurisdiction], trainer, stableLocation, purchaseDate, purchasePrice,
        currentValue, pricePerPercent, initialShares, currentShares,
        sharesRemaining, wins, places, shows, races, earnings, imageUrl,
        description, userId, userId
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating horse:', error);
      throw new Error('Failed to create horse');
    }
  }

  // Update an existing horse
  async updateHorse(id: number, horseData: UpdateHorseRequest, userId: number): Promise<Horse | null> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      Object.entries(horseData).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updateFields.push(`${dbKey} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push(`updated_by = $${paramIndex}`);
      values.push(userId);
      paramIndex++;

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      values.push(id);

      const query = `
        UPDATE horses 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating horse:', error);
      throw new Error('Failed to update horse');
    }
  }

  // Delete a horse
  async deleteHorse(id: number): Promise<boolean> {
    try {
      const query = 'DELETE FROM horses WHERE id = $1';
      const result = await this.pool.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Error deleting horse:', error);
      throw new Error('Failed to delete horse');
    }
  }

  // Get horses owned by a specific member
  async getHorsesByMember(memberId: number): Promise<Horse[]> {
    try {
      const query = `
        SELECT DISTINCT
          h.id, h.name, h.sire, h.dam, h.sex, h.age, h.age_category as "ageCategory",
          h.gait, h.status, h.horse_type as "horseType", h.jurisdiction, h.trainer,
          h.stable_location as "stableLocation", h.purchase_date as "purchaseDate",
          h.purchase_price as "purchasePrice", h.current_value as "currentValue",
          h.price_per_percent as "pricePerPercent", h.initial_shares as "initialShares",
          h.current_shares as "currentShares", h.shares_remaining as "sharesRemaining",
          h.wins, h.places, h.shows, h.races, h.earnings, h.image_url as "imageUrl",
          h.description, h.created_by as "createdBy", h.updated_by as "updatedBy",
          h.created_at as "createdAt", h.updated_at as "updatedAt"
        FROM horses h
        INNER JOIN horse_ownership ho ON h.id = ho.horse_id
        WHERE ho.member_id = $1 AND ho.is_active = true
        ORDER BY h.name
      `;
      
      const result = await this.pool.query(query, [memberId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting horses by member:', error);
      throw new Error('Failed to fetch member horses');
    }
  }

  // Purchase shares in a horse
  async purchaseShares(horseId: number, purchaseData: PurchaseSharesRequest, userId: number): Promise<HorseOwnership> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if horse exists and has enough shares
      const horseQuery = 'SELECT shares_remaining, price_per_percent FROM horses WHERE id = $1';
      const horseResult = await client.query(horseQuery, [horseId]);
      
      if (horseResult.rows.length === 0) {
        throw new Error('Horse not found');
      }

      const horse = horseResult.rows[0];
      if (horse.shares_remaining < purchaseData.percentage) {
        throw new Error('Not enough shares available');
      }

      // Create ownership record
      const ownershipQuery = `
        INSERT INTO horse_ownership (
          horse_id, member_id, percentage, purchase_date, purchase_price, is_active
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, true)
        RETURNING *
      `;
      
      const totalPrice = purchaseData.percentage * horse.price_per_percent;
      const ownershipResult = await client.query(ownershipQuery, [
        horseId, purchaseData.memberId, purchaseData.percentage, totalPrice
      ]);

      // Create transaction record
      const transactionQuery = `
        INSERT INTO horse_transactions (
          horse_id, member_id, transaction_type, percentage, price_per_percent, 
          total_amount, transaction_date, created_by
        ) VALUES ($1, $2, 'purchase', $3, $4, $5, CURRENT_TIMESTAMP, $6)
      `;
      
      await client.query(transactionQuery, [
        horseId, purchaseData.memberId, purchaseData.percentage, 
        horse.price_per_percent, totalPrice, userId
      ]);

      await client.query('COMMIT');
      return ownershipResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error purchasing shares:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get horse statistics
  async getHorseStatistics(): Promise<HorseStatistics> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_horses,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as active_horses,
          COUNT(CASE WHEN status = 'old' THEN 1 END) as retired_horses,
          COUNT(CASE WHEN shares_remaining = 0 THEN 1 END) as sold_horses,
          COALESCE(SUM(current_value), 0) as total_value,
          COALESCE(AVG(current_value), 0) as average_value,
          COALESCE(SUM(earnings), 0) as total_earnings,
          COALESCE(AVG(earnings), 0) as average_earnings
        FROM horses
      `;
      
      const result = await this.pool.query(query);
      const stats = result.rows[0];
      
      return {
        totalHorses: parseInt(stats.total_horses),
        activeHorses: parseInt(stats.active_horses),
        retiredHorses: parseInt(stats.retired_horses),
        soldHorses: parseInt(stats.sold_horses),
        totalValue: parseFloat(stats.total_value),
        averageValue: parseFloat(stats.average_value),
        totalEarnings: parseFloat(stats.total_earnings),
        averageEarnings: parseFloat(stats.average_earnings)
      };
    } catch (error) {
      logger.error('Error getting horse statistics:', error);
      throw new Error('Failed to fetch horse statistics');
    }
  }

  // Update horse performance
  async updatePerformance(horseId: number, performanceData: UpdatePerformanceRequest, userId: number): Promise<HorsePerformanceUpdate> {
    try {
      const {
        wins = 0, places = 0, shows = 0, races = 0, earnings = 0,
        updateDate = new Date().toISOString().split('T')[0], notes
      } = performanceData;

      // Create performance update record
      const performanceQuery = `
        INSERT INTO horse_performance_updates (
          horse_id, wins, places, shows, races, earnings, update_date, notes, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const performanceResult = await this.pool.query(performanceQuery, [
        horseId, wins, places, shows, races, earnings, updateDate, notes, userId
      ]);

      // Update horse's total performance
      const updateHorseQuery = `
        UPDATE horses 
        SET 
          wins = wins + $2,
          places = places + $3,
          shows = shows + $4,
          races = races + $5,
          earnings = earnings + $6,
          updated_by = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      
      await this.pool.query(updateHorseQuery, [
        horseId, wins, places, shows, races, earnings, userId
      ]);

      return performanceResult.rows[0];
    } catch (error) {
      logger.error('Error updating horse performance:', error);
      throw new Error('Failed to update horse performance');
    }
  }

  // Update horse financials
  async updateFinancials(horseId: number, financialData: UpdateFinancialsRequest, userId: number): Promise<HorseFinancialUpdate> {
    try {
      const {
        currentValue, pricePerPercent, sharesRemaining,
        updateDate = new Date().toISOString().split('T')[0], notes
      } = financialData;

      // Create financial update record
      const financialQuery = `
        INSERT INTO horse_financial_updates (
          horse_id, current_value, price_per_percent, shares_remaining, update_date, notes, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const financialResult = await this.pool.query(financialQuery, [
        horseId, currentValue, pricePerPercent, sharesRemaining, updateDate, notes, userId
      ]);

      // Update horse's financial data
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (currentValue !== undefined) {
        updateFields.push(`current_value = $${paramIndex}`);
        values.push(currentValue);
        paramIndex++;
      }

      if (pricePerPercent !== undefined) {
        updateFields.push(`price_per_percent = $${paramIndex}`);
        values.push(pricePerPercent);
        paramIndex++;
      }

      if (sharesRemaining !== undefined) {
        updateFields.push(`shares_remaining = $${paramIndex}`);
        values.push(sharesRemaining);
        paramIndex++;
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_by = $${paramIndex}`);
        values.push(userId);
        paramIndex++;

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        values.push(horseId);

        const updateHorseQuery = `
          UPDATE horses 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `;
        
        await this.pool.query(updateHorseQuery, values);
      }

      return financialResult.rows[0];
    } catch (error) {
      logger.error('Error updating horse financials:', error);
      throw new Error('Failed to update horse financials');
    }
  }
}
