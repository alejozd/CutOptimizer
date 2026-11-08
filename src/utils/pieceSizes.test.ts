import { describe, expect, it } from 'vitest';
import { formatSizePair, matchesSizeSearch, pieceSizes } from './pieceSizes';
import { PlacedPiece } from '../types';

function placed(overrides: Partial<PlacedPiece>): PlacedPiece {
  return {
    id: 'p-0',
    pieceId: 'p',
    pieceName: 'p',
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    originalLength: 600,
    originalWidth: 400,
    rotated: false,
    color: '#000',
    edgeBanding: { top: false, bottom: false, left: false, right: false },
    ...overrides,
  };
}

describe('pieceSizes', () => {
  it('reports cut and finished sizes as length × width of the piece', () => {
    expect(pieceSizes(placed({}))).toEqual({
      cutLength: 600,
      cutWidth: 400,
      finishedLength: 600,
      finishedWidth: 400,
      hasBandingDiscount: false,
    });
  });

  it('undoes the drawing rotation so length stays length', () => {
    // Drawn rotated: 400 wide on the sheet, 600 tall
    const sizes = pieceSizes(placed({ width: 400, height: 600, rotated: true }));

    expect(sizes.cutLength).toBe(600);
    expect(sizes.cutWidth).toBe(400);
  });

  it('undoes rotation before comparing with the finished size when the piece is banded', () => {
    // Finished 600 × 400, cut 596 × 396, drawn rotated as 396 wide × 596 tall
    const sizes = pieceSizes(placed({ width: 396, height: 596, rotated: true }));

    expect(sizes).toMatchObject({ cutLength: 596, cutWidth: 396, finishedLength: 600, finishedWidth: 400 });
    expect(sizes.hasBandingDiscount).toBe(true);
  });

  it('keeps decimal cut sizes when banding is thinner than a unit', () => {
    // 60 × 40 cm finished, 0.2 cm banding on one long edge
    const sizes = pieceSizes(placed({ width: 60, height: 39.8, originalLength: 60, originalWidth: 40 }));

    expect(formatSizePair(sizes.cutLength, sizes.cutWidth)).toBe('60 × 39.8');
    expect(sizes.hasBandingDiscount).toBe(true);
  });

  it('flags pieces whose cut size differs from the finished size because of banding', () => {
    const sizes = pieceSizes(placed({ width: 596, height: 396 }));

    expect(sizes).toMatchObject({ cutLength: 596, cutWidth: 396, finishedLength: 600, finishedWidth: 400 });
    expect(sizes.hasBandingDiscount).toBe(true);
  });
});

describe('matchesSizeSearch', () => {
  const rotatedBanded = placed({ width: 396.5, height: 596, rotated: true, originalLength: 600, originalWidth: 400 });

  it('finds a rotated piece by the size shown in the table, not the drawn size', () => {
    expect(matchesSizeSearch(rotatedBanded, '596x396.5')).toBe(true);
    expect(matchesSizeSearch(rotatedBanded, '396.5x596')).toBe(false);
  });

  it('also finds a piece by its finished size', () => {
    expect(matchesSizeSearch(rotatedBanded, '600x400')).toBe(true);
  });

  it('accepts the × sign, spaces and upper-case X', () => {
    expect(matchesSizeSearch(rotatedBanded, '596 × 396.5')).toBe(true);
    expect(matchesSizeSearch(rotatedBanded, '600 X 400')).toBe(true);
  });

  it('matches partial input while typing', () => {
    expect(matchesSizeSearch(rotatedBanded, '596')).toBe(true);
    expect(matchesSizeSearch(rotatedBanded, '777')).toBe(false);
  });
});
