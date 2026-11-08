import { describe, expect, it } from 'vitest';
import { cutLineDash, firstInteriorStage } from './cutStages';
import { CutLine } from '../types';

function cut(stage: number, isTrim = false): CutLine {
  return {
    id: `c-${stage}`,
    x1: 0,
    y1: 0,
    x2: 10,
    y2: 0,
    orientation: 'horizontal',
    stage,
    position: 0,
    description: '',
    ...(isTrim && { isTrim: true }),
  };
}

describe('firstInteriorStage', () => {
  it('is the first stage after the trim stages', () => {
    expect(firstInteriorStage([cut(1, true), cut(2, true), cut(3), cut(4)])).toBe(3);
  });

  it('is stage 1 when the sheet has no trim', () => {
    expect(firstInteriorStage([cut(1), cut(2)])).toBe(1);
  });

  it('is undefined when there are only trim cuts', () => {
    expect(firstInteriorStage([cut(1, true), cut(2, true)])).toBeUndefined();
  });
});

describe('cutLineDash', () => {
  const cuts = [cut(1, true), cut(2, true), cut(3), cut(4)];

  it('draws trim cuts dotted, primary interior cuts solid and later cuts dashed', () => {
    expect(cutLineDash(cuts[0], cuts)).toBe('dotted');
    expect(cutLineDash(cuts[2], cuts)).toBe('solid');
    expect(cutLineDash(cuts[3], cuts)).toBe('dashed');
  });
});
