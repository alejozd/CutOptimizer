import React, { useState } from 'react';
import { SheetLayout, Unit } from '../types';
import { formatLinear } from '../utils/optimizer';
import { 
  Scissors, 
  X, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  ListOrdered,
  HelpCircle,
  Printer
} from 'lucide-react';

interface CutSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheets: SheetLayout[];
  activeSheetIndex: number;
  unit: Unit;
}

export const CutSequenceModal: React.FC<CutSequenceModalProps> = ({
  isOpen,
  onClose,
  sheets,
  activeSheetIndex,
  unit,
}) => {
  const [selectedSheetIdx, setSelectedSheetIdx] = useState<number>(activeSheetIndex);

  if (!isOpen) return null;

  const currentSheet = sheets[selectedSheetIdx] || sheets[0];

  if (!currentSheet) return null;

  // Group cuts by stage (Fase 1: Cortes primarios / longitudinales pasantes, Fase 2: Cortes secundarios / transversales)
  const stage1Cuts = currentSheet.cutLines.filter((c) => c.stage === 1);
  const stage2Cuts = currentSheet.cutLines.filter((c) => c.stage === 2);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-stone-900 text-stone-100 px-5 py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                Guía de Corte Secuencial (Paso a Paso)
              </h3>
              <p className="text-xs text-stone-400">
                Instrucciones ordenadas para el operario de la escuadradora o sierra de mesa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sheet Selector Tabs */}
        <div className="bg-stone-100 px-5 py-2.5 border-b border-stone-200 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-semibold text-stone-600 mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            Seleccionar Lámina:
          </span>
          {sheets.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedSheetIdx(idx)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                idx === selectedSheetIdx
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              Lámina {idx + 1} ({s.placedPieces.length} piezas)
            </button>
          ))}
        </div>

        {/* Modal Content / Steps */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-stone-800">
          {/* Trim note if margin exists */}
          {currentSheet.sheetConfig.trimMargin > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Paso Inicial: Refilado de Tablero</strong>
                <p className="mt-0.5 text-amber-800">
                  Recorta {currentSheet.sheetConfig.trimMargin} {unit} en los 4 bordes del tablero ({currentSheet.sheetConfig.length} × {currentSheet.sheetConfig.width} {unit}) para eliminar cantos astillados de fábrica antes de comenzar los cortes interiores.
                </p>
              </div>
            </div>
          )}

          {/* Phase 1: Primary Rip / Cross Cuts */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                1
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Fase 1: Cortes Primarios Pasantes ({stage1Cuts.length} cortes)
              </h4>
            </div>

            {stage1Cuts.length === 0 ? (
              <p className="text-xs text-stone-500 italic pl-7">
                No hay cortes primarios pasantes en esta lámina.
              </p>
            ) : (
              <div className="space-y-1.5 pl-7">
                {stage1Cuts.map((cut, idx) => (
                  <div
                    key={cut.id}
                    className="flex items-center justify-between p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-[11px]">
                        1.{idx + 1}
                      </span>
                      <span className="font-semibold text-stone-900">
                        {cut.description}
                      </span>
                    </div>
                    <span className="text-stone-500 text-[11px]">
                      De ({Math.round(cut.x1)}, {Math.round(cut.y1)}) a ({Math.round(cut.x2)}, {Math.round(cut.y2)})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phase 2: Secondary Section Cuts */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-xs font-bold">
                2
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Fase 2: Cortes Secundarios de Dimensionado ({stage2Cuts.length} cortes)
              </h4>
            </div>

            {stage2Cuts.length === 0 ? (
              <p className="text-xs text-stone-500 italic pl-7">
                Las piezas se extraen directamente tras la primera fase.
              </p>
            ) : (
              <div className="space-y-1.5 pl-7">
                {stage2Cuts.map((cut, idx) => (
                  <div
                    key={cut.id}
                    className="flex items-center justify-between p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-[11px]">
                        2.{idx + 1}
                      </span>
                      <span className="font-semibold text-stone-900">
                        {cut.description}
                      </span>
                    </div>
                    <span className="text-stone-500 text-[11px]">
                      Longitud: {formatLinear(Math.abs(cut.x2 - cut.x1 || cut.y2 - cut.y1), unit)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Final pieces checklist for this sheet */}
          <div className="pt-2 border-t border-stone-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-2">
              Piezas obtenidas de esta lámina ({currentSheet.placedPieces.length} piezas)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentSheet.placedPieces.map((piece) => (
                <div
                  key={piece.id}
                  className="p-2 bg-stone-50 rounded-lg border border-stone-200 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{ backgroundColor: piece.color }}
                    />
                    <span className="font-semibold text-stone-900">{piece.pieceName}</span>
                  </div>
                  <span className="font-mono text-stone-700 font-medium">
                    {Number(piece.width.toFixed(2))} × {Number(piece.height.toFixed(2))} {unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 px-5 py-3 border-t border-stone-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Cerrar Guía
          </button>
        </div>
      </div>
    </div>
  );
};
