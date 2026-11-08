import { CutLine } from '../types';

/** First stage that contains interior (non-trim) cuts: 1 without trim, 3 after trimming. */
export function firstInteriorStage(cutLines: CutLine[]): number | undefined {
  const stages = cutLines.filter((c) => !c.isTrim).map((c) => c.stage);
  return stages.length > 0 ? Math.min(...stages) : undefined;
}

export type CutLineDash = 'dotted' | 'solid' | 'dashed';

/** Trim cuts are dotted, the primary interior cuts solid, and every later cut dashed. */
export function cutLineDash(cut: CutLine, cutLines: CutLine[]): CutLineDash {
  if (cut.isTrim) return 'dotted';
  return cut.stage === firstInteriorStage(cutLines) ? 'solid' : 'dashed';
}
