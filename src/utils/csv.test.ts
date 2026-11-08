import { describe, expect, it } from 'vitest';
import { buildCsv, csvDataUri } from './csv';

describe('buildCsv', () => {
  it('quotes text cells and leaves numbers as they are', () => {
    expect(buildCsv([['Pieza', 'Largo'], ['Lateral', 720]])).toBe('"Pieza","Largo"\n"Lateral",720');
  });

  it('escapes embedded double quotes so the columns stay aligned', () => {
    expect(buildCsv([['Puerta "grande"', 1]])).toBe('"Puerta ""grande""",1');
  });

  it('keeps commas and line breaks inside a single quoted cell', () => {
    expect(buildCsv([['Estante, alto\nizquierdo', 2]])).toBe('"Estante, alto\nizquierdo",2');
  });

  it('neutralizes text that a spreadsheet would run as a formula', () => {
    const row = buildCsv([['=HYPERLINK("x")', '+1', '-cmd', '@SUM(A1)']]);

    expect(row).toBe('"\'=HYPERLINK(""x"")","\'+1","\'-cmd","\'@SUM(A1)"');
  });

  it('does not alter negative numbers passed as numbers', () => {
    expect(buildCsv([[-5]])).toBe('-5');
  });
});

describe('csvDataUri', () => {
  it('encodes characters that would cut a data URI short, such as #', () => {
    const uri = csvDataUri('"Puerta #1",2');

    expect(uri.startsWith('data:text/csv;charset=utf-8,')).toBe(true);
    expect(uri).not.toContain('#');
    const body = decodeURIComponent(uri.slice('data:text/csv;charset=utf-8,'.length));
    // Byte order mark first, checked by code point so it cannot pass as literal text
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body.slice(1)).toBe('"Puerta #1",2');
  });
});
