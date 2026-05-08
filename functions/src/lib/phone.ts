// Ported from src/app/shared/utils/phone.ts — keep behavior in sync.
// Both implementations are covered by parity tests in their respective workspaces.

const DEFAULT_COUNTRY_CODE = '+57';

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (input.trim().startsWith('+')) {
    return '+' + digits;
  }
  if (digits.startsWith('57') && digits.length >= 12) {
    return '+' + digits;
  }
  return DEFAULT_COUNTRY_CODE + digits;
}
