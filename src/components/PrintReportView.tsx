import React from 'react';
import { OptimizationResult, Unit } from '../types';
import { formatArea, formatLinear } from '../utils/optimizer';
import { 
  Printer, 
  X, 
  Scissors, 
  CheckSquare, 
  Layers, 
  Square,
  Ruler
} from 'lucide-react';

interface PrintReportViewProps {
  result: OptimizationResult;
  unit: Unit;
  onClose: () => void;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({
  result,
  unit,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 flex justify-center">
      {/* Floating Action Bar (Hidden on print) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir / Guardar como PDF</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-stone-800 hover:bg-stone-700 text-stone-200 p-2 rounded-xl text-xs shadow-lg transition-all cursor-pointer"
          title="Cerrar vista de impresión"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Printable Sheet Container */}
      <div className="bg-white max-w-4xl w-full p-8 rounded-xl shadow-2xl border border-stone-200 space-y-6 text-stone-900 print:shadow-none print:border-0 print:p-0 print:m-0">
        {/* Header */}
        <div className="border-b-2 border-stone-900 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              Plano de Corte y Aprovechamiento de Láminas
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Generado el {currentDate} • Algoritmo: {result.algorithmUsed}
            </p>
          </div>
          <div className="text-right font-mono text-xs text-stone-700">
            <span className="font-bold text-stone-900 text-sm">
              {result.totalSheetsNeeded} {result.totalSheetsNeeded === 1 ? 'Lámina' : 'Láminas'}
            </span>
            <br />
            {result.overallEfficiency}% Eficiencia
          </div>
        </div>

        {/* Global Specifications Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs font-mono">
          <div>
            <span className="text-stone-500 block text-[10px] uppercase">Lámina Base</span>
            <strong className="text-stone-900">
              {result.sheets[0]?.sheetConfig.length} × {result.sheets[0]?.sheetConfig.width} {unit}
            </strong>
          </div>
          <div>
            <span className="text-stone-500 block text-[10px] uppercase">Sierra (Kerf) / Refilado</span>
            <strong className="text-stone-900">
              {result.sheets[0]?.sheetConfig.kerf} {unit} / {result.sheets[0]?.sheetConfig.trimMargin} {unit}
            </strong>
          </div>
          <div>
            <span className="text-stone-500 block text-[10px] uppercase">Corte Total</span>
            <strong className="text-stone-900">{formatLinear(result.totalLinearCut, unit)}</strong>
          </div>
          <div>
            <span className="text-stone-500 block text-[10px] uppercase">Tapacanto Total</span>
            <strong className="text-stone-900">{formatLinear(result.totalEdgeBandingLength, unit)}</strong>
          </div>
        </div>

        {/* Sheet by sheet cutting diagram */}
        {result.sheets.map((sheet, idx) => {
          const sheetW = sheet.sheetConfig.length;
          const sheetH = sheet.sheetConfig.width;
          const padding = 30;

          return (
            <div key={idx} className="border border-stone-200 rounded-xl p-4 space-y-3 break-inside-avoid page-break-after">
              <div className="flex items-center justify-between text-xs font-bold border-b border-stone-200 pb-2">
                <span className="text-amber-800 uppercase tracking-wider">
                  Lámina {idx + 1} de {result.sheets.length} ({sheet.placedPieces.length} piezas)
                </span>
                <span className="font-mono text-stone-600">
                  Aprovechamiento: {sheet.efficiencyPercentage.toFixed(1)}% • Cortes: {formatLinear(sheet.cutsLength, unit)}
                </span>
              </div>

              {/* Vector SVG Layout */}
              <div className="bg-stone-100/60 p-2 rounded-lg border border-stone-200 flex items-center justify-center">
                <svg
                  width="100%"
                  viewBox={`-${padding} -${padding} ${sheetW + padding * 2} ${sheetH + padding * 2}`}
                  className="max-h-[360px]"
                >
                  {/* Sheet Base */}
                  <rect
                    x={0}
                    y={0}
                    width={sheetW}
                    height={sheetH}
                    fill="#fefefe"
                    stroke="#44403c"
                    strokeWidth="2"
                  />

                  {/* Trim boundary */}
                  {sheet.sheetConfig.trimMargin > 0 && (
                    <rect
                      x={sheet.sheetConfig.trimMargin}
                      y={sheet.sheetConfig.trimMargin}
                      width={sheetW - 2 * sheet.sheetConfig.trimMargin}
                      height={sheetH - 2 * sheet.sheetConfig.trimMargin}
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Pieces */}
                  {sheet.placedPieces.map((p) => {
                    const fontSize = Math.min(18, Math.max(10, p.width / 10));
                    return (
                      <g key={p.id}>
                        <rect
                          x={p.x}
                          y={p.y}
                          width={p.width}
                          height={p.height}
                          fill={p.color || '#e2e8f0'}
                          stroke="#1c1917"
                          strokeWidth="1.5"
                        />
                        <text
                          x={p.x + p.width / 2}
                          y={p.y + p.height / 2 - 4}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#1c1917"
                          fontSize={fontSize}
                          fontWeight="bold"
                        >
                          {p.pieceName}
                        </text>
                        <text
                          x={p.x + p.width / 2}
                          y={p.y + p.height / 2 + fontSize * 0.8}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#44403c"
                          fontSize={Math.max(8, fontSize * 0.75)}
                          className="font-mono"
                        >
                          {Number(p.width.toFixed(2))} × {Number(p.height.toFixed(2))}
                        </text>
                      </g>
                    );
                  })}

                  {/* Cut Lines */}
                  {sheet.cutLines.map((c) => (
                    <line
                      key={c.id}
                      x1={c.x1}
                      y1={c.y1}
                      x2={c.x2}
                      y2={c.y2}
                      stroke="#dc2626"
                      strokeWidth="1.5"
                      strokeDasharray={c.stage === 1 ? 'none' : '3 3'}
                    />
                  ))}
                </svg>
              </div>

              {/* Pieces table for this specific sheet */}
              <table className="w-full text-left text-[11px] border-collapse mt-2">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-semibold uppercase">
                    <th className="py-1 px-2 w-8">Listo</th>
                    <th className="py-1 px-2">Pieza</th>
                    <th className="py-1 px-2">Medida Final ({unit})</th>
                    <th className="py-1 px-2">Giro</th>
                    <th className="py-1 px-2">Tapacantos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sheet.placedPieces.map((p) => {
                    const eb = p.edgeBanding || { top: false, bottom: false, left: false, right: false };
                    return (
                      <tr key={p.id}>
                        <td className="py-1 px-2">
                          <div className="w-3.5 h-3.5 border border-stone-400 rounded-xs" />
                        </td>
                        <td className="py-1 px-2 font-medium">{p.pieceName}</td>
                        <td className="py-1 px-2 font-mono">
                          {Number(p.width.toFixed(2))} × {Number(p.height.toFixed(2))} {unit}
                        </td>
                        <td className="py-1 px-2">{p.rotated ? '90°' : '—'}</td>
                        <td className="py-1 px-2 font-mono text-[10px]">
                          {[
                            eb.top ? 'L1' : null,
                            eb.bottom ? 'L2' : null,
                            eb.left ? 'A1' : null,
                            eb.right ? 'A2' : null,
                          ]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};
