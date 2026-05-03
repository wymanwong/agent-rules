import { describe, it, expect } from 'vitest';
import { computeDueAtIso, computePriority, formatTicketNumber } from './prioritySla.js';

describe('computePriority', () => {
  it('maps Organization + Critical to P1', () => {
    expect(computePriority('Organization', 'Critical')).toBe('P1');
  });
  it('maps SingleUser + Low to P4', () => {
    expect(computePriority('SingleUser', 'Low')).toBe('P4');
  });
});

describe('computeDueAtIso', () => {
  it('adds 4 hours for P1', () => {
    const base = new Date('2026-05-02T12:00:00.000Z');
    const due = new Date(computeDueAtIso(base, 'P1'));
    expect(due.getTime() - base.getTime()).toBe(4 * 60 * 60 * 1000);
  });
  it('adds 8 hours for P2', () => {
    const base = new Date('2026-05-02T12:00:00.000Z');
    const due = new Date(computeDueAtIso(base, 'P2'));
    expect(due.getTime() - base.getTime()).toBe(8 * 60 * 60 * 1000);
  });
});

describe('formatTicketNumber', () => {
  it('pads id to 6 digits', () => {
    expect(formatTicketNumber(1)).toBe('IT-000001');
    expect(formatTicketNumber(123456)).toBe('IT-123456');
  });
});
