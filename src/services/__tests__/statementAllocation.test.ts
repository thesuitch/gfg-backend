import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  allocateByOwnership,
  buildStatementsForPeriod,
  formatInvoiceNumber,
  membersWhoOwnedHorseInPeriod,
  monthBounds,
  ownershipAsOf,
  OwnershipEvent,
} from '../statementAllocation';

describe('monthBounds / addDays / invoice number', () => {
  it('returns the first and last calendar day of the month', () => {
    assert.deepEqual(monthBounds(2026, 2), { start: '2026-02-01', end: '2026-02-28' });
    assert.deepEqual(monthBounds(2024, 2), { start: '2024-02-01', end: '2024-02-29' });
  });

  it('adds 7 days for the due date without timezone shift', () => {
    assert.equal(addDays('2026-08-01', 7), '2026-08-08');
    assert.equal(addDays('2026-01-28', 7), '2026-02-04');
  });

  it('formats invoice numbers as GFG-YYYY-MM-#####', () => {
    assert.equal(formatInvoiceNumber(2026, 7, 12), 'GFG-2026-07-00012');
  });
});

describe('ownershipAsOf', () => {
  const events: OwnershipEvent[] = [
    { date: '2026-01-01', horseId: 1, memberId: 10, deltaPercent: 40 },
    { date: '2026-01-15', horseId: 1, memberId: 10, deltaPercent: -10 },
    { date: '2026-01-15', horseId: 1, memberId: 20, deltaPercent: 10 },
  ];

  it('returns ownership after events on or before the as-of date', () => {
    const jan10 = ownershipAsOf(events, 1, '2026-01-10');
    assert.equal(jan10.get(10), 40);
    assert.equal(jan10.get(20) ?? 0, 0);

    const jan15 = ownershipAsOf(events, 1, '2026-01-15');
    assert.equal(jan15.get(10), 30);
    assert.equal(jan15.get(20), 10);
  });
});

describe('allocateByOwnership', () => {
  it('splits a daily training cost by owned percent and leaves GFG remainder unallocated', () => {
    const owners = new Map<number, number>([[10, 25], [20, 25]]);
    const parts = allocateByOwnership(-10, owners);
    const byMember = Object.fromEntries(parts.map((p) => [p.memberId, p.amount]));
    assert.equal(byMember[10], -2.5);
    assert.equal(byMember[20], -2.5);
    assert.equal(parts.reduce((s, p) => s + p.amount, 0), -5);
  });
});

describe('membersWhoOwnedHorseInPeriod', () => {
  it('includes a member who sold mid-month', () => {
    const events: OwnershipEvent[] = [
      { date: '2026-01-01', horseId: 1, memberId: 10, deltaPercent: 20 },
      { date: '2026-03-12', horseId: 1, memberId: 10, deltaPercent: -20 },
      { date: '2026-03-12', horseId: 1, memberId: 20, deltaPercent: 20 },
    ];
    const owners = membersWhoOwnedHorseInPeriod(events, 1, '2026-03-01', '2026-03-31');
    assert.equal(owners.has(10), true);
    assert.equal(owners.has(20), true);
  });
});

describe('buildStatementsForPeriod', () => {
  it('allocates mid-month training to the owner on each line date and charges seller the 5% fee only', () => {
    const drafts = buildStatementsForPeriod({
      year: 2026,
      month: 3,
      generatedDate: '2026-04-01',
      members: [
        { id: 10, name: 'Seller Sam' },
        { id: 20, name: 'Buyer Bea' },
      ],
      horses: [{ id: 1, name: 'Northern Thunder' }],
      ownershipEvents: [
        { date: '2026-01-01', horseId: 1, memberId: 10, deltaPercent: 20 },
        { date: '2026-03-12', horseId: 1, memberId: 10, deltaPercent: -20 },
        { date: '2026-03-12', horseId: 1, memberId: 20, deltaPercent: 20 },
      ],
      rneLines: [
        {
          id: 1,
          horseId: 1,
          horseName: 'Northern Thunder',
          date: '2026-03-10',
          categoryName: 'Training',
          categoryType: 'expense',
          amount: -10,
        },
        {
          id: 2,
          horseId: 1,
          horseName: 'Northern Thunder',
          date: '2026-03-20',
          categoryName: 'Training',
          categoryType: 'expense',
          amount: -10,
        },
      ],
      activities: [
        {
          memberId: 10,
          horseId: 1,
          horseName: 'Northern Thunder',
          date: '2026-03-12',
          activityType: 'marketplace_sale',
          amount: 1500,
          fee: 75,
          percentage: 20,
          notes: 'Marketplace sale',
        },
        {
          memberId: 20,
          horseId: 1,
          horseName: 'Northern Thunder',
          date: '2026-03-12',
          activityType: 'marketplace_purchase',
          amount: -1500,
          fee: 75,
          percentage: 20,
          notes: 'Marketplace purchase',
        },
      ],
    });

    const seller = drafts.find((d) => d.memberId === 10)!;
    const buyer = drafts.find((d) => d.memberId === 20)!;

    assert.equal(seller.dueDate, '2026-04-08');
    assert.equal(seller.totalExpenses, 77); // $2 training + $75 fee
    assert.equal(seller.netAmount, -77);
    assert.equal(seller.isPaid, false);

    const sellerTraining = seller.transactions.filter((t) => t.description.includes('Training'));
    assert.equal(sellerTraining.length, 1);
    assert.equal(sellerTraining[0].amount, 2);

    const buyerTraining = buyer.transactions.filter((t) => t.description.includes('Training'));
    assert.equal(buyerTraining.length, 1);
    assert.equal(buyerTraining[0].amount, 2);
    assert.equal(buyer.totalExpenses, 2);
    assert.equal(buyer.netAmount, -2);

    const sellerSale = seller.transactions.find((t) => t.description.includes('Marketplace sale'));
    assert.ok(sellerSale);
    assert.equal(sellerSale!.type, 'adjustment');
    const feeLine = seller.transactions.find((t) => t.description.includes('Processing Fee'));
    assert.ok(feeLine);
    assert.equal(feeLine!.amount, 75);
  });
});
