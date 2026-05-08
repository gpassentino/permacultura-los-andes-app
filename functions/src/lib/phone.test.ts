import { describe, it, expect } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone (functions parity with Angular src/app/shared/utils/phone.ts)', () => {
  it('returns empty for null/undefined/empty', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('')).toBe('');
  });

  it('returns empty when input has no digits', () => {
    expect(normalizePhone('abc')).toBe('');
    expect(normalizePhone('-- --')).toBe('');
  });

  it('preserves leading + and strips non-digits', () => {
    expect(normalizePhone('+57 300 123 4567')).toBe('+573001234567');
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('treats a 12-digit number starting with 57 as already-international', () => {
    expect(normalizePhone('573001234567')).toBe('+573001234567');
  });

  it('prepends +57 default country code when no + and not 57-prefixed', () => {
    expect(normalizePhone('3001234567')).toBe('+573001234567');
    expect(normalizePhone('300 123 4567')).toBe('+573001234567');
  });

  it('does not treat short 57-starting numbers as international', () => {
    expect(normalizePhone('5712345')).toBe('+575712345');
  });
});
