import React from 'react';
import { Unit } from '../types';
import { FURNITURE_PRESETS } from '../utils/presets';
import { 
  Scissors, 
  Printer, 
  Sparkles, 
  RotateCcw, 
  Layers,
  FolderOpen
} from 'lucide-react';

interface HeaderProps {
  unit: Unit;
  onUnitChange: (newUnit: Unit) => void;
  onLoadPreset: (presetId: string) => void;
  onReset: () => void;
  onPrint: () => void;
  sheetsCount: number;
  efficiency: number;
}

export const Header: React.FC<HeaderProps> = ({
  unit,
  onUnitChange,
  onLoadPreset,
  onReset,
  onPrint,
  sheetsCount,
  efficiency,
}) => {
  return (
    <header id="app-header" className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center text-white shadow-inner font-bold">
            <Scissors className="w-5 h-5 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-stone-100">
                Optimizador de Cortes de Madera
              </h1>
              <span className="text-[11px] font-medium bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                2D Guillotina
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Cálculo automático de aprovechamiento de láminas y tableros
            </p>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Preset Templates Selector */}
          <div className="relative flex items-center">
            <label htmlFor="furniture-preset-select" className="sr-only">
              Plantillas de Muebles
            </label>
            <div className="flex items-center gap-1.5 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 hover:border-stone-600 transition-colors">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <select
                id="furniture-preset-select"
                aria-label="Cargar plantilla de mueble predefinida"
                className="bg-transparent text-stone-200 text-xs focus:outline-none cursor-pointer pr-1"
                onChange={(e) => {
                  if (e.target.value) {
                    onLoadPreset(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled className="bg-stone-800 text-stone-400">
                  Cargar plantilla de mueble...
                </option>
                {FURNITURE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-stone-800 text-stone-100">
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Unit Toggle */}
          <div className="flex items-center bg-stone-800 p-0.5 rounded-lg border border-stone-700 text-xs" role="group" aria-label="Unidad de medida">
            {(['mm', 'cm', 'in'] as Unit[]).map((u) => (
              <button
                key={u}
                id={`unit-btn-${u}`}
                type="button"
                onClick={() => onUnitChange(u)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  unit === u
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          {/* Live quick badge */}
          {sheetsCount > 0 && (
            <div className="hidden lg:flex items-center gap-2 bg-stone-800/80 px-3 py-1 rounded-lg border border-stone-700/60 text-xs">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-stone-300 font-mono font-medium">
                {sheetsCount} {sheetsCount === 1 ? 'lámina' : 'láminas'}
              </span>
              <span className="text-stone-500">•</span>
              <span className={`font-mono font-medium ${efficiency >= 85 ? 'text-emerald-400' : efficiency >= 70 ? 'text-amber-400' : 'text-stone-300'}`}>
                {efficiency}% util.
              </span>
            </div>
          )}

          {/* Print / Export Report Button */}
          <button
            id="print-report-button"
            type="button"
            onClick={onPrint}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs px-3 py-1.5 rounded-lg border border-stone-700 transition-colors font-medium"
            title="Imprimir plano de corte y lista de piezas"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Imprimir / PDF</span>
          </button>

          {/* Reset Button */}
          <button
            id="reset-all-button"
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs px-2.5 py-1.5 rounded-lg border border-stone-700 transition-colors"
            title="Restablecer valores predeterminados"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
