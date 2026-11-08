import { PlacedPiece } from '../types';

export interface PieceSizes {
  /** Size to cut on the saw, as length × width of the piece (rotation on the sheet undone) */
  cutLength: number;
  cutWidth: number;
  /** Size of the finished piece, including edge banding, as entered by the user */
  finishedLength: number;
  finishedWidth: number;
  /** True when edge banding thickness makes the cut size smaller than the finished size */
  hasBandingDiscount: boolean;
}

export function pieceSizes(piece: PlacedPiece): PieceSizes {
  const cutLength = piece.rotated ? piece.height : piece.width;
  const cutWidth = piece.rotated ? piece.width : piece.height;
  return {
    cutLength,
    cutWidth,
    finishedLength: piece.originalLength,
    finishedWidth: piece.originalWidth,
    hasBandingDiscount: cutLength !== piece.originalLength || cutWidth !== piece.originalWidth,
  };
}

/** Formats a size pair with up to two decimals, e.g. "596 × 396.5" */
export function formatSizePair(length: number, width: number): string {
  return `${Number(length.toFixed(2))} × ${Number(width.toFixed(2))}`;
}
