import * as crypto from 'crypto';

export function generateZapierToken(length = 240): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}
