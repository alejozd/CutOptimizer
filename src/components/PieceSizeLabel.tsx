import React from 'react';
import { Unit } from '../types';
import { PieceSizes, formatSizePair } from '../utils/pieceSizes';

interface PieceSizeLabelProps {
  sizes: PieceSizes;
  unit: Unit;
}

/** Cut size (what goes on the saw); the finished size is added below only when banding changes it. */
export const PieceSizeLabel: React.FC<PieceSizeLabelProps> = ({ sizes, unit }) => (
  <span className="inline-flex flex-col leading-tight">
    <span>
      {formatSizePair(sizes.cutLength, sizes.cutWidth)} {unit}
    </span>
    {sizes.hasBandingDiscount && (
      <span className="text-[10px] font-normal text-stone-500">
        Terminada: {formatSizePair(sizes.finishedLength, sizes.finishedWidth)} {unit}
      </span>
    )}
  </span>
);
