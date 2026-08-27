import {
  AlgorithmType,
  CutLine,
  OptimizationResult,
  PieceInput,
  PlacedPiece,
  SheetConfig,
  SheetLayout,
  WasteArea,
} from '../types';

interface InternalPiece {
  originalIndex: number;
  instanceIndex: number;
  pieceId: string;
  name: string;
  length: number;
  width: number;
  allowRotation: boolean;
  color: string;
  edgeBanding: PieceInput['edgeBanding'];
  grainDirection?: 'horizontal' | 'vertical' | 'none';
}

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Expands piece inputs into individual piece instances
 */
function expandPieces(pieces: PieceInput[]): InternalPiece[] {
  const result: InternalPiece[] = [];
  let counter = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const qty = Math.max(0, Math.floor(p.quantity));
    for (let q = 0; q < qty; q++) {
      result.push({
        originalIndex: i,
        instanceIndex: counter++,
        pieceId: p.id,
        name: p.name,
        length: p.length,
        width: p.width,
        allowRotation: p.allowRotation,
        color: p.color,
        edgeBanding: p.edgeBanding,
        grainDirection: p.grainDirection,
      });
    }
  }
  return result;
}

/**
 * Guillotine / MaxRects Bin Packer for a single sheet
 */
class SheetPacker {
  private sheetConfig: SheetConfig;
  private usableX: number;
  private usableY: number;
  private usableW: number;
  private usableH: number;
  private kerf: number;
  private freeRects: FreeRect[] = [];
  public placedPieces: PlacedPiece[] = [];
  public cutLines: CutLine[] = [];
  private cutCounter = 1;

  constructor(sheetConfig: SheetConfig) {
    this.sheetConfig = sheetConfig;
    this.kerf = Math.max(0, sheetConfig.kerf);
    const margin = Math.max(0, sheetConfig.trimMargin);

    this.usableX = margin;
    this.usableY = margin;
    this.usableW = Math.max(0, sheetConfig.length - 2 * margin);
    this.usableH = Math.max(0, sheetConfig.width - 2 * margin);

    if (this.usableW > 0 && this.usableH > 0) {
      this.freeRects.push({
        x: this.usableX,
        y: this.usableY,
        width: this.usableW,
        height: this.usableH,
      });
    }
  }

  /**
   * Try to place a piece in the sheet using a specific heuristic and guillotine split rule
   */
  public tryPlace(
    piece: InternalPiece,
    splitStrategy: 'horizontal_first' | 'vertical_first' | 'shorter_axis' | 'longer_axis',
    fitRule: 'bssf' | 'blsf' | 'baf' = 'bssf'
  ): boolean {
    let bestRectIndex = -1;
    let bestRotated = false;
    let bestScore1 = Infinity;
    let bestScore2 = Infinity;

    // Evaluate rotations allowed
    const canRotate = piece.allowRotation && this.sheetConfig.grainDirection === 'none';
    const orientations: { w: number; h: number; rotated: boolean }[] = [
      { w: piece.length, h: piece.width, rotated: false },
    ];

    if (canRotate && piece.length !== piece.width) {
      orientations.push({ w: piece.width, h: piece.length, rotated: true });
    }

    for (let i = 0; i < this.freeRects.length; i++) {
      const rect = this.freeRects[i];

      for (const orient of orientations) {
        if (orient.w <= rect.width && orient.h <= rect.height) {
          const leftoverW = rect.width - orient.w;
          const leftoverH = rect.height - orient.h;
          const shortSideFit = Math.min(leftoverW, leftoverH);
          const longSideFit = Math.max(leftoverW, leftoverH);
          const areaFit = rect.width * rect.height - orient.w * orient.h;

          let score1 = 0;
          let score2 = 0;

          if (fitRule === 'bssf') {
            score1 = shortSideFit;
            score2 = longSideFit;
          } else if (fitRule === 'blsf') {
            score1 = longSideFit;
            score2 = shortSideFit;
          } else {
            score1 = areaFit;
            score2 = shortSideFit;
          }

          if (score1 < bestScore1 || (score1 === bestScore1 && score2 < bestScore2)) {
            bestScore1 = score1;
            bestScore2 = score2;
            bestRectIndex = i;
            bestRotated = orient.rotated;
          }
        }
      }
    }

    if (bestRectIndex === -1) {
      return false;
    }

    // Place the piece
    const targetRect = this.freeRects.splice(bestRectIndex, 1)[0];
    const placeW = bestRotated ? piece.width : piece.length;
    const placeH = bestRotated ? piece.length : piece.width;

    const placed: PlacedPiece = {
      id: `${piece.pieceId}-${piece.instanceIndex}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      pieceId: piece.pieceId,
      pieceName: piece.name,
      x: targetRect.x,
      y: targetRect.y,
      width: placeW,
      height: placeH,
      originalLength: piece.length,
      originalWidth: piece.width,
      rotated: bestRotated,
      color: piece.color,
      edgeBanding: piece.edgeBanding,
    };

    this.placedPieces.push(placed);

    // Guillotine Split of the remaining free rectangle with Kerf accounting
    this.splitGuillotine(targetRect, placeW, placeH, splitStrategy);

    return true;
  }

  /**
   * Performs a woodworking guillotine split with blade kerf
   */
  private splitGuillotine(
    rect: FreeRect,
    pieceW: number,
    pieceH: number,
    strategy: 'horizontal_first' | 'vertical_first' | 'shorter_axis' | 'longer_axis'
  ) {
    const k = this.kerf;
    const remW = rect.width - pieceW;
    const remH = rect.height - pieceH;

    let splitHorizontal = false;

    if (strategy === 'horizontal_first') {
      splitHorizontal = true;
    } else if (strategy === 'vertical_first') {
      splitHorizontal = false;
    } else if (strategy === 'shorter_axis') {
      splitHorizontal = pieceW <= pieceH;
    } else {
      splitHorizontal = pieceW > pieceH;
    }

    if (splitHorizontal) {
      // Horizontal guillotine cut right below the piece across the entire width of the rectangle
      // Top section: Piece on left, remaining right free rect
      const rightW = remW - k;
      if (rightW > 0) {
        this.freeRects.push({
          x: rect.x + pieceW + k,
          y: rect.y,
          width: rightW,
          height: pieceH,
        });

        this.cutLines.push({
          id: `cut-${this.cutCounter++}`,
          x1: rect.x + pieceW,
          y1: rect.y,
          x2: rect.x + pieceW,
          y2: rect.y + pieceH,
          orientation: 'vertical',
          stage: 2,
          position: rect.x + pieceW,
          description: `Corte vertical a ${Math.round(rect.x + pieceW)} mm`,
        });
      }

      // Bottom section: Remaining full width under the piece
      const bottomH = remH - k;
      if (bottomH > 0) {
        this.freeRects.push({
          x: rect.x,
          y: rect.y + pieceH + k,
          width: rect.width,
          height: bottomH,
        });

        this.cutLines.push({
          id: `cut-${this.cutCounter++}`,
          x1: rect.x,
          y1: rect.y + pieceH,
          x2: rect.x + rect.width,
          y2: rect.y + pieceH,
          orientation: 'horizontal',
          stage: 1,
          position: rect.y + pieceH,
          description: `Corte horizontal pasante a ${Math.round(rect.y + pieceH)} mm`,
        });
      }
    } else {
      // Vertical guillotine cut to the right of the piece across the entire height of the rectangle
      // Left section: Piece on top, remaining bottom free rect
      const bottomH = remH - k;
      if (bottomH > 0) {
        this.freeRects.push({
          x: rect.x,
          y: rect.y + pieceH + k,
          width: pieceW,
          height: bottomH,
        });

        this.cutLines.push({
          id: `cut-${this.cutCounter++}`,
          x1: rect.x,
          y1: rect.y + pieceH,
          x2: rect.x + pieceW,
          y2: rect.y + pieceH,
          orientation: 'horizontal',
          stage: 2,
          position: rect.y + pieceH,
          description: `Corte horizontal a ${Math.round(rect.y + pieceH)} mm`,
        });
      }

      // Right section: Remaining full height to the right
      const rightW = remW - k;
      if (rightW > 0) {
        this.freeRects.push({
          x: rect.x + pieceW + k,
          y: rect.y,
          width: rightW,
          height: rect.height,
        });

        this.cutLines.push({
          id: `cut-${this.cutCounter++}`,
          x1: rect.x + pieceW,
          y1: rect.y,
          x2: rect.x + pieceW,
          y2: rect.y + rect.height,
          orientation: 'vertical',
          stage: 1,
          position: rect.x + pieceW,
          description: `Corte vertical pasante a ${Math.round(rect.x + pieceW)} mm`,
        });
      }
    }

    // Clean up empty or negligible free rectangles
    this.freeRects = this.freeRects.filter((r) => r.width >= 1 && r.height >= 1);
  }

  /**
   * Finalize the sheet layout calculations and return SheetLayout object
   */
  public finalizeLayout(sheetIndex: number): SheetLayout {
    const totalSheetArea = this.sheetConfig.length * this.sheetConfig.width;
    const usableArea = this.usableW * this.usableH;

    let usedArea = 0;
    for (const p of this.placedPieces) {
      usedArea += p.width * p.height;
    }

    // Identify waste / offcut areas
    const wasteAreas: WasteArea[] = [];
    // Minimum threshold for a piece to be a "usable offcut" / retal útil
    // e.g., at least 200mm x 200mm or area >= 50,000 mm²
    const minUsableSide = this.sheetConfig.unit === 'in' ? 6 : 150;
    const minUsableArea = this.sheetConfig.unit === 'in' ? 40 : 30000;

    for (let i = 0; i < this.freeRects.length; i++) {
      const fr = this.freeRects[i];
      const area = fr.width * fr.height;
      const isUsable = (fr.width >= minUsableSide && fr.height >= minUsableSide) || area >= minUsableArea;
      wasteAreas.push({
        id: `waste-${sheetIndex}-${i}`,
        x: fr.x,
        y: fr.y,
        width: fr.width,
        height: fr.height,
        isUsableOffcut: isUsable,
      });
    }

    // Calculate total cut length in the current unit
    let cutsLength = 0;
    // Add trim cuts if applicable
    if (this.sheetConfig.trimMargin > 0) {
      cutsLength += 2 * (this.sheetConfig.length + this.sheetConfig.width);
    }
    for (const c of this.cutLines) {
      const len = Math.sqrt(Math.pow(c.x2 - c.x1, 2) + Math.pow(c.y2 - c.y1, 2));
      cutsLength += len;
    }

    const efficiencyPercentage = totalSheetArea > 0 ? (usedArea / totalSheetArea) * 100 : 0;
    const wastePercentage = Math.max(0, 100 - efficiencyPercentage);

    return {
      sheetIndex,
      sheetConfig: this.sheetConfig,
      placedPieces: this.placedPieces,
      wasteAreas,
      cutLines: this.cutLines,
      usedArea,
      usableArea,
      totalSheetArea,
      efficiencyPercentage,
      wastePercentage,
      cutsLength,
    };
  }
}

/**
 * Runs a single simulation variant with specific piece sorting and packer parameters
 */
function runSimulation(
  rawPieces: InternalPiece[],
  sheetConfig: SheetConfig,
  sortFn: (a: InternalPiece, b: InternalPiece) => number,
  splitStrategy: 'horizontal_first' | 'vertical_first' | 'shorter_axis' | 'longer_axis',
  fitRule: 'bssf' | 'blsf' | 'baf'
): {
  sheets: SheetLayout[];
  unplaced: InternalPiece[];
} {
  const pieces = [...rawPieces].sort(sortFn);
  const sheets: SheetLayout[] = [];
  let remainingPieces = [...pieces];
  let sheetIndex = 0;

  // Max 50 sheets safety limit to prevent infinite loops on impossible pieces
  const maxSheetsLimit = 50;

  while (remainingPieces.length > 0 && sheetIndex < maxSheetsLimit) {
    const packer = new SheetPacker(sheetConfig);
    const unplacedInThisSheet: InternalPiece[] = [];

    for (const piece of remainingPieces) {
      const placed = packer.tryPlace(piece, splitStrategy, fitRule);
      if (!placed) {
        unplacedInThisSheet.push(piece);
      }
    }

    // If nothing could be placed on a brand new sheet, these pieces are too large for the sheet
    if (packer.placedPieces.length === 0) {
      break;
    }

    sheets.push(packer.finalizeLayout(sheetIndex));
    remainingPieces = unplacedInThisSheet;
    sheetIndex++;
  }

  return { sheets, unplaced: remainingPieces };
}

/**
 * Master optimizer function
 */
export function optimizeCuts(
  pieces: PieceInput[],
  sheetConfig: SheetConfig,
  algorithm: AlgorithmType = 'auto_best'
): OptimizationResult {
  const startTime = performance.now();
  const allPieces = expandPieces(pieces);

  if (allPieces.length === 0) {
    return {
      sheets: [],
      totalSheetsNeeded: 0,
      totalPiecesPlaced: 0,
      totalPiecesRequested: 0,
      unplacedPieces: [],
      overallEfficiency: 0,
      totalUsedArea: 0,
      totalWasteArea: 0,
      totalLinearCut: 0,
      totalEdgeBandingLength: 0,
      estimatedCost: 0,
      calculationTimeMs: 0,
      algorithmUsed: 'Ninguna pieza seleccionada',
    };
  }

  // Sorting heuristics
  const sortingHeuristics: { name: string; fn: (a: InternalPiece, b: InternalPiece) => number }[] = [
    {
      name: 'Área descendente',
      fn: (a, b) => b.length * b.width - a.length * a.width,
    },
    {
      name: 'Lado mayor descendente',
      fn: (a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width),
    },
    {
      name: 'Perímetro descendente',
      fn: (a, b) => 2 * (b.length + b.width) - 2 * (a.length + a.width),
    },
    {
      name: 'Largo descendente',
      fn: (a, b) => b.length - a.length || b.width - a.width,
    },
    {
      name: 'Ancho descendente',
      fn: (a, b) => b.width - a.width || b.length - a.length,
    },
  ];

  // Configurations to evaluate
  interface ConfigVariant {
    name: string;
    splitStrategy: 'horizontal_first' | 'vertical_first' | 'shorter_axis' | 'longer_axis';
    fitRule: 'bssf' | 'blsf' | 'baf';
  }

  const variants: ConfigVariant[] = [];

  if (algorithm === 'guillotine_horizontal') {
    variants.push({
      name: 'Guillotina Horizontal (Largo primero)',
      splitStrategy: 'horizontal_first',
      fitRule: 'bssf',
    });
  } else if (algorithm === 'guillotine_vertical') {
    variants.push({
      name: 'Guillotina Vertical (Ancho primero)',
      splitStrategy: 'vertical_first',
      fitRule: 'bssf',
    });
  } else if (algorithm === 'maxrects_bssf') {
    variants.push({
      name: 'MaxRects (Best Short Side Fit)',
      splitStrategy: 'shorter_axis',
      fitRule: 'bssf',
    });
  } else if (algorithm === 'maxrects_blsf') {
    variants.push({
      name: 'MaxRects (Best Long Side Fit)',
      splitStrategy: 'longer_axis',
      fitRule: 'blsf',
    });
  } else {
    // auto_best evaluates all major woodworking heuristics
    variants.push(
      {
        name: 'Guillotina Horizontal Optimizada',
        splitStrategy: 'horizontal_first',
        fitRule: 'bssf',
      },
      {
        name: 'Guillotina Vertical Optimizada',
        splitStrategy: 'vertical_first',
        fitRule: 'bssf',
      },
      {
        name: 'MaxRects Ajuste de Lado Corto (BSSF)',
        splitStrategy: 'shorter_axis',
        fitRule: 'bssf',
      },
      {
        name: 'MaxRects Ajuste de Lado Largo (BLSF)',
        splitStrategy: 'longer_axis',
        fitRule: 'blsf',
      },
      {
        name: 'Ajuste de Área Máxima',
        splitStrategy: 'longer_axis',
        fitRule: 'baf',
      }
    );
  }

  let bestResult: {
    sheets: SheetLayout[];
    unplaced: InternalPiece[];
    algorithmName: string;
    efficiencyScore: number;
  } | null = null;

  for (const variant of variants) {
    for (const sortHeuristic of sortingHeuristics) {
      const sim = runSimulation(allPieces, sheetConfig, sortHeuristic.fn, variant.splitStrategy, variant.fitRule);

      const placedCount = allPieces.length - sim.unplaced.length;
      const sheetCount = sim.sheets.length;

      let totalUsed = 0;
      let totalSheet = 0;
      for (const s of sim.sheets) {
        totalUsed += s.usedArea;
        totalSheet += s.totalSheetArea;
      }
      const overallEff = totalSheet > 0 ? (totalUsed / totalSheet) * 100 : 0;

      // Quality score formula:
      // 1. Placing the maximum number of pieces (primary weight)
      // 2. Using fewer sheets (heavy bonus)
      // 3. Higher efficiency % (fine-tuning)
      const score = placedCount * 100000 - sheetCount * 10000 + overallEff;

      if (!bestResult || score > bestResult.efficiencyScore) {
        bestResult = {
          sheets: sim.sheets,
          unplaced: sim.unplaced,
          algorithmName: `${variant.name} (${sortHeuristic.name})`,
          efficiencyScore: score,
        };
      }
    }
  }

  const calculationTimeMs = Math.round(performance.now() - startTime);

  if (!bestResult) {
    return {
      sheets: [],
      totalSheetsNeeded: 0,
      totalPiecesPlaced: 0,
      totalPiecesRequested: allPieces.length,
      unplacedPieces: [],
      overallEfficiency: 0,
      totalUsedArea: 0,
      totalWasteArea: 0,
      totalLinearCut: 0,
      totalEdgeBandingLength: 0,
      estimatedCost: 0,
      calculationTimeMs,
      algorithmUsed: 'Error de cálculo',
    };
  }

  // Count unplaced pieces grouped by original piece input
  const unplacedMap = new Map<string, number>();
  for (const un of bestResult.unplaced) {
    unplacedMap.set(un.pieceId, (unplacedMap.get(un.pieceId) || 0) + 1);
  }
  const unplacedPieces: { piece: PieceInput; remainingQty: number }[] = [];
  for (const p of pieces) {
    const unQty = unplacedMap.get(p.id) || 0;
    if (unQty > 0) {
      unplacedPieces.push({ piece: p, remainingQty: unQty });
    }
  }

  let totalUsedArea = 0;
  let totalSheetArea = 0;
  let totalLinearCut = 0;
  let totalPiecesPlaced = 0;

  for (const s of bestResult.sheets) {
    totalUsedArea += s.usedArea;
    totalSheetArea += s.totalSheetArea;
    totalLinearCut += s.cutsLength;
    totalPiecesPlaced += s.placedPieces.length;
  }

  const overallEfficiency = totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0;
  const totalWasteArea = Math.max(0, totalSheetArea - totalUsedArea);

  // Calculate total edge banding length (metros de tapacanto)
  let totalEdgeBandingLength = 0;
  for (const s of bestResult.sheets) {
    for (const p of s.placedPieces) {
      const eb = p.edgeBanding;
      if (eb) {
        if (eb.top) totalEdgeBandingLength += p.originalLength;
        if (eb.bottom) totalEdgeBandingLength += p.originalLength;
        if (eb.left) totalEdgeBandingLength += p.originalWidth;
        if (eb.right) totalEdgeBandingLength += p.originalWidth;
      }
    }
  }

  const estimatedCost = (sheetConfig.pricePerSheet || 0) * bestResult.sheets.length;

  return {
    sheets: bestResult.sheets,
    totalSheetsNeeded: bestResult.sheets.length,
    totalPiecesPlaced,
    totalPiecesRequested: allPieces.length,
    unplacedPieces,
    overallEfficiency: Number(overallEfficiency.toFixed(1)),
    totalUsedArea,
    totalWasteArea,
    totalLinearCut: Number(totalLinearCut.toFixed(1)),
    totalEdgeBandingLength: Number(totalEdgeBandingLength.toFixed(1)),
    estimatedCost,
    calculationTimeMs,
    algorithmUsed: bestResult.algorithmName,
  };
}

/**
 * Format linear distance according to unit
 */
export function formatLinear(val: number, unit: 'mm' | 'cm' | 'in'): string {
  if (unit === 'mm') {
    if (val >= 1000) {
      return `${(val / 1000).toFixed(2)} m`;
    }
    return `${Math.round(val)} mm`;
  }
  if (unit === 'cm') {
    if (val >= 100) {
      return `${(val / 100).toFixed(2)} m`;
    }
    return `${val.toFixed(1)} cm`;
  }
  return `${val.toFixed(1)} in`;
}

/**
 * Format surface area according to unit
 */
export function formatArea(val: number, unit: 'mm' | 'cm' | 'in'): string {
  if (unit === 'mm') {
    const m2 = val / 1000000;
    return `${m2.toFixed(2)} m²`;
  }
  if (unit === 'cm') {
    const m2 = val / 10000;
    return `${m2.toFixed(2)} m²`;
  }
  const sqft = val / 144;
  return `${sqft.toFixed(2)} sq ft`;
}
