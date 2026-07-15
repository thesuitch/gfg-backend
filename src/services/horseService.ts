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
import { MemberActivityService } from './memberActivityService';
import { logger } from '../utils/logger';
import { mapHorseRow, normalizeHorseWritePayload } from '../utils/horseFilterFields';

const HORSE_SELECT_FIELDS = `
  h.id, h.name, h.sire as "sireId", h.dam, h.sex, h.age, h.age_category as "ageCategory",
  h.gait, h.status, h.horse_type as "horseTypeId", h.jurisdiction as "jurisdictionIds", h.trainer as "trainerId",
  h.stable_location as "stableLocation", h.purchase_date as "purchaseDate",
  h.purchase_price as "purchasePrice", h.current_value as "currentValue",
  h.price_per_percent as "pricePerPercent", h.initial_shares as "initialShares",
  h.current_shares as "currentShares", h.shares_remaining as "sharesRemaining",
  h.wins, h.places, h.shows, h.races, h.earnings, h.image_url as "imageUrl",
  h.description, h.archived, h.is_new as "isNew", h.sale_price as "salePrice",
  h.lifetime_past_performance_url as "lifetimePastPerformanceUrl",
  h.pedigree_url as "pedigreeUrl",
  h.created_by as "createdBy", h.updated_by as "updatedBy",
  h.created_at as "createdAt", h.updated_at as "updatedAt"
`;

const UPDATE_FIELD_MAP: Record<string, string> = {
  name: 'name',
  sire: 'sire',
  dam: 'dam',
  sex: 'sex',
  age: 'age',
  ageCategory: 'age_category',
  gait: 'gait',
  status: 'status',
  isNew: 'is_new',
  horseType: 'horse_type',
  horseTypeId: 'horse_type',
  jurisdiction: 'jurisdiction',
  trainer: 'trainer',
  stableLocation: 'stable_location',
  purchaseDate: 'purchase_date',
  purchasePrice: 'purchase_price',
  currentValue: 'current_value',
  pricePerPercent: 'price_per_percent',
  initialShares: 'initial_shares',
  currentShares: 'current_shares',
  sharesRemaining: 'shares_remaining',
  wins: 'wins',
  places: 'places',
  shows: 'shows',
  races: 'races',
  earnings: 'earnings',
  imageUrl: 'image_url',
  description: 'description',
  salePrice: 'sale_price',
  lifetimePastPerformanceUrl: 'lifetime_past_performance_url',
  pedigreeUrl: 'pedigree_url',
};

export class HorseService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private mapHorseRows(rows: Record<string, unknown>[]): Horse[] {
    return rows.map((row) => mapHorseRow(row) as unknown as Horse);
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
        limit = 50,
        includeArchived = false
      } = filters;

      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      if (!includeArchived) {
        whereConditions.push(`COALESCE(h.archived, false) = false`);
      }

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

      // Build ORDER BY clause (accept camelCase from frontend and snake_case)
      const sortOrderSql = sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const sortFieldMap: Record<string, string> = {
        name: 'h.name',
        age: 'h.age',
        price_per_percent: 'h.price_per_percent',
        pricePerPercent: 'h.price_per_percent',
        shares_remaining: 'h.shares_remaining',
        sharesRemaining: 'h.shares_remaining',
        earnings: 'h.earnings',
        wins: 'h.wins',
        purchase_date: 'h.purchase_date',
        purchaseDate: 'h.purchase_date',
        jurisdiction: `array_to_string(h.jurisdiction, ',')`,
        gait: 'h.gait',
        sex: 'h.sex',
        sire: 'h.sire',
        dam: 'h.dam',
        horse_type: 'h.horse_type',
        horseType: 'h.horse_type',
      };
      const orderBy = sortBy && sortFieldMap[sortBy]
        ? `${sortFieldMap[sortBy]} ${sortOrderSql}`
        : `h.name ${sortOrderSql}`;

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
        SELECT ${HORSE_SELECT_FIELDS}
        FROM horses h
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      const horsesResult = await this.pool.query(horsesQuery, queryParams);

      return {
        horses: this.mapHorseRows(horsesResult.rows),
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
        SELECT ${HORSE_SELECT_FIELDS}
        FROM horses h
        WHERE h.id = $1
      `;
      
      const result = await this.pool.query(query, [id]);
      const row = result.rows[0];
      return row ? (mapHorseRow(row) as unknown as Horse) : null;
    } catch (error) {
      logger.error('Error getting horse by ID:', error);
      throw new Error('Failed to fetch horse');
    }
  }

  // Create a new horse
  async createHorse(horseData: CreateHorseRequest, userId: number): Promise<Horse> {
    try {
      const normalized = normalizeHorseWritePayload(horseData);
      const {
        name, sire, dam, sex, age, ageCategory, gait,
        status = 'active',
        isNew = true,
        horseType,
        jurisdiction, trainer, stableLocation, purchaseDate, purchasePrice,
        currentValue, pricePerPercent,
        initialShares = 100,
        sharesRemaining,
        wins = 0, places = 0, shows = 0, races = 0, earnings = 0,
        imageUrl, description, salePrice, lifetimePastPerformanceUrl, pedigreeUrl
      } = normalized;

      const resolvedSharesRemaining = sharesRemaining ?? normalized.currentShares ?? initialShares;
      const currentShares = resolvedSharesRemaining;

      const query = `
        INSERT INTO horses (
          name, sire, dam, sex, age, age_category, gait, status, is_new, horse_type,
          jurisdiction, trainer, stable_location, purchase_date, purchase_price,
          current_value, price_per_percent, initial_shares, current_shares,
          shares_remaining, wins, places, shows, races, earnings, image_url,
          description, sale_price, lifetime_past_performance_url, pedigree_url,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
        )
        RETURNING id
      `;

      const values = [
        name, sire, dam, sex, age, ageCategory, gait, status, isNew, horseType,
        Array.isArray(jurisdiction) ? jurisdiction : [jurisdiction], trainer, stableLocation, purchaseDate, purchasePrice,
        currentValue, pricePerPercent, initialShares, currentShares,
        resolvedSharesRemaining, wins, places, shows, races, earnings, imageUrl,
        description, salePrice, lifetimePastPerformanceUrl, pedigreeUrl,
        userId, userId
      ];

      const result = await this.pool.query(query, values);
      const created = await this.getHorseById(result.rows[0].id);
      if (!created) {
        throw new Error('Failed to fetch created horse');
      }
      return created;
    } catch (error: any) {
      logger.error('Error creating horse:', error);
      if (error?.code === '23514') {
        throw new Error(
          error?.constraint === 'horses_horse_type_check'
            ? 'Invalid horse type. Run database migrations (012) so horse types can use Filter Settings IDs.'
            : `Horse data failed a database check (${error.constraint || 'unknown'}).`
        );
      }
      if (error instanceof Error && error.message && error.message !== 'Failed to create horse') {
        throw error;
      }
      throw new Error('Failed to create horse');
    }
  }

  // Update an existing horse
  async updateHorse(id: number, horseData: UpdateHorseRequest, userId: number): Promise<Horse | null> {
    try {
      const normalized = normalizeHorseWritePayload(horseData);

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(normalized).forEach(([key, value]) => {
        if (value === undefined) return;
        const dbKey = UPDATE_FIELD_MAP[key];
        if (!dbKey) return;
        updateFields.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      });

      if (normalized.sharesRemaining !== undefined && normalized.currentShares === undefined) {
        updateFields.push(`current_shares = $${paramIndex}`);
        values.push(normalized.sharesRemaining);
        paramIndex++;
      }

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
        RETURNING id
      `;

      const result = await this.pool.query(query, values);
      if (!result.rows[0]) return null;
      return this.getHorseById(id);
    } catch (error) {
      logger.error('Error updating horse:', error);
      throw new Error('Failed to update horse');
    }
  }

  async archiveHorse(id: number, userId: number): Promise<Horse | null> {
    try {
      const query = `
        UPDATE horses
        SET archived = true, status = 'sold', updated_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `;
      const result = await this.pool.query(query, [id, userId]);
      if (!result.rows[0]) return null;
      return this.getHorseById(id);
    } catch (error) {
      logger.error('Error archiving horse:', error);
      throw new Error('Failed to archive horse');
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
        SELECT DISTINCT ${HORSE_SELECT_FIELDS}
        FROM horses h
        INNER JOIN horse_ownership ho ON h.id = ho.horse_id
        WHERE ho.member_id = $1 AND ho.is_active = true
        ORDER BY h.name
      `;
      
      const result = await this.pool.query(query, [memberId]);
      return this.mapHorseRows(result.rows);
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

      // Auto-log member activity for direct GFG purchase
      try {
        const memberActivityService = new MemberActivityService(this.pool);
        await memberActivityService.createFromDirectPurchase(client, {
          memberId: purchaseData.memberId,
          horseId,
          percentage: purchaseData.percentage,
          totalAmount: totalPrice,
          createdBy: userId,
        });
      } catch (activityErr) {
        logger.warn('Could not auto-log member activity (table may not exist yet):', activityErr);
      }

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
          COUNT(CASE WHEN status = 'active' AND COALESCE(archived, false) = false THEN 1 END) as active_horses,
          COUNT(CASE WHEN status = 'retired' THEN 1 END) as retired_horses,
          COUNT(CASE WHEN status = 'sold' OR COALESCE(archived, false) = true THEN 1 END) as sold_horses,
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
