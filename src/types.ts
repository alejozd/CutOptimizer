export type Unit = 'mm' | 'cm' | 'in';

export interface EdgeBanding {
  top: boolean;     // L1 (Largo 1)
  bottom: boolean;  // L2 (Largo 2)
  left: boolean;    // A1 (Ancho 1)
  right: boolean;   // A2 (Ancho 2)
  thickness?: number; // Espesor del tapacanto en mm (ej. 0.4mm, 1mm, 2mm)
}

export interface PieceInput {
  id: string;
  name: string;
  length: number; // Largo
  width: number;  // Ancho
  quantity: number;
  allowRotation: boolean; // Permitir girar 90°
  color: string;
  edgeBanding: EdgeBanding;
  grainDirection?: 'horizontal' | 'vertical' | 'none'; // Sentido de veta
  furnitureGroup?: string; // Nombre del mueble o grupo (ej. "Estante", "Mesita de Noche")
}

export interface SheetConfig {
  name: string;
  length: number; // Largo de la lámina
  width: number;  // Ancho de la lámina
  kerf: number;   // Espesor de la sierra / disco de corte (ej. 3mm o 4mm)
  trimMargin: number; // Refilado / recorte perimetral de bordes (ej. 10mm)
  grainDirection: 'horizontal' | 'vertical' | 'none';
  pricePerSheet?: number;
  unit: Unit;
}

export interface PlacedPiece {
  id: string;
  pieceId: string;
  pieceName: string;
  furnitureGroup?: string;
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
  isUsableOffcut: boolean; // Si es un retal reutilizable (ej. mayor a 200x200mm)
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

export interface OptimizationResult {
  sheets: SheetLayout[];
  totalSheetsNeeded: number;
  totalPiecesPlaced: number;
  totalPiecesRequested: number;
  unplacedPieces: { piece: PieceInput; remainingQty: number }[];
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
