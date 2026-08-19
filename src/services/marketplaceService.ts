import { Pool, PoolClient } from 'pg';
import { MemberActivityService } from './memberActivityService';
import { logger } from '../utils/logger';

const FEE_RATE = 0.05;

export interface MarketplaceListingDto {
  id: string;
  sellerId: string;
  sellerName: string;
  horseId: string;
  horseName: string;
  percentageOffered: number;
  pricePerPercent: number;
  totalValue: number;
  listDate: string;
  expiryDate: string;
  status: 'active' | 'sold' | 'expired' | 'cancelled';
  acceptOffers: boolean;
  description?: string;
  pendingTransferCount?: number;
  pendingOfferCount?: number;
}

export interface MarketplaceOfferDto {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  offerAmount: number;
  percentageRequested: number;
  message?: string;
  status: string;
  createdDate: string;
  expiryDate: string;
}

export interface MarketplaceTransferDto {
  id: string;
  listingId: string;
  offerId?: string;
  sellerId: string;
  buyerId: string;
  horseId: string;
  percentage: number;
  totalAmount: number;
  transferDate: string;
  status: 'pending' | 'completed' | 'cancelled';
  transferFee: number;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapListing(row: Record<string, unknown>): MarketplaceListingDto {
  const percentageOffered = parseFloat(String(row.percentage_offered));
  const pricePerPercent = parseFloat(String(row.price_per_percent));
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    sellerName: String(row.seller_name || '').trim() || `Member #${row.seller_id}`,
    horseId: String(row.horse_id),
    horseName: String(row.horse_name || ''),
    percentageOffered,
    pricePerPercent,
    totalValue: percentageOffered * pricePerPercent,
    // Prefer created_at so relative times are accurate (list_date is DATE-only / TZ-skewed)
    listDate: toIso(row.created_at || row.list_date),
    expiryDate: toDateString(row.expiry_date),
    status: row.status as MarketplaceListingDto['status'],
    acceptOffers: Boolean(row.accept_offers),
    description: row.description != null ? String(row.description) : undefined,
    pendingTransferCount: row.pending_transfer_count != null
      ? Number(row.pending_transfer_count)
      : undefined,
    pendingOfferCount: row.pending_offer_count != null
      ? Number(row.pending_offer_count)
      : undefined,
  };
}

function mapOffer(row: Record<string, unknown>): MarketplaceOfferDto {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    buyerId: String(row.buyer_id),
    buyerName: String(row.buyer_name || '').trim() || `Member #${row.buyer_id}`,
    offerAmount: parseFloat(String(row.offer_amount)),
    percentageRequested: parseFloat(String(row.percentage_requested)),
    message: row.message != null ? String(row.message) : undefined,
    status: String(row.status),
    createdDate: toIso(row.created_date),
    expiryDate: toDateString(row.expiry_date),
  };
}

function mapTransfer(row: Record<string, unknown>): MarketplaceTransferDto {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    offerId: row.offer_id != null ? String(row.offer_id) : undefined,
    sellerId: String(row.seller_id),
    buyerId: String(row.buyer_id),
    horseId: String(row.horse_id),
    percentage: parseFloat(String(row.percentage)),
    totalAmount: parseFloat(String(row.total_amount)),
    transferDate: row.transfer_date ? toIso(row.transfer_date) : toIso(row.created_at),
    status: row.status as MarketplaceTransferDto['status'],
    transferFee: parseFloat(String(row.transfer_fee ?? 0)),
  };
}

export class MarketplaceService {
  private pool: Pool;
  private activityService: MemberActivityService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.activityService = new MemberActivityService(pool);
  }

  private async getActiveOwnership(
    client: PoolClient,
    horseId: number,
    memberId: number
  ): Promise<{ id: number; percentage: number; purchasePrice: number } | null> {
    const result = await client.query(
      `SELECT id, percentage, purchase_price
       FROM horse_ownership
       WHERE horse_id = $1 AND member_id = $2 AND is_active = true
       FOR UPDATE`,
      [horseId, memberId]
    );
    if (!result.rows[0]) return null;
    return {
      id: Number(result.rows[0].id),
      percentage: parseFloat(String(result.rows[0].percentage)),
      purchasePrice: parseFloat(String(result.rows[0].purchase_price)),
    };
  }

  private async listedButUnsettled(
    client: PoolClient,
    sellerId: number,
    horseId: number,
    excludeListingId?: number
  ): Promise<number> {
    const result = await client.query(
      `SELECT COALESCE(SUM(percentage_offered), 0) AS total
       FROM marketplace_listings
       WHERE seller_id = $1 AND horse_id = $2 AND status = 'active'
         AND ($3::int IS NULL OR id <> $3)`,
      [sellerId, horseId, excludeListingId ?? null]
    );
    const pending = await client.query(
      `SELECT COALESCE(SUM(percentage), 0) AS total
       FROM marketplace_transfers
       WHERE seller_id = $1 AND horse_id = $2 AND status = 'pending'`,
      [sellerId, horseId]
    );
    return parseFloat(String(result.rows[0].total)) + parseFloat(String(pending.rows[0].total));
  }

  async listListings(filters: {
    status?: string;
    sellerId?: number;
    includeCounts?: boolean;
  } = {}): Promise<MarketplaceListingDto[]> {
    const params: unknown[] = [];
    const where: string[] = [];

    if (filters.status) {
      params.push(filters.status);
      where.push(`l.status = $${params.length}`);
    }
    if (filters.sellerId != null) {
      params.push(filters.sellerId);
      where.push(`l.seller_id = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT l.*,
              h.name AS horse_name,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS seller_name,
              (SELECT COUNT(*) FROM marketplace_transfers t
                WHERE t.listing_id = l.id AND t.status = 'pending') AS pending_transfer_count,
              (SELECT COUNT(*) FROM marketplace_offers o
                WHERE o.listing_id = l.id AND o.status = 'pending') AS pending_offer_count
       FROM marketplace_listings l
       JOIN horses h ON h.id = l.horse_id
       JOIN users u ON u.id = l.seller_id
       ${whereSql}
       ORDER BY l.list_date DESC, l.id DESC`,
      params
    );

    return result.rows.map(mapListing);
  }

  async getListingById(id: number): Promise<MarketplaceListingDto | null> {
    const rows = await this.listListings({});
    return rows.find((l) => l.id === String(id)) ?? null;
  }

  async createListing(
    sellerId: number,
    data: {
      horseId: number;
      percentageOffered: number;
      pricePerPercent: number;
      acceptOffers: boolean;
      description?: string;
      listingDurationDays: number;
    }
  ): Promise<MarketplaceListingDto> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const ownership = await this.getActiveOwnership(client, data.horseId, sellerId);
      if (!ownership) {
        throw Object.assign(new Error('You do not own shares in this horse'), { code: 'NO_OWNERSHIP' });
      }

      const alreadyListed = await this.listedButUnsettled(client, sellerId, data.horseId);
      const available = ownership.percentage - alreadyListed;
      if (data.percentageOffered < 1 || data.percentageOffered > available + 1e-9) {
        throw Object.assign(
          new Error(`You can list between 1% and ${Math.max(0, available).toFixed(2)}%`),
          { code: 'INVALID_PERCENTAGE' }
        );
      }

      const horse = await client.query(`SELECT id, name FROM horses WHERE id = $1`, [data.horseId]);
      if (!horse.rows[0]) {
        throw Object.assign(new Error('Horse not found'), { code: 'NOT_FOUND' });
      }

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + data.listingDurationDays);

      const result = await client.query(
        `INSERT INTO marketplace_listings (
          seller_id, horse_id, percentage_offered, price_per_percent,
          accept_offers, description, status, list_date, expiry_date
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_DATE, $7)
        RETURNING id`,
        [
          sellerId,
          data.horseId,
          data.percentageOffered,
          data.pricePerPercent,
          data.acceptOffers,
          data.description || null,
          expiry.toISOString().slice(0, 10),
        ]
      );

      await client.query('COMMIT');
      const listing = await this.getListingById(Number(result.rows[0].id));
      if (!listing) throw new Error('Failed to load created listing');
      return listing;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('createListing failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateListing(
    listingId: number,
    actor: { userId: number; isStaff: boolean },
    data: { percentageOffered: number; pricePerPercent: number }
  ): Promise<MarketplaceListingDto> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const listingResult = await client.query(
        `SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE`,
        [listingId]
      );
      const listing = listingResult.rows[0];
      if (!listing) {
        throw Object.assign(new Error('Listing not found'), { code: 'NOT_FOUND' });
      }
      if (listing.status !== 'active') {
        throw Object.assign(new Error('Only active listings can be updated'), { code: 'INVALID_STATUS' });
      }
      if (!actor.isStaff && Number(listing.seller_id) !== actor.userId) {
        throw Object.assign(new Error('Insufficient permissions'), { code: 'FORBIDDEN' });
      }

      const ownership = await this.getActiveOwnership(
        client,
        Number(listing.horse_id),
        Number(listing.seller_id)
      );
      if (!ownership) {
        throw Object.assign(new Error('Seller no longer owns this horse'), { code: 'NO_OWNERSHIP' });
      }

      const alreadyListed = await this.listedButUnsettled(
        client,
        Number(listing.seller_id),
        Number(listing.horse_id),
        listingId
      );
      const available = ownership.percentage - alreadyListed;
      if (data.percentageOffered < 1 || data.percentageOffered > available + 1e-9) {
        throw Object.assign(
          new Error(`Percentage must be between 1 and ${Math.max(0, available).toFixed(2)}`),
          { code: 'INVALID_PERCENTAGE' }
        );
      }

      await client.query(
        `UPDATE marketplace_listings
         SET percentage_offered = $1,
             price_per_percent = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [data.percentageOffered, data.pricePerPercent, listingId]
      );

      await client.query('COMMIT');
      const updated = await this.getListingById(listingId);
      if (!updated) throw new Error('Failed to load updated listing');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelListing(
    listingId: number,
    actor: { userId: number; isStaff: boolean }
  ): Promise<void> {
    const listingResult = await this.pool.query(
      `SELECT * FROM marketplace_listings WHERE id = $1`,
      [listingId]
    );
    const listing = listingResult.rows[0];
    if (!listing) {
      throw Object.assign(new Error('Listing not found'), { code: 'NOT_FOUND' });
    }
    if (!actor.isStaff && Number(listing.seller_id) !== actor.userId) {
      throw Object.assign(new Error('Insufficient permissions'), { code: 'FORBIDDEN' });
    }
    if (listing.status !== 'active') {
      throw Object.assign(new Error('Listing is not active'), { code: 'INVALID_STATUS' });
    }

    const pending = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM marketplace_transfers
       WHERE listing_id = $1 AND status = 'pending'`,
      [listingId]
    );
    if (pending.rows[0].c > 0) {
      throw Object.assign(
        new Error('Cannot cancel listing with pending payment confirmations'),
        { code: 'HAS_PENDING' }
      );
    }

    await this.pool.query(
      `UPDATE marketplace_listings
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [listingId]
    );
    await this.pool.query(
      `UPDATE marketplace_offers SET status = 'cancelled'
       WHERE listing_id = $1 AND status = 'pending'`,
      [listingId]
    );
  }

  async createOffer(
    listingId: number,
    buyerId: number,
    data: {
      percentageRequested: number;
      offerAmount: number;
      message?: string;
      expiryDays: number;
    }
  ): Promise<MarketplaceOfferDto> {
    const listingResult = await this.pool.query(
      `SELECT * FROM marketplace_listings WHERE id = $1`,
      [listingId]
    );
    const listing = listingResult.rows[0];
    if (!listing || listing.status !== 'active') {
      throw Object.assign(new Error('Listing not available'), { code: 'NOT_FOUND' });
    }
    if (!listing.accept_offers) {
      throw Object.assign(new Error('This listing does not accept offers'), { code: 'NO_OFFERS' });
    }
    if (Number(listing.seller_id) === buyerId) {
      throw Object.assign(new Error('Cannot offer on your own listing'), { code: 'FORBIDDEN' });
    }
    if (
      data.percentageRequested < 1 ||
      data.percentageRequested > parseFloat(String(listing.percentage_offered))
    ) {
      throw Object.assign(new Error('Invalid percentage requested'), { code: 'INVALID_PERCENTAGE' });
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + data.expiryDays);

    const result = await this.pool.query(
      `INSERT INTO marketplace_offers (
        listing_id, buyer_id, percentage_requested, offer_amount, message, status, expiry_date
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      RETURNING id`,
      [
        listingId,
        buyerId,
        data.percentageRequested,
        data.offerAmount,
        data.message || null,
        expiry.toISOString().slice(0, 10),
      ]
    );

    const offer = await this.pool.query(
      `SELECT o.*,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS buyer_name
       FROM marketplace_offers o
       JOIN users u ON u.id = o.buyer_id
       WHERE o.id = $1`,
      [result.rows[0].id]
    );
    return mapOffer(offer.rows[0]);
  }

  async listOffers(filters: {
    buyerId?: number;
    listingId?: number;
    sellerId?: number;
    status?: string;
  }): Promise<MarketplaceOfferDto[]> {
    const params: unknown[] = [];
    const where: string[] = [];

    if (filters.buyerId != null) {
      params.push(filters.buyerId);
      where.push(`o.buyer_id = $${params.length}`);
    }
    if (filters.listingId != null) {
      params.push(filters.listingId);
      where.push(`o.listing_id = $${params.length}`);
    }
    if (filters.sellerId != null) {
      params.push(filters.sellerId);
      where.push(`l.seller_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`o.status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT o.*,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS buyer_name
       FROM marketplace_offers o
       JOIN users u ON u.id = o.buyer_id
       JOIN marketplace_listings l ON l.id = o.listing_id
       ${whereSql}
       ORDER BY o.created_date DESC`,
      params
    );
    return result.rows.map(mapOffer);
  }

  /** Buyer purchases at listing price → pending transfer until seller confirms payment. */
  async requestPurchase(
    listingId: number,
    buyerId: number,
    percentage: number
  ): Promise<MarketplaceTransferDto> {
    return this.createPendingTransfer({
      listingId,
      buyerId,
      percentage,
      amount: null,
      offerId: null,
    });
  }

  /** Seller accepts an offer → pending transfer until payment confirmed. */
  async acceptOffer(
    offerId: number,
    sellerId: number
  ): Promise<MarketplaceTransferDto> {
    const offerResult = await this.pool.query(
      `SELECT o.*, l.seller_id, l.status AS listing_status, l.accept_offers
       FROM marketplace_offers o
       JOIN marketplace_listings l ON l.id = o.listing_id
       WHERE o.id = $1`,
      [offerId]
    );
    const offer = offerResult.rows[0];
    if (!offer || offer.status !== 'pending') {
      throw Object.assign(new Error('Offer not available'), { code: 'NOT_FOUND' });
    }
    if (Number(offer.seller_id) !== sellerId) {
      throw Object.assign(new Error('Insufficient permissions'), { code: 'FORBIDDEN' });
    }
    if (offer.listing_status !== 'active') {
      throw Object.assign(new Error('Listing is not active'), { code: 'INVALID_STATUS' });
    }

    await this.pool.query(
      `UPDATE marketplace_offers SET status = 'accepted' WHERE id = $1`,
      [offerId]
    );
    await this.pool.query(
      `UPDATE marketplace_offers SET status = 'cancelled'
       WHERE listing_id = $1 AND status = 'pending' AND id <> $2`,
      [offer.listing_id, offerId]
    );

    return this.createPendingTransfer({
      listingId: Number(offer.listing_id),
      buyerId: Number(offer.buyer_id),
      percentage: parseFloat(String(offer.percentage_requested)),
      amount: parseFloat(String(offer.offer_amount)),
      offerId,
    });
  }

  async rejectOffer(offerId: number, sellerId: number): Promise<void> {
    const offerResult = await this.pool.query(
      `SELECT o.*, l.seller_id
       FROM marketplace_offers o
       JOIN marketplace_listings l ON l.id = o.listing_id
       WHERE o.id = $1`,
      [offerId]
    );
    const offer = offerResult.rows[0];
    if (!offer || offer.status !== 'pending') {
      throw Object.assign(new Error('Offer not available'), { code: 'NOT_FOUND' });
    }
    if (Number(offer.seller_id) !== sellerId) {
      throw Object.assign(new Error('Insufficient permissions'), { code: 'FORBIDDEN' });
    }
    await this.pool.query(
      `UPDATE marketplace_offers SET status = 'rejected' WHERE id = $1`,
      [offerId]
    );
  }

  private async createPendingTransfer(params: {
    listingId: number;
    buyerId: number;
    percentage: number;
    amount: number | null;
    offerId: number | null;
  }): Promise<MarketplaceTransferDto> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const listingResult = await client.query(
        `SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE`,
        [params.listingId]
      );
      const listing = listingResult.rows[0];
      if (!listing || listing.status !== 'active') {
        throw Object.assign(new Error('Listing not available'), { code: 'NOT_FOUND' });
      }
      if (Number(listing.seller_id) === params.buyerId) {
        throw Object.assign(new Error('Cannot buy your own listing'), { code: 'FORBIDDEN' });
      }

      const available = parseFloat(String(listing.percentage_offered));
      if (params.percentage < 1 || params.percentage > available + 1e-9) {
        throw Object.assign(new Error('Invalid purchase percentage'), { code: 'INVALID_PERCENTAGE' });
      }

      const ownership = await this.getActiveOwnership(
        client,
        Number(listing.horse_id),
        Number(listing.seller_id)
      );
      if (!ownership || ownership.percentage + 1e-9 < params.percentage) {
        throw Object.assign(new Error('Seller does not have enough shares'), { code: 'INSUFFICIENT_SHARES' });
      }

      const totalAmount =
        params.amount != null
          ? params.amount
          : params.percentage * parseFloat(String(listing.price_per_percent));
      const transferFee = totalAmount * FEE_RATE;

      const remaining = available - params.percentage;
      await client.query(
        `UPDATE marketplace_listings
         SET percentage_offered = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [Math.max(0, remaining), params.listingId]
      );

      const transferResult = await client.query(
        `INSERT INTO marketplace_transfers (
          listing_id, offer_id, seller_id, buyer_id, horse_id,
          percentage, total_amount, transfer_fee, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          params.listingId,
          params.offerId,
          listing.seller_id,
          params.buyerId,
          listing.horse_id,
          params.percentage,
          totalAmount,
          transferFee,
        ]
      );

      await client.query('COMMIT');
      return mapTransfer(transferResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listTransfers(filters: {
    sellerId?: number;
    buyerId?: number;
    listingId?: number;
    status?: string;
  }): Promise<MarketplaceTransferDto[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (filters.sellerId != null) {
      params.push(filters.sellerId);
      where.push(`seller_id = $${params.length}`);
    }
    if (filters.buyerId != null) {
      params.push(filters.buyerId);
      where.push(`buyer_id = $${params.length}`);
    }
    if (filters.listingId != null) {
      params.push(filters.listingId);
      where.push(`listing_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM marketplace_transfers ${whereSql} ORDER BY created_at DESC`,
      params
    );
    return result.rows.map(mapTransfer);
  }

  /** Seller (or staff) confirms payment received → move ownership + log activities. */
  async confirmTransfer(
    transferId: number,
    actor: { userId: number; isStaff: boolean }
  ): Promise<MarketplaceTransferDto> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const transferResult = await client.query(
        `SELECT * FROM marketplace_transfers WHERE id = $1 FOR UPDATE`,
        [transferId]
      );
      const transfer = transferResult.rows[0];
      if (!transfer || transfer.status !== 'pending') {
        throw Object.assign(new Error('Transfer not available'), { code: 'NOT_FOUND' });
      }
      if (!actor.isStaff && Number(transfer.seller_id) !== actor.userId) {
        throw Object.assign(new Error('Only the seller can confirm payment'), { code: 'FORBIDDEN' });
      }

      const horseId = Number(transfer.horse_id);
      const sellerId = Number(transfer.seller_id);
      const buyerId = Number(transfer.buyer_id);
      const percentage = parseFloat(String(transfer.percentage));
      const totalAmount = parseFloat(String(transfer.total_amount));

      const sellerOwn = await this.getActiveOwnership(client, horseId, sellerId);
      if (!sellerOwn || sellerOwn.percentage + 1e-9 < percentage) {
        throw Object.assign(new Error('Seller no longer has enough shares'), {
          code: 'INSUFFICIENT_SHARES',
        });
      }

      const sellerRemaining = sellerOwn.percentage - percentage;
      const sellerPricePortion =
        sellerOwn.purchasePrice * (percentage / sellerOwn.percentage);

      if (sellerRemaining < 0.01) {
        await client.query(
          `UPDATE horse_ownership SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [sellerOwn.id]
        );
      } else {
        await client.query(
          `UPDATE horse_ownership
           SET percentage = $1,
               purchase_price = purchase_price - $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [sellerRemaining, sellerPricePortion, sellerOwn.id]
        );
      }

      const buyerOwn = await this.getActiveOwnership(client, horseId, buyerId);
      if (buyerOwn) {
        await client.query(
          `UPDATE horse_ownership
           SET percentage = percentage + $1,
               purchase_price = purchase_price + $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [percentage, totalAmount, buyerOwn.id]
        );
      } else {
        await client.query(
          `INSERT INTO horse_ownership (
            horse_id, member_id, percentage, purchase_date, purchase_price, is_active
          ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, true)`,
          [horseId, buyerId, percentage, totalAmount]
        );
      }

      await client.query(
        `INSERT INTO horse_transactions (
          horse_id, member_id, transaction_type, percentage, price_per_percent,
          total_amount, transaction_date, notes, created_by
        ) VALUES ($1, $2, 'transfer', $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)`,
        [
          horseId,
          buyerId,
          percentage,
          totalAmount / percentage,
          totalAmount,
          `Marketplace transfer from member ${sellerId}`,
          actor.userId,
        ]
      );

      await this.activityService.createFromMarketplace(client, {
        buyerId,
        sellerId,
        horseId,
        percentage,
        amount: totalAmount,
        createdBy: actor.userId,
      });

      const completed = await client.query(
        `UPDATE marketplace_transfers
         SET status = 'completed',
             transfer_date = CURRENT_TIMESTAMP,
             confirmed_by = $2,
             confirmed_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [transferId, actor.userId]
      );

      // Mark listing sold when nothing left and no other pending transfers
      const listingRow = await client.query(
        `SELECT percentage_offered FROM marketplace_listings WHERE id = $1 FOR UPDATE`,
        [transfer.listing_id]
      );
      if (listingRow.rows[0]) {
        const remainingPct = parseFloat(String(listingRow.rows[0].percentage_offered));
        const otherPending = await client.query(
          `SELECT COUNT(*)::int AS c FROM marketplace_transfers
           WHERE listing_id = $1 AND status = 'pending' AND id <> $2`,
          [transfer.listing_id, transferId]
        );
        if (remainingPct < 0.01 && otherPending.rows[0].c === 0) {
          await client.query(
            `UPDATE marketplace_listings
             SET status = 'sold', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [transfer.listing_id]
          );
        }
      }

      await client.query('COMMIT');
      return mapTransfer(completed.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('confirmTransfer failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelTransfer(
    transferId: number,
    actor: { userId: number; isStaff: boolean }
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const transferResult = await client.query(
        `SELECT * FROM marketplace_transfers WHERE id = $1 FOR UPDATE`,
        [transferId]
      );
      const transfer = transferResult.rows[0];
      if (!transfer || transfer.status !== 'pending') {
        throw Object.assign(new Error('Transfer not available'), { code: 'NOT_FOUND' });
      }
      if (
        !actor.isStaff &&
        Number(transfer.seller_id) !== actor.userId &&
        Number(transfer.buyer_id) !== actor.userId
      ) {
        throw Object.assign(new Error('Insufficient permissions'), { code: 'FORBIDDEN' });
      }

      await client.query(
        `UPDATE marketplace_transfers SET status = 'cancelled' WHERE id = $1`,
        [transferId]
      );

      // Restore listing percentage if listing still exists
      const listingResult = await client.query(
        `SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE`,
        [transfer.listing_id]
      );
      const listing = listingResult.rows[0];
      if (listing) {
        const restored =
          parseFloat(String(listing.percentage_offered)) +
          parseFloat(String(transfer.percentage));
        await client.query(
          `UPDATE marketplace_listings
           SET percentage_offered = $1,
               status = CASE WHEN status = 'sold' THEN 'active' ELSE status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [restored, transfer.listing_id]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
