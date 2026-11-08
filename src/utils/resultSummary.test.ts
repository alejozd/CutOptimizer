import { describe, expect, it } from 'vitest';
import { summarizeResult } from './resultSummary';
import { OptimizationResult } from '../types';

function result(overrides: Partial<OptimizationResult>): OptimizationResult {
  return {
    sheets: [],
    totalSheetsNeeded: 1,
    totalPiecesPlaced: 7,
    totalPiecesRequested: 7,
    unplacedPieces: [],
    overallEfficiency: 45.1,
    totalUsedArea: 0,
    totalWasteArea: 0,
    totalLinearCut: 0,
    totalEdgeBandingLength: 0,
    estimatedCost: 0,
    calculationTimeMs: 0,
    algorithmUsed: '',
    ...overrides,
  };
}

describe('summarizeResult', () => {
  it('summarizes a result where every piece is placed', () => {
    expect(summarizeResult(result({}))).toEqual({
      efficiencyLabel: '45.1%',
      sheetsLabel: '1 lámina',
      placedLabel: '7/7',
      hasUnplaced: false,
      isEmpty: false,
    });
  });

  it('flags results with unplaced pieces', () => {
    const summary = summarizeResult(result({ totalPiecesPlaced: 5 }));

    expect(summary.placedLabel).toBe('5/7');
    expect(summary.hasUnplaced).toBe(true);
  });

  it('pluralizes the sheet count', () => {
    expect(summarizeResult(result({ totalSheetsNeeded: 3 })).sheetsLabel).toBe('3 láminas');
  });

  it('marks a result without requested pieces as empty', () => {
    const summary = summarizeResult(
      result({ totalSheetsNeeded: 0, totalPiecesPlaced: 0, totalPiecesRequested: 0, overallEfficiency: 0 })
    );

    expect(summary.isEmpty).toBe(true);
    expect(summary.hasUnplaced).toBe(false);
  });
});
