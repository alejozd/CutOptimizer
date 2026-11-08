export type CsvCell = string | number;

/** Leading characters that make spreadsheets evaluate a cell as a formula (CSV injection). */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

function formatCell(cell: CsvCell): string {
  if (typeof cell === 'number') return String(cell);
  // Prefix formula triggers with an apostrophe so Excel/Sheets show the text instead of running it
  const safe = FORMULA_TRIGGERS.test(cell) ? `'${cell}` : cell;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Builds RFC 4180 CSV text: text cells quoted with doubled inner quotes, numbers left bare. */
export function buildCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(formatCell).join(',')).join('\n');
}

/**
 * Data URI for downloading CSV text. Uses encodeURIComponent because encodeURI leaves "#"
 * untouched, which would truncate the file at the first "#". The BOM lets Excel detect UTF-8.
 */
export function csvDataUri(csv: string): string {
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
}
