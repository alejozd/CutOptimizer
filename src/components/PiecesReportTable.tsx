import React, { useState } from 'react';
import { OptimizationResult, Unit } from '../types';
import { formatArea } from '../utils/optimizer';
import { 
  ClipboardList, 
  Search, 
  Layers, 
  RotateCw, 
  Check, 
  Download,
  Filter
} from 'lucide-react';

interface PiecesReportTableProps {
  result: OptimizationResult;
  unit: Unit;
  onSelectSheet?: (index: number) => void;
}

export const PiecesReportTable: React.FC<PiecesReportTableProps> = ({
  result,
  unit,
  onSelectSheet,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSheet, setFilterSheet] = useState<number | 'all'>('all');

  // Collect all placed pieces with their sheet index
  const allPlacedWithSheet: {
    piece: (typeof result.sheets)[0]['placedPieces'][0];
    sheetIndex: number;
  }[] = [];

  result.sheets.forEach((sheet) => {
    sheet.placedPieces.forEach((piece) => {
      allPlacedWithSheet.push({
        piece,
        sheetIndex: sheet.sheetIndex,
      });
    });
  });

  const filtered = allPlacedWithSheet.filter(({ piece, sheetIndex }) => {
    const matchSearch =
      piece.pieceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${Math.round(piece.width)}x${Math.round(piece.height)}`.includes(searchTerm);
    const matchSheet = filterSheet === 'all' || sheetIndex === filterSheet;
    return matchSearch && matchSheet;
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Pieza', 'Largo Final', 'Ancho Final', 'Lámina', 'Girada', 'Tapacanto L1', 'Tapacanto L2', 'Tapacanto A1', 'Tapacanto A2', 'Área'];
    const rows = allPlacedWithSheet.map(({ piece, sheetIndex }) => [
      `"${piece.pieceName}"`,
      Math.round(piece.width),
      Math.round(piece.height),
      sheetIndex + 1,
      piece.rotated ? 'Sí' : 'No',
      piece.edgeBanding?.top ? 'Sí' : 'No',
      piece.edgeBanding?.bottom ? 'Sí' : 'No',
      piece.edgeBanding?.left ? 'Sí' : 'No',
      piece.edgeBanding?.right ? 'Sí' : 'No',
      (piece.width * piece.height).toFixed(0),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Lista_Piezas_Corte_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="pieces-report-table" className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-stone-900">
            Lista Detallada de Corte ({allPlacedWithSheet.length} piezas)
          </h3>
        </div>

        {/* Filter & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar pieza..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-stone-300 rounded-lg pl-8 pr-2.5 py-1 text-xs text-stone-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 w-36 sm:w-48"
            />
          </div>

          {/* Sheet filter select */}
          {result.sheets.length > 1 && (
            <select
              value={filterSheet}
              onChange={(e) =>
                setFilterSheet(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
              }
              className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-stone-800 focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Todas las láminas</option>
              {result.sheets.map((s, idx) => (
                <option key={idx} value={idx}>
                  Lámina {idx + 1}
                </option>
              ))}
            </select>
          )}

          {/* CSV Download Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs px-2.5 py-1 rounded-lg transition-colors font-medium"
            title="Descargar lista en CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-stone-100/80 text-stone-600 uppercase text-[10px] font-semibold tracking-wider sticky top-0 border-b border-stone-200 z-10">
            <tr>
              <th className="py-2 px-3">Pieza</th>
              <th className="py-2 px-2">Medida Final ({unit})</th>
              <th className="py-2 px-2 text-center">Lámina</th>
              <th className="py-2 px-2 text-center">Orientación</th>
              <th className="py-2 px-2 text-center">Tapacantos (L1, L2, A1, A2)</th>
              <th className="py-2 px-3 text-right">Área</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-stone-400">
                  No se encontraron piezas con el filtro actual.
                </td>
              </tr>
            ) : (
              filtered.map(({ piece, sheetIndex }) => {
                const eb = piece.edgeBanding || { top: false, bottom: false, left: false, right: false };
                return (
                  <tr
                    key={piece.id}
                    className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                    onClick={() => onSelectSheet && onSelectSheet(sheetIndex)}
                  >
                    {/* Name + Color */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border shadow-2xs shrink-0"
                          style={{ backgroundColor: piece.color }}
                        />
                        <span className="font-semibold text-stone-900">{piece.pieceName}</span>
                      </div>
                    </td>

                    {/* Dimensions */}
                    <td className="py-2 px-2 font-mono font-medium text-stone-800">
                      {Math.round(piece.width)} × {Math.round(piece.height)} {unit}
                    </td>

                    {/* Sheet badge */}
                    <td className="py-2 px-2 text-center">
                      <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[11px] font-mono font-semibold">
                        Lámina {sheetIndex + 1}
                      </span>
                    </td>

                    {/* Orientation */}
                    <td className="py-2 px-2 text-center">
                      {piece.rotated ? (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">
                          Rotada 90°
                        </span>
                      ) : (
                        <span className="text-stone-400 text-[10px]">Normal</span>
                      )}
                    </td>

                    {/* Edge Banding */}
                    <td className="py-2 px-2 text-center font-mono text-[10px]">
                      <div className="inline-flex gap-1">
                        <span className={`px-1 rounded ${eb.top ? 'bg-red-100 text-red-700 font-bold' : 'text-stone-300'}`}>
                          L1
                        </span>
                        <span className={`px-1 rounded ${eb.bottom ? 'bg-red-100 text-red-700 font-bold' : 'text-stone-300'}`}>
                          L2
                        </span>
                        <span className={`px-1 rounded ${eb.left ? 'bg-red-100 text-red-700 font-bold' : 'text-stone-300'}`}>
                          A1
                        </span>
                        <span className={`px-1 rounded ${eb.right ? 'bg-red-100 text-red-700 font-bold' : 'text-stone-300'}`}>
                          A2
                        </span>
                      </div>
                    </td>

                    {/* Area */}
                    <td className="py-2 px-3 text-right font-mono text-stone-600">
                      {formatArea(piece.width * piece.height, unit)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
