import { describe, expect, it } from 'vitest';
import { pieceSizes } from './pieceSizes';
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

  it('flags pieces whose cut size differs from the finished size because of banding', () => {
    const sizes = pieceSizes(placed({ width: 596, height: 396 }));

    expect(sizes).toMatchObject({ cutLength: 596, cutWidth: 396, finishedLength: 600, finishedWidth: 400 });
    expect(sizes.hasBandingDiscount).toBe(true);
  });
});
