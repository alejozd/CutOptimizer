import React from 'react';
import { OptimizationResult, Unit } from '../types';
import { formatArea, formatLinear } from '../utils/optimizer';
import { 
  Percent, 
  Layers, 
  CheckCircle, 
  Scissors, 
  DollarSign, 
  TrendingUp, 
  Trash2,
  Ruler,
  Cpu,
  AlertTriangle
} from 'lucide-react';

interface ResultDashboardProps {
  result: OptimizationResult;
  unit: Unit;
}

export const ResultDashboard: React.FC<ResultDashboardProps> = ({
  result,
  unit,
}) => {
  const {
    totalSheetsNeeded,
    totalPiecesPlaced,
    totalPiecesRequested,
    unplacedPieces,
    overallEfficiency,
    totalUsedArea,
    totalWasteArea,
    totalLinearCut,
    totalEdgeBandingLength,
    estimatedCost,
    calculationTimeMs,
    algorithmUsed,
  } = result;

  const wastePercentage = Math.max(0, 100 - overallEfficiency);

  return (
    <div id="result-dashboard" className="space-y-3">
      {/* Unplaced pieces warning alert if any piece didn't fit */}
      {unplacedPieces.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3.5 flex items-start gap-3 text-xs text-red-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-900">
              Atención: {unplacedPieces.reduce((s, p) => s + p.remainingQty, 0)} piezas no pudieron colocarse
            </h4>
            <p className="text-red-700 mt-0.5">
              Algunas piezas exceden el tamaño disponible en el tablero o se requiere aumentar el número de láminas:
            </p>
            <ul className="mt-1.5 list-disc list-inside font-mono text-[11px] space-y-0.5 text-red-800">
              {unplacedPieces.map((un, idx) => (
                <li key={idx}>
                  {un.piece.name} ({un.piece.length} × {un.piece.width} {unit}) — {un.remainingQty} unidad(es) pendiente(s)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* 1. Aprovechamiento General */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-medium">Aprovechamiento</span>
            <Percent className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {overallEfficiency}%
            </div>
            {/* Efficiency mini bar */}
            <div className="w-full bg-stone-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  overallEfficiency >= 85
                    ? 'bg-emerald-500'
                    : overallEfficiency >= 70
                    ? 'bg-amber-500'
                    : 'bg-stone-500'
                }`}
                style={{ width: `${Math.min(100, overallEfficiency)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Láminas Requeridas */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-medium">Láminas Totales</span>
            <Layers className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {totalSheetsNeeded}
            </div>
            <div className="text-[10px] text-stone-500 font-mono mt-0.5">
              {formatArea(totalUsedArea, unit)} útiles
            </div>
          </div>
        </div>

        {/* 3. Piezas Colocadas */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-medium">Piezas Colocadas</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {totalPiecesPlaced} <span className="text-xs text-stone-400 font-normal">/ {totalPiecesRequested}</span>
            </div>
            <div className="text-[10px] text-stone-500 font-mono mt-0.5">
              {totalPiecesPlaced === totalPiecesRequested ? '100% completado' : `${totalPiecesRequested - totalPiecesPlaced} faltantes`}
            </div>
          </div>
        </div>

        {/* 4. Metros de Corte */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-medium">Corte de Sierra</span>
            <Scissors className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {formatLinear(totalLinearCut, unit)}
            </div>
            <div className="text-[10px] text-stone-500 font-mono mt-0.5">
              Desperdicio: {wastePercentage.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* 5. Tapacanto Total */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-medium">Tapacanto Total</span>
            <Ruler className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {formatLinear(totalEdgeBandingLength, unit)}
            </div>
            <div className="text-[10px] text-stone-500 font-mono mt-0.5">
              Cantos L1, L2, A1, A2
            </div>
          </div>
        </div>

        {/* 6. Costo Estimado */}
        <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[11px] font-medium">Costo Estimado</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-stone-900">
              {estimatedCost > 0 ? `$${estimatedCost.toLocaleString()}` : '—'}
            </div>
            <div className="text-[10px] text-stone-500 font-mono mt-0.5">
              {estimatedCost > 0 ? `${totalSheetsNeeded} láminas` : 'Sin precio definido'}
            </div>
          </div>
        </div>
      </div>

      {/* Algorithm Footnote */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between text-[11px] text-stone-600 gap-2">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-amber-600" />
          <span>
            Algoritmo seleccionado: <strong className="text-stone-800">{algorithmUsed}</strong>
          </span>
        </div>
        <div className="font-mono text-stone-500">
          Tiempo de cálculo: <strong className="text-stone-700">{calculationTimeMs} ms</strong>
        </div>
      </div>
    </div>
  );
};
