import { describe, expect, it } from '@jest/globals';
import { decodeBase64Utf8 } from '@/lib/encoding';

describe('decodeBase64Utf8', () => {
  it('decodes ASCII', () => {
    // "Journal" base64
    expect(decodeBase64Utf8('Sm91cm5hbA==')).toBe('Journal');
  });

  it('decodes multibyte UTF-8 (accents)', () => {
    // "Télé Matin" base64
    expect(decodeBase64Utf8('VMOpbMOpIE1hdGlu')).toBe('Télé Matin');
  });

  it('tolerates whitespace/newlines in the input', () => {
    expect(decodeBase64Utf8('Sm91\ncm5h\nbA==')).toBe('Journal');
  });
});
