import React from 'react';
import { SheetConfig, Unit } from '../types';
import { STANDARD_SHEET_PRESETS } from '../utils/presets';
import { 
  Square, 
  Disc, 
  Crop, 
  Compass, 
  DollarSign, 
  Info,
  Maximize2
} from 'lucide-react';

interface SheetConfigPanelProps {
  config: SheetConfig;
  onChange: (updated: Partial<SheetConfig>) => void;
  unit: Unit;
}

export const SheetConfigPanel: React.FC<SheetConfigPanelProps> = ({
  config,
  onChange,
  unit,
}) => {
  return (
    <div id="sheet-config-panel" className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              Lámina Inicial Disponible
            </h2>
            <p className="text-xs text-stone-500">
              Dimensiones del tablero y parámetros de corte
            </p>
          </div>
        </div>

        <span className="text-xs font-mono bg-stone-200/80 text-stone-700 px-2 py-0.5 rounded">
          {config.length} × {config.width} {unit}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Presets Bar */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1.5 flex items-center gap-1">
            <Square className="w-3.5 h-3.5 text-stone-400" />
            Formatos Estándar de Tableros:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STANDARD_SHEET_PRESETS.map((preset, idx) => {
              // Convert to current unit if necessary
              let pLength = preset.length;
              let pWidth = preset.width;
              if (unit === 'cm') {
                pLength = preset.length / 10;
                pWidth = preset.width / 10;
              } else if (unit === 'in') {
                pLength = Number((preset.length / 25.4).toFixed(1));
                pWidth = Number((preset.width / 25.4).toFixed(1));
              }

              const isSelected =
                Math.abs(config.length - pLength) < 1 &&
                Math.abs(config.width - pWidth) < 1;

              return (
                <button
                  key={idx}
                  id={`sheet-preset-btn-${idx}`}
                  type="button"
                  onClick={() =>
                    onChange({
                      length: pLength,
                      width: pWidth,
                      name: preset.name,
                    })
                  }
                  className={`text-xs px-2.5 py-1 rounded-md border transition-all text-left font-mono ${
                    isSelected
                      ? 'bg-amber-50 border-amber-500 text-amber-900 font-semibold shadow-xs'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 hover:border-stone-300'
                  }`}
                  title={preset.desc}
                >
                  {pLength} × {pWidth} {unit}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dimension inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Largo (X) */}
          <div>
            <label
              htmlFor="sheet-length-input"
              className="block text-xs font-medium text-stone-700 mb-1 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                Largo del Tablero (X)
              </span>
              <span className="text-[11px] text-stone-400 font-mono">[{unit}]</span>
            </label>
            <div className="relative">
              <input
                id="sheet-length-input"
                type="number"
                min="0.01"
                step="any"
                value={config.length || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace(',', '.'));
                  onChange({ length: isNaN(val) ? 0 : val });
                }}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 font-mono font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                placeholder={`Ej: ${unit === 'mm' ? '2440' : unit === 'cm' ? '244' : '96'}`}
              />
              <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-mono pointer-events-none">
                {unit}
              </span>
            </div>
          </div>

          {/* Ancho (Y) */}
          <div>
            <label
              htmlFor="sheet-width-input"
              className="block text-xs font-medium text-stone-700 mb-1 flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-amber-600 rotate-90" />
                Ancho del Tablero (Y)
              </span>
              <span className="text-[11px] text-stone-400 font-mono">[{unit}]</span>
            </label>
            <div className="relative">
              <input
                id="sheet-width-input"
                type="number"
                min="0.01"
                step="any"
                value={config.width || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace(',', '.'));
                  onChange({ width: isNaN(val) ? 0 : val });
                }}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 font-mono font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                placeholder={`Ej: ${unit === 'mm' ? '1220' : unit === 'cm' ? '122' : '48'}`}
              />
              <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-mono pointer-events-none">
                {unit}
              </span>
            </div>
          </div>
        </div>

        {/* Technical parameters: Kerf & Trim margin & Grain */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-100">
          {/* Espesor de corte (Kerf / Sierra) */}
          <div>
            <label
              htmlFor="sheet-kerf-input"
              className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1"
              title="Grosor de la hoja de corte de la sierra que se pierde en cada corte como aserrín"
            >
              <Disc className="w-3.5 h-3.5 text-amber-600" />
              Espesor de Corte (Kerf)
            </label>
            <div className="relative">
              <input
                id="sheet-kerf-input"
                type="number"
                min="0"
                step="any"
                value={config.kerf}
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace(',', '.'));
                  onChange({ kerf: Math.max(0, isNaN(val) ? 0 : val) });
                }}
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
              <span className="absolute right-2.5 top-2 text-[11px] text-stone-400 font-mono pointer-events-none">
                {unit}
              </span>
            </div>
          </div>

          {/* Refilado / Recorte perimetral (Trim Margin) */}
          <div>
            <label
              htmlFor="sheet-trim-input"
              className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1"
              title="Margen de saneado perimetral para eliminar cantos dañados de fábrica"
            >
              <Crop className="w-3.5 h-3.5 text-amber-600" />
              Refilado Perimetral
            </label>
            <div className="relative">
              <input
                id="sheet-trim-input"
                type="number"
                min="0"
                step="any"
                value={config.trimMargin}
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace(',', '.'));
                  onChange({ trimMargin: Math.max(0, isNaN(val) ? 0 : val) });
                }}
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
              <span className="absolute right-2.5 top-2 text-[11px] text-stone-400 font-mono pointer-events-none">
                {unit}
              </span>
            </div>
          </div>

          {/* Sentido de Veta general */}
          <div>
            <label
              htmlFor="sheet-grain-select"
              className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1"
            >
              <Compass className="w-3.5 h-3.5 text-amber-600" />
              Veta del Tablero
            </label>
            <select
              id="sheet-grain-select"
              value={config.grainDirection}
              onChange={(e) =>
                onChange({
                  grainDirection: e.target.value as 'horizontal' | 'vertical' | 'none',
                })
              }
              className="w-full bg-white border border-stone-300 rounded-lg px-2 py-1.5 text-xs text-stone-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all cursor-pointer"
            >
              <option value="none">Sin veta (Giro libre 90°)</option>
              <option value="horizontal">Veta Longitudinal (Largo)</option>
              <option value="vertical">Veta Transversal (Ancho)</option>
            </select>
          </div>
        </div>

        {/* Cost per sheet & Usable area summary */}
        <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-600 gap-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-amber-700" />
            <span className="font-medium text-stone-700">Precio por lámina:</span>
            <input
              id="sheet-price-input"
              type="number"
              min="0"
              step="1"
              value={config.pricePerSheet || ''}
              onChange={(e) =>
                onChange({ pricePerSheet: parseFloat(e.target.value) || 0 })
              }
              placeholder="0.00"
              className="w-20 bg-white border border-stone-300 rounded px-2 py-0.5 text-xs font-mono text-stone-900 focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-stone-400">$</span>
          </div>

          <div className="flex items-center gap-1.5 text-stone-500 font-mono text-[11px]">
            <Info className="w-3 h-3 text-stone-400" />
            <span>
              Área útil:{' '}
              {Math.max(0, config.length - 2 * config.trimMargin)} ×{' '}
              {Math.max(0, config.width - 2 * config.trimMargin)} {unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
