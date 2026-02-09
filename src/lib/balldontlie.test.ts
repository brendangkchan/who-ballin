import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentNBASeason } from './balldontlie';

describe('getCurrentNBASeason', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns year + 1 for October through December', () => {
    vi.setSystemTime(new Date(2025, 9, 1)); // month is 0-indexed, so 9 = October
    expect(getCurrentNBASeason()).toBe(2026);

    vi.setSystemTime(new Date(2025, 10, 15)); // November
    expect(getCurrentNBASeason()).toBe(2026);

    vi.setSystemTime(new Date(2025, 11, 31)); // December
    expect(getCurrentNBASeason()).toBe(2026);
  });

  it('returns year for January through June', () => {
    vi.setSystemTime(new Date('2026-01-01'));
    expect(getCurrentNBASeason()).toBe(2026);

    vi.setSystemTime(new Date('2026-03-15'));
    expect(getCurrentNBASeason()).toBe(2026);

    vi.setSystemTime(new Date('2026-06-30'));
    expect(getCurrentNBASeason()).toBe(2026);
  });

  it('returns year for July through September (off-season)', () => {
    vi.setSystemTime(new Date('2026-07-01'));
    expect(getCurrentNBASeason()).toBe(2026);

    vi.setSystemTime(new Date('2026-08-15'));
    expect(getCurrentNBASeason()).toBe(2026);

    vi.setSystemTime(new Date('2026-09-30'));
    expect(getCurrentNBASeason()).toBe(2026);
  });
});
