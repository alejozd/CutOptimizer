import { OptimizationResult } from '../types';

export interface ResultSummary {
  efficiencyLabel: string;
  sheetsLabel: string;
  placedLabel: string;
  hasUnplaced: boolean;
  isEmpty: boolean;
}

/** Compact, always-visible summary of the optimization shown in the step tabs bar. */
export function summarizeResult(result: OptimizationResult): ResultSummary {
  const { totalSheetsNeeded: sheets, totalPiecesPlaced: placed, totalPiecesRequested: requested } = result;
  return {
    efficiencyLabel: `${result.overallEfficiency}%`,
    sheetsLabel: `${sheets} ${sheets === 1 ? 'lámina' : 'láminas'}`,
    placedLabel: `${placed}/${requested}`,
    hasUnplaced: placed < requested,
    isEmpty: requested === 0,
  };
}
