import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  AlgorithmType, 
  PieceInput, 
  SheetConfig, 
  Unit 
} from './types';
import { FURNITURE_PRESETS, STANDARD_SHEET_PRESETS } from './utils/presets';
import { optimizeCuts } from './utils/optimizer';
import { Header } from './components/Header';
import { SheetConfigPanel } from './components/SheetConfigPanel';
import { PieceListEditor } from './components/PieceListEditor';
import { OptimizerControls } from './components/OptimizerControls';
import { ResultDashboard } from './components/ResultDashboard';
import { SheetCanvasView } from './components/SheetCanvasView';
import { PiecesReportTable } from './components/PiecesReportTable';
import { CutSequenceModal } from './components/CutSequenceModal';
import { PrintReportView } from './components/PrintReportView';

export default function App() {
  // Unit state
  const [unit, setUnit] = useState<Unit>('mm');

  // Initial Sheet Configuration
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
    name: 'Melamina Estándar 2440 × 1830 mm',
    length: 2440,
    width: 1830,
    kerf: 3.0,
    trimMargin: 10.0,
    grainDirection: 'none',
    pricePerSheet: 45.0,
    unit: 'mm',
  });

  // Pieces to cut state initialized with kitchen cabinet preset
  const [pieces, setPieces] = useState<PieceInput[]>(() => {
    const defaultPreset = FURNITURE_PRESETS[0];
    return defaultPreset.pieces.map((p, idx) => ({
      ...p,
      id: `p-init-${idx + 1}`,
    }));
  });

  // Optimizer algorithm
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('auto_best');

  // Active sheet tab
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);

  // Modals
  const [showCutSequence, setShowCutSequence] = useState<boolean>(false);
  const [showPrintReport, setShowPrintReport] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Synchronize unit changes across config and pieces
  const handleUnitChange = (newUnit: Unit) => {
    if (newUnit === unit) return;

    let factor = 1;
    if (unit === 'mm' && newUnit === 'cm') factor = 0.1;
    else if (unit === 'mm' && newUnit === 'in') factor = 1 / 25.4;
    else if (unit === 'cm' && newUnit === 'mm') factor = 10;
    else if (unit === 'cm' && newUnit === 'in') factor = 1 / 2.54;
    else if (unit === 'in' && newUnit === 'mm') factor = 25.4;
    else if (unit === 'in' && newUnit === 'cm') factor = 2.54;

    const roundVal = (v: number) => (newUnit === 'in' ? Number((v * factor).toFixed(2)) : Math.round(v * factor));

    setSheetConfig((prev) => ({
      ...prev,
      length: roundVal(prev.length),
      width: roundVal(prev.width),
      kerf: newUnit === 'in' ? Number((prev.kerf * factor).toFixed(3)) : Number((prev.kerf * factor).toFixed(1)),
      trimMargin: roundVal(prev.trimMargin),
      unit: newUnit,
    }));

    setPieces((prev) =>
      prev.map((p) => ({
        ...p,
        length: roundVal(p.length),
        width: roundVal(p.width),
      }))
    );

    setUnit(newUnit);
  };

  // Load a pre-defined furniture preset
  const handleLoadPreset = (presetId: string) => {
    const preset = FURNITURE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    let targetLength = preset.sheetConfig.length || 2440;
    let targetWidth = preset.sheetConfig.width || 1830;
    let targetKerf = preset.sheetConfig.kerf || 3;
    let targetTrim = preset.sheetConfig.trimMargin || 10;

    if (unit === 'cm') {
      targetLength = targetLength / 10;
      targetWidth = targetWidth / 10;
      targetKerf = targetKerf / 10;
      targetTrim = targetTrim / 10;
    } else if (unit === 'in') {
      targetLength = Number((targetLength / 25.4).toFixed(1));
      targetWidth = Number((targetWidth / 25.4).toFixed(1));
      targetKerf = Number((targetKerf / 25.4).toFixed(2));
      targetTrim = Number((targetTrim / 25.4).toFixed(2));
    }

    setSheetConfig((prev) => ({
      ...prev,
      length: targetLength,
      width: targetWidth,
      kerf: targetKerf,
      trimMargin: targetTrim,
      unit,
    }));

    const convertedPieces = preset.pieces.map((p, idx) => {
      let l = p.length;
      let w = p.width;
      if (unit === 'cm') {
        l = l / 10;
        w = w / 10;
      } else if (unit === 'in') {
        l = Number((l / 25.4).toFixed(2));
        w = Number((w / 25.4).toFixed(2));
      }
      return {
        ...p,
        id: `p-${preset.id}-${idx + 1}`,
        length: l,
        width: w,
      };
    });

    setPieces(convertedPieces);
    setActiveSheetIndex(0);
  };

  // Reset to default blank state
  const handleReset = () => {
    setSheetConfig({
      name: 'Lámina Personalizada',
      length: unit === 'mm' ? 2440 : unit === 'cm' ? 244 : 96,
      width: unit === 'mm' ? 1220 : unit === 'cm' ? 122 : 48,
      kerf: unit === 'mm' ? 3 : unit === 'cm' ? 0.3 : 0.125,
      trimMargin: unit === 'mm' ? 10 : unit === 'cm' ? 1 : 0.5,
      grainDirection: 'none',
      pricePerSheet: 0,
      unit,
    });
    setPieces([]);
    setActiveSheetIndex(0);
  };

  // Run the calculation engine
  const optimizationResult = useMemo(() => {
    return optimizeCuts(pieces, sheetConfig, algorithm);
  }, [pieces, sheetConfig, algorithm]);

  // Adjust activeSheetIndex if out of bounds
  useEffect(() => {
    if (activeSheetIndex >= optimizationResult.sheets.length && optimizationResult.sheets.length > 0) {
      setActiveSheetIndex(0);
    }
  }, [optimizationResult.sheets.length, activeSheetIndex]);

  const handleManualRecalculate = useCallback(() => {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
    }, 150);
  }, []);

  const totalSheetArea = sheetConfig.length * sheetConfig.width;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-white">
      {/* Top Header Navigation */}
      <Header
        unit={unit}
        onUnitChange={handleUnitChange}
        onLoadPreset={handleLoadPreset}
        onReset={handleReset}
        onPrint={() => setShowPrintReport(true)}
        sheetsCount={optimizationResult.totalSheetsNeeded}
        efficiency={optimizationResult.overallEfficiency}
      />

      {/* Main Workspace Layout */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 flex-1 space-y-5">
        {/* Two Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Setup Inputs (Lámina Inicial + Piezas) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Step 1: Lámina Inicial */}
            <SheetConfigPanel
              config={sheetConfig}
              onChange={(updated) => setSheetConfig((prev) => ({ ...prev, ...updated }))}
              unit={unit}
            />

            {/* Step 2: Piezas a cortar */}
            <PieceListEditor
              pieces={pieces}
              onChange={setPieces}
              unit={unit}
              sheetArea={totalSheetArea}
            />
          </div>

          {/* Right Column: Optimizer & Visualization */}
          <div className="lg:col-span-7 space-y-4">
            {/* Algorithm selector and calculate action */}
            <OptimizerControls
              algorithm={algorithm}
              onAlgorithmChange={setAlgorithm}
              onRecalculate={handleManualRecalculate}
              isCalculating={isCalculating}
            />

            {/* Results KPI Metric Cards */}
            <ResultDashboard
              result={optimizationResult}
              unit={unit}
            />

            {/* 2D Interactive Cutting Diagram (SVG Canvas) */}
            <SheetCanvasView
              sheets={optimizationResult.sheets}
              activeSheetIndex={activeSheetIndex}
              onSelectSheet={setActiveSheetIndex}
              unit={unit}
              onViewCuttingSequence={() => setShowCutSequence(true)}
            />

            {/* Detailed Pieces Report Table */}
            {optimizationResult.sheets.length > 0 && (
              <PiecesReportTable
                result={optimizationResult}
                unit={unit}
                onSelectSheet={setActiveSheetIndex}
              />
            )}
          </div>
        </div>
      </main>

      {/* Step-by-Step Workshop Cutting Sequence Modal */}
      <CutSequenceModal
        isOpen={showCutSequence}
        onClose={() => setShowCutSequence(false)}
        sheets={optimizationResult.sheets}
        activeSheetIndex={activeSheetIndex}
        unit={unit}
      />

      {/* Printable / PDF Workshop Handout Modal */}
      {showPrintReport && (
        <PrintReportView
          result={optimizationResult}
          unit={unit}
          onClose={() => setShowPrintReport(false)}
        />
      )}
    </div>
  );
}
