import React from 'react';
import { AlgorithmType } from '../types';
import { 
  Play, 
  Settings2, 
  Sparkles, 
  Cpu, 
  SlidersHorizontal, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface OptimizerControlsProps {
  algorithm: AlgorithmType;
  onAlgorithmChange: (algo: AlgorithmType) => void;
  onRecalculate: () => void;
  isCalculating: boolean;
}

export const OptimizerControls: React.FC<OptimizerControlsProps> = ({
  algorithm,
  onAlgorithmChange,
  onRecalculate,
  isCalculating,
}) => {
  return (
    <div id="optimizer-controls" className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
      {/* Algorithm Strategy Selector */}
      <div className="flex items-center gap-2.5 w-full sm:w-auto">
        <SlidersHorizontal className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="flex-1">
          <label htmlFor="algorithm-select" className="sr-only">
            Estrategia de Optimización
          </label>
          <select
            id="algorithm-select"
            value={algorithm}
            onChange={(e) => onAlgorithmChange(e.target.value as AlgorithmType)}
            className="w-full bg-stone-50 border border-stone-300 text-stone-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium cursor-pointer"
          >
            <option value="auto_best">
              ⭐ Modo Automático (Evaluar todas y elegir máximo aprovechamiento)
            </option>
            <option value="guillotine_horizontal">
              📐 Guillotina Horizontal (Cortes longitudinales primero)
            </option>
            <option value="guillotine_vertical">
              📐 Guillotina Vertical (Cortes transversales primero)
            </option>
            <option value="maxrects_bssf">
              🧩 MaxRects - Ajuste Lado Corto (Best Short Side Fit)
            </option>
            <option value="maxrects_blsf">
              🧩 MaxRects - Ajuste Lado Largo (Best Long Side Fit)
            </option>
          </select>
        </div>
      </div>

      {/* Recalculate Button */}
      <button
        id="run-optimization-button"
        type="button"
        onClick={onRecalculate}
        disabled={isCalculating}
        className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-stone-400 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {isCalculating ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Calculando layout...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-white" />
            <span>Calcular Optimización</span>
          </>
        )}
      </button>
    </div>
  );
};
