import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  OrderStatus,
  canTransition,
  isFinalStatus,
} from './order-status.js';

describe('canTransition', () => {
  const valid: [OrderStatus, OrderStatus][] = [
    ['pending', 'paid'],
    ['paid', 'processing'],
    ['processing', 'shipped'],
    ['shipped', 'delivered'],
    ['delivered', 'completed'],
    ['pending', 'expired'],
    ['pending', 'cancelled'],
    ['paid', 'cancelled'],
    ['processing', 'cancelled'],
  ];

  it.each(valid)('mengizinkan %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('menolak semua transisi di luar state machine', () => {
    const allowed = new Set(valid.map(([from, to]) => `${from}>${to}`));
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (!allowed.has(`${from}>${to}`)) {
          expect(canTransition(from, to), `${from} → ${to}`).toBe(false);
        }
      }
    }
  });

  it.each([
    ['paid', 'pending'],
    ['shipped', 'cancelled'],
    ['delivered', 'cancelled'],
    ['expired', 'paid'],
    ['cancelled', 'paid'],
    ['pending', 'shipped'],
    ['pending', 'pending'],
  ] as [OrderStatus, OrderStatus][])('menolak %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('isFinalStatus', () => {
  it('completed, expired, dan cancelled adalah status akhir', () => {
    expect(ORDER_STATUSES.filter(isFinalStatus).sort()).toEqual(
      [OrderStatus.CANCELLED, OrderStatus.COMPLETED, OrderStatus.EXPIRED].sort(),
    );
  });
});

describe('ORDER_STATUS_LABEL', () => {
  it('setiap status punya label Bahasa Indonesia', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});
