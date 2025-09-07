export function isValidUSMobile(mobile: string): boolean {
  const cleaned = mobile.replace(/\D/g, '');

  const normalized =
    cleaned.startsWith('1') && cleaned.length === 11
      ? cleaned.slice(1)
      : cleaned;

  return /^\d{10}$/.test(normalized);
}
