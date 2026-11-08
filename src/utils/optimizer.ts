import {
  AlgorithmType,
  CutLine,
  OptimizationResult,
  PieceInput,
  PlacedPiece,
  SheetConfig,
  SheetLayout,
  UnplacedPiece,
  UnplacedReason,
  WasteArea,
} from '../types';

export const MM_PER_UNIT: Record<SheetConfig['unit'], number> = { mm: 1, cm: 10, in: 25.4 };
/** Tolerance for floating-point leftovers when deciding whether material remains */
const EPSILON = 1e-6;
/** Narrowest side an offcut needs to be reusable */
const MIN_OFFCUT_SHORT_SIDE_MM = 100;
/** Minimum offcut area, equivalent to a 150×150 mm square */
const MIN_OFFCUT_AREA_MM2 = 150 * 150;

interface InternalPiece {
  originalIndex: number;
  instanceIndex: number;
  pieceId: string;
  name: string;
  furnitureGroup?: string;
  /** Cut size: finished size minus edge banding thickness on banded sides */
  length: number;
  width: number;
  finishedLength: number;
  finishedWidth: number;
  allowRotation: boolean;
  color: string;
  edgeBanding: PieceInput['edgeBanding'];
}

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Number of sequential cut stages needed before this panel is physically separated */
  depth: number;
}

interface Orientation {
  w: number;
  h: number;
  rotated: boolean;
}

/**
 * allowRotation is the per-piece grain rule. A piece that allows rotation does not care
 * about grain. A locked piece keeps its length along the sheet grain: unrotated when the
 * grain runs along the sheet length (or there is none), rotated 90° when it runs across.
 */
function allowedOrientations(
  piece: Pick<PieceInput, 'length' | 'width' | 'allowRotation'>,
  sheetConfig: SheetConfig
): Orientation[] {
  const unrotated = { w: piece.length, h: piece.width, rotated: false };
  const rotated = { w: piece.width, h: piece.length, rotated: true };

  if (piece.length === piece.width) return [unrotated];
  if (piece.allowRotation) return [unrotated, rotated];
  return sheetConfig.grainDirection === 'vertical' ? [rotated] : [unrotated];
}

/**
 * Piece sizes are finished sizes. Each banded edge adds the banding thickness, so the
 * board is cut that much shorter across it. L1/L2 (top/bottom) run along the length and
 * shorten the width; A1/A2 (left/right) run along the width and shorten the length.
 */
function cutSize(piece: PieceInput, sheetConfig: SheetConfig): { length: number; width: number } {
  const t = Math.max(0, sheetConfig.edgeBandingThickness ?? 0);
  const eb = piece.edgeBanding;
  const across = (a?: boolean, b?: boolean) => t * ((a ? 1 : 0) + (b ? 1 : 0));
  return {
    length: piece.length - across(eb?.left, eb?.right),
    width: piece.width - across(eb?.top, eb?.bottom),
  };
}

/** Whether the piece fits an empty sheet in at least one allowed orientation */
function fitsEmptySheet(piece: PieceInput, sheetConfig: SheetConfig): boolean {
  const margin = Math.max(0, sheetConfig.trimMargin);
  const usableW = sheetConfig.length - 2 * margin;
  const usableH = sheetConfig.width - 2 * margin;
  const size = { ...cutSize(piece, sheetConfig), allowRotation: piece.allowRotation };
  return allowedOrientations(size, sheetConfig).some((o) => o.w <= usableW && o.h <= usableH);
}

function unplacedReason(piece: PieceInput, sheetConfig: SheetConfig): UnplacedReason {
  const cut = cutSize(piece, sheetConfig);
  if (cut.length <= 0 || cut.width <= 0) return 'invalid_size';
  return fitsEmptySheet(piece, sheetConfig) ? 'sheet_limit' : 'too_large';
}

/**
 * Expands piece inputs into individual piece instances
 */
function expandPieces(pieces: PieceInput[], sheetConfig: SheetConfig): InternalPiece[] {
  const result: InternalPiece[] = [];
  let counter = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const qty = Math.max(0, Math.floor(p.quantity));
    const cut = cutSize(p, sheetConfig);
    for (let q = 0; q < qty; q++) {
      result.push({
        originalIndex: i,
        instanceIndex: counter++,
        pieceId: p.id,
        name: p.name,
        furnitureGroup: p.furnitureGroup,
        length: cut.length,
        width: cut.width,
        finishedLength: p.length,
        finishedWidth: p.width,
        allowRotation: p.allowRotation,
        color: p.color,
        edgeBanding: p.edgeBanding,
      });
    }
  }
  return result;
}

/**
 * Guillotine bin packer for a single sheet (every split is a straight through-cut)
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
      const trimStages = margin > 0 ? this.pushTrimCuts(margin) : 0;
      this.freeRects.push({
        x: this.usableX,
        y: this.usableY,
        width: this.usableW,
        height: this.usableH,
        depth: trimStages,
      });
    }
  }

  /**
   * Trimming takes two stages: first both long edges across the full sheet, then both short
   * edges across the strip left between them. Returns the number of stages used.
   */
  private pushTrimCuts(margin: number): number {
    const { length, width } = this.sheetConfig;
    this.pushCut('horizontal', margin, 0, length, 1, true);
    this.pushCut('horizontal', width - margin, 0, length, 1, true);
    this.pushCut('vertical', margin, margin, width - margin, 2, true);
    this.pushCut('vertical', length - margin, margin, width - margin, 2, true);
    return 2;
  }

  /**
   * Try to place a piece in the sheet using a specific heuristic and guillotine split rule
   */
  public tryPlace(
    piece: InternalPiece,
    splitStrategy: 'horizontal_first' | 'vertical_first' | 'shorter_axis' | 'longer_axis',
    fitRule: 'bssf' | 'blsf' | 'baf' = 'bssf'
  ): boolean {
    // Banding thicker than the piece leaves nothing to cut; never place it
    if (piece.length <= 0 || piece.width <= 0) return false;

    let bestRectIndex = -1;
    let bestRotated = false;
    let bestScore1 = Infinity;
    let bestScore2 = Infinity;

    const orientations = allowedOrientations(piece, this.sheetConfig);

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
      // instanceIndex is unique per run, so the id is stable across identical runs
      id: `${piece.pieceId}-${piece.instanceIndex}`,
      pieceId: piece.pieceId,
      pieceName: piece.name,
      furnitureGroup: piece.furnitureGroup,
      x: targetRect.x,
      y: targetRect.y,
      width: placeW,
      height: placeH,
      originalLength: piece.finishedLength,
      originalWidth: piece.finishedWidth,
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

    // A guillotine split is two sequential cuts: a primary cut across the whole panel,
    // then a secondary cut across the strip that holds the piece. The secondary cut can
    // only be made once the primary cut has separated that strip, so it is one stage later.
    const baseStage = rect.depth + 1;
    const pieceRight = rect.x + pieceW;
    const pieceBottom = rect.y + pieceH;

    // A cut is needed whenever material remains beside the piece, even if that material
    // is no wider than the kerf (the blade then removes it while sizing the piece).
    // A free rectangle only exists if something is left after the kerf.
    const needsCutRight = remW > EPSILON;
    const needsCutBelow = remH > EPSILON;
    const rightW = remW - k;
    const bottomH = remH - k;

    if (splitHorizontal) {
      // Primary: horizontal cut under the piece across the full panel width
      if (needsCutBelow) {
        this.pushCut('horizontal', pieceBottom, rect.x, rect.x + rect.width, baseStage);
        if (bottomH > 0) {
          this.freeRects.push({ x: rect.x, y: pieceBottom + k, width: rect.width, height: bottomH, depth: baseStage });
        }
      }

      // Secondary: vertical cut beside the piece, within the top strip
      if (needsCutRight) {
        const stage = needsCutBelow ? baseStage + 1 : baseStage;
        this.pushCut('vertical', pieceRight, rect.y, pieceBottom, stage);
        if (rightW > 0) {
          this.freeRects.push({ x: pieceRight + k, y: rect.y, width: rightW, height: pieceH, depth: stage });
        }
      }
    } else {
      // Primary: vertical cut beside the piece across the full panel height
      if (needsCutRight) {
        this.pushCut('vertical', pieceRight, rect.y, rect.y + rect.height, baseStage);
        if (rightW > 0) {
          this.freeRects.push({ x: pieceRight + k, y: rect.y, width: rightW, height: rect.height, depth: baseStage });
        }
      }

      // Secondary: horizontal cut under the piece, within the left strip
      if (needsCutBelow) {
        const stage = needsCutRight ? baseStage + 1 : baseStage;
        this.pushCut('horizontal', pieceBottom, rect.x, pieceRight, stage);
        if (bottomH > 0) {
          this.freeRects.push({ x: rect.x, y: pieceBottom + k, width: pieceW, height: bottomH, depth: stage });
        }
      }
    }

    // Clean up empty or negligible free rectangles
    this.freeRects = this.freeRects.filter((r) => r.width >= 1 && r.height >= 1);
  }

  private pushCut(
    orientation: 'horizontal' | 'vertical',
    position: number,
    from: number,
    to: number,
    stage: number,
    isTrim = false
  ) {
    const isVertical = orientation === 'vertical';
    const label = `${isTrim ? 'Refilado: corte' : 'Corte'} ${isVertical ? 'vertical' : 'horizontal'}`;
    this.cutLines.push({
      id: `cut-${this.cutCounter++}`,
      x1: isVertical ? position : from,
      y1: isVertical ? from : position,
      x2: isVertical ? position : to,
      y2: isVertical ? to : position,
      orientation,
      stage,
      position,
      ...(isTrim && { isTrim: true }),
      description: `${label} a ${Math.round(position)} ${this.sheetConfig.unit} (tramo ${Math.round(from)}–${Math.round(to)})`,
    });
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
    // A "retal útil" must be wide enough to work with AND big enough to be worth keeping.
    // Thresholds are defined in mm and converted to the sheet's unit.
    const mmPerUnit = MM_PER_UNIT[this.sheetConfig.unit];
    const minShortSide = MIN_OFFCUT_SHORT_SIDE_MM / mmPerUnit;
    const minArea = MIN_OFFCUT_AREA_MM2 / (mmPerUnit * mmPerUnit);

    for (let i = 0; i < this.freeRects.length; i++) {
      const fr = this.freeRects[i];
      const area = fr.width * fr.height;
      const isUsable = Math.min(fr.width, fr.height) >= minShortSide && area >= minArea;
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
    // Trim cuts are part of cutLines, so each cut is counted exactly once
    let cutsLength = 0;
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
      // Stable sort: every cut appears after the cuts that free its panel
      cutLines: [...this.cutLines].sort((a, b) => a.stage - b.stage),
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

interface SimulationQuality {
  placedCount: number;
  sheetCount: number;
  usableOffcutArea: number;
  cutLength: number;
}

function measureQuality(sheets: SheetLayout[], placedCount: number): SimulationQuality {
  let usableOffcutArea = 0;
  let cutLength = 0;
  for (const s of sheets) {
    cutLength += s.cutsLength;
    for (const w of s.wasteAreas) {
      if (w.isUsableOffcut) usableOffcutArea += w.width * w.height;
    }
  }
  return { placedCount, sheetCount: sheets.length, usableOffcutArea, cutLength };
}

/**
 * Ranks two simulations, in priority order:
 * 1. more pieces placed, 2. fewer sheets, 3. more usable offcut area
 *    (with equal pieces and sheets the used area is identical, so what differs
 *    is whether the waste is one reusable board or many slivers),
 * 4. less total cut length (less saw work).
 */
function isBetter(a: SimulationQuality, b: SimulationQuality): boolean {
  if (a.placedCount !== b.placedCount) return a.placedCount > b.placedCount;
  if (a.sheetCount !== b.sheetCount) return a.sheetCount < b.sheetCount;
  if (a.usableOffcutArea !== b.usableOffcutArea) return a.usableOffcutArea > b.usableOffcutArea;
  return a.cutLength < b.cutLength;
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
  const allPieces = expandPieces(pieces, sheetConfig);

  if (allPieces.length === 0) {
    const trim = sheetConfig.trimMargin || 0;
    const usableW = Math.max(0, sheetConfig.length - 2 * trim);
    const usableH = Math.max(0, sheetConfig.width - 2 * trim);
    const totalAreaINTEGER = sheetConfig.length * sheetConfig.width;
    const usableArea = usableW * usableH;

    const blankSheet: SheetLayout = {
      sheetIndex: 0,
      sheetConfig,
      placedPieces: [],
      wasteAreas: [],
      cutLines: [],
      usedArea: 0,
      usableArea,
      totalSheetArea: totalAreaINTEGER,
      efficiencyPercentage: 0,
      wastePercentage: 0,
      cutsLength: 0,
    };

    return {
      sheets: [blankSheet],
      totalSheetsNeeded: 1,
      totalPiecesPlaced: 0,
      totalPiecesRequested: 0,
      unplacedPieces: [],
      overallEfficiency: 0,
      totalUsedArea: 0,
      totalWasteArea: 0,
      totalLinearCut: 0,
      totalEdgeBandingLength: 0,
      estimatedCost: sheetConfig.pricePerSheet || 0,
      calculationTimeMs: 0,
      algorithmUsed: 'Lámina vacía (sin piezas)',
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
      name: 'Guillotina (Ajuste por Lado Corto)',
      splitStrategy: 'shorter_axis',
      fitRule: 'bssf',
    });
  } else if (algorithm === 'maxrects_blsf') {
    variants.push({
      name: 'Guillotina (Ajuste por Lado Largo)',
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
        name: 'Guillotina Ajuste por Lado Corto (BSSF)',
        splitStrategy: 'shorter_axis',
        fitRule: 'bssf',
      },
      {
        name: 'Guillotina Ajuste por Lado Largo (BLSF)',
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
    quality: SimulationQuality;
  } | null = null;

  for (const variant of variants) {
    for (const sortHeuristic of sortingHeuristics) {
      const sim = runSimulation(allPieces, sheetConfig, sortHeuristic.fn, variant.splitStrategy, variant.fitRule);
      const quality = measureQuality(sim.sheets, allPieces.length - sim.unplaced.length);

      if (!bestResult || isBetter(quality, bestResult.quality)) {
        bestResult = {
          sheets: sim.sheets,
          unplaced: sim.unplaced,
          algorithmName: `${variant.name} (${sortHeuristic.name})`,
          quality,
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
  const unplacedPieces: UnplacedPiece[] = [];
  for (const p of pieces) {
    const unQty = unplacedMap.get(p.id) || 0;
    if (unQty > 0) {
      const reason = unplacedReason(p, sheetConfig);
      unplacedPieces.push({ piece: p, remainingQty: unQty, reason });
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
