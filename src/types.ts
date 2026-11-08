export type Unit = 'mm' | 'cm' | 'in';

export interface EdgeBanding {
  top: boolean;     // L1 (Largo 1)
  bottom: boolean;  // L2 (Largo 2)
  left: boolean;    // A1 (Ancho 1)
  right: boolean;   // A2 (Ancho 2)
}

export interface PieceInput {
  id: string;
  name: string;
  length: number; // Largo
  width: number;  // Ancho
  quantity: number;
  /** May rotate 90°. When false, the piece length follows the sheet grain (or sheet length if none). */
  allowRotation: boolean;
  color: string;
  edgeBanding: EdgeBanding;
}

export interface SheetConfig {
  name: string;
  length: number; // Largo de la lámina
  width: number;  // Ancho de la lámina
  kerf: number;   // Espesor de la sierra / disco de corte (ej. 3mm o 4mm)
  trimMargin: number; // Refilado / recorte perimetral de bordes (ej. 10mm)
  /** Edge banding thickness in the sheet unit; discounted from the cut size on each banded side */
  edgeBandingThickness?: number;
  grainDirection: 'horizontal' | 'vertical' | 'none';
  pricePerSheet?: number;
  unit: Unit;
}

export interface PlacedPiece {
  id: string;
  pieceId: string;
  pieceName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalLength: number;
  originalWidth: number;
  rotated: boolean;
  color: string;
  edgeBanding: EdgeBanding;
}

export interface CutLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: 'horizontal' | 'vertical';
  stage: number;
  position: number;
  description: string;
}

export interface WasteArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isUsableOffcut: boolean; // Reusable offcut: short side >= 100 mm and area >= 150×150 mm
}

export interface SheetLayout {
  sheetIndex: number;
  sheetConfig: SheetConfig;
  placedPieces: PlacedPiece[];
  wasteAreas: WasteArea[];
  cutLines: CutLine[];
  usedArea: number;
  usableArea: number;
  totalSheetArea: number;
  efficiencyPercentage: number;
  wastePercentage: number;
  cutsLength: number;
}

/**
 * too_large: does not fit an empty sheet in any allowed orientation.
 * sheet_limit: fits, but the optimizer stopped at its maximum number of sheets.
 */
export type UnplacedReason = 'too_large' | 'sheet_limit';

export interface UnplacedPiece {
  piece: PieceInput;
  remainingQty: number;
  reason: UnplacedReason;
}

export interface OptimizationResult {
  sheets: SheetLayout[];
  totalSheetsNeeded: number;
  totalPiecesPlaced: number;
  totalPiecesRequested: number;
  unplacedPieces: UnplacedPiece[];
  overallEfficiency: number;
  totalUsedArea: number;
  totalWasteArea: number;
  totalLinearCut: number;
  totalEdgeBandingLength: number;
  estimatedCost: number;
  calculationTimeMs: number;
  algorithmUsed: string;
}

export type AlgorithmType =
  | 'auto_best'
  | 'guillotine_horizontal'
  | 'guillotine_vertical'
  | 'maxrects_bssf'
  | 'maxrects_blsf';

export interface FurniturePreset {
  id: string;
  name: string;
  description: string;
  sheetConfig: Partial<SheetConfig>;
  pieces: Omit<PieceInput, 'id'>[];
}
