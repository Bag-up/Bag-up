import { currentMonthKey, nextTier, tierForCount } from './loyalty-tiers';

describe('loyalty-tiers', () => {
  it('starts at Ivoire', () => {
    expect(tierForCount(0).key).toBe('ivoire');
    expect(tierForCount(9).key).toBe('ivoire');
  });

  it('unlocks Élan / Genius / Silver / Gold at 10 / 25 / 50 / 100', () => {
    expect(tierForCount(10).key).toBe('elan');
    expect(tierForCount(24).key).toBe('elan');
    expect(tierForCount(25).key).toBe('genius');
    expect(tierForCount(50).key).toBe('silver');
    expect(tierForCount(99).key).toBe('silver');
    expect(tierForCount(100).key).toBe('gold');
    expect(tierForCount(250).key).toBe('gold');
  });

  it('returns the next palier until Gold', () => {
    expect(nextTier(1)?.key).toBe('elan');
    expect(nextTier(4)?.key).toBe('gold');
    expect(nextTier(5)).toBeNull();
  });

  it('formats UTC month key', () => {
    expect(currentMonthKey(new Date('2026-08-28T10:00:00.000Z'))).toBe('2026-08');
  });
});
