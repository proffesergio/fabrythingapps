import { FOOD_STATUS, forwardStatus, isTerminal, nextStatuses } from './status';

describe('food order status machine (mirror of the server table)', () => {
  it('offers the single forward step, ignoring cancellation', () => {
    expect(forwardStatus(FOOD_STATUS.PLACED)).toBe(FOOD_STATUS.CONFIRMED);
    expect(forwardStatus(FOOD_STATUS.CONFIRMED)).toBe(FOOD_STATUS.PREPARING);
    expect(forwardStatus(FOOD_STATUS.PREPARING)).toBe(FOOD_STATUS.OUT_FOR_DELIVERY);
    expect(forwardStatus(FOOD_STATUS.OUT_FOR_DELIVERY)).toBe(FOOD_STATUS.DELIVERED);
  });

  it('allows cancellation from every non-terminal state', () => {
    for (const s of [FOOD_STATUS.PLACED, FOOD_STATUS.CONFIRMED, FOOD_STATUS.PREPARING, FOOD_STATUS.OUT_FOR_DELIVERY]) {
      expect(nextStatuses(s)).toContain(FOOD_STATUS.CANCELLED);
    }
  });

  it('treats DELIVERED and CANCELLED as terminal with no forward step', () => {
    expect(isTerminal(FOOD_STATUS.DELIVERED)).toBe(true);
    expect(isTerminal(FOOD_STATUS.CANCELLED)).toBe(true);
    expect(forwardStatus(FOOD_STATUS.DELIVERED)).toBeNull();
    expect(forwardStatus(FOOD_STATUS.CANCELLED)).toBeNull();
  });

  it('never allows skipping a stage', () => {
    expect(nextStatuses(FOOD_STATUS.PLACED)).not.toContain(FOOD_STATUS.DELIVERED);
    expect(nextStatuses(FOOD_STATUS.CONFIRMED)).not.toContain(FOOD_STATUS.OUT_FOR_DELIVERY);
  });

  it('returns [] for an unknown status rather than throwing', () => {
    expect(nextStatuses('NOPE')).toEqual([]);
    expect(isTerminal('NOPE')).toBe(true);
  });
});
