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

export function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b) && normalizePhone(a) !== '';
}
