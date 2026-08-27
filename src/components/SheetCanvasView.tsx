import React, { useState, useRef, useEffect } from 'react';
import { PlacedPiece, SheetLayout, Unit, WasteArea } from '../types';
import { formatArea, formatLinear } from '../utils/optimizer';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  Maximize, 
  Eye, 
  Download, 
  Scissors, 
  CheckCircle2,
  Info,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface SheetCanvasViewProps {
  sheets: SheetLayout[];
  activeSheetIndex: number;
  onSelectSheet: (index: number) => void;
  unit: Unit;
  onViewCuttingSequence: () => void;
}

export const SheetCanvasView: React.FC<SheetCanvasViewProps> = ({
  sheets,
  activeSheetIndex,
  onSelectSheet,
  unit,
  onViewCuttingSequence,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showEdgeBanding, setShowEdgeBanding] = useState<boolean>(true);
  const [showWasteAreas, setShowWasteAreas] = useState<boolean>(true);
  const [hoveredPiece, setHoveredPiece] = useState<PlacedPiece | null>(null);
  const [hoveredWaste, setHoveredWaste] = useState<WasteArea | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const currentSheet = sheets[activeSheetIndex] || sheets[0];

  // Auto fit zoom on sheet switch or mount
  useEffect(() => {
    setZoom(1);
  }, [activeSheetIndex]);

  if (!currentSheet) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400">
        <Layers className="w-12 h-12 mx-auto mb-3 text-stone-300" />
        <p className="text-sm font-medium text-stone-600">No hay láminas calculadas</p>
        <p className="text-xs text-stone-400 mt-1">Configura las piezas y ejecuta la optimización.</p>
      </div>
    );
  }

  const { sheetConfig, placedPieces, wasteAreas, cutLines, efficiencyPercentage, wastePercentage } =
    currentSheet;
  const sheetW = sheetConfig.length;
  const sheetH = sheetConfig.width;

  // ViewBox padding for rulers and labels
  const paddingX = 70;
  const paddingY = 50;
  const viewBoxWidth = sheetW + paddingX * 2;
  const viewBoxHeight = sheetH + paddingY * 2;

  // Export diagram as SVG file
  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `Plano_Corte_Lamina_${activeSheetIndex + 1}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      id="sheet-canvas-view"
      className={`bg-white rounded-xl border border-stone-200 shadow-sm flex flex-col overflow-hidden transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : ''
      }`}
    >
      {/* Top Bar: Sheet selector tabs & quick stats */}
      <div className="bg-stone-900 text-stone-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-800">
        {/* Sheet Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-stone-400 font-medium mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Láminas:
          </span>
          {sheets.map((s, idx) => (
            <button
              key={idx}
              id={`sheet-tab-btn-${idx}`}
              type="button"
              onClick={() => onSelectSheet(idx)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                idx === activeSheetIndex
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white'
              }`}
            >
              <span>Lámina {idx + 1}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  s.efficiencyPercentage >= 85
                    ? 'bg-emerald-950/80 text-emerald-300'
                    : s.efficiencyPercentage >= 70
                    ? 'bg-amber-950/80 text-amber-300'
                    : 'bg-stone-900 text-stone-400'
                }`}
              >
                {Math.round(s.efficiencyPercentage)}%
              </span>
            </button>
          ))}
        </div>

        {/* Action Controls: Sequence, SVG Download, Fullscreen */}
        <div className="flex items-center gap-2">
          <button
            id="open-cut-sequence-button"
            type="button"
            onClick={onViewCuttingSequence}
            className="flex items-center gap-1.5 bg-amber-600/90 hover:bg-amber-600 text-white text-xs px-3 py-1 rounded-lg transition-colors font-medium shadow-xs"
            title="Ver guía secuencial paso a paso de cortes para el operario"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Guía de Corte Paso a Paso</span>
          </button>

          <button
            id="download-svg-button"
            type="button"
            onClick={handleDownloadSVG}
            className="text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 p-1.5 rounded-lg text-xs transition-colors"
            title="Descargar plano en formato SVG"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            id="toggle-fullscreen-button"
            type="button"
            onClick={toggleFullscreen}
            className="text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 p-1.5 rounded-lg text-xs transition-colors"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Secondary Controls Bar: View layers & zoom */}
      <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-stone-600 gap-2">
        {/* Layer Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCutLines}
              onChange={(e) => setShowCutLines(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
            />
            <span className="text-stone-700 font-medium">Líneas de Corte (Guillotina)</span>
          </label>

          <span className="text-stone-300">|</span>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDimensions}
              onChange={(e) => setShowDimensions(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
            />
            <span className="text-stone-700">Cotas / Medidas</span>
          </label>

          <span className="text-stone-300">|</span>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showEdgeBanding}
              onChange={(e) => setShowEdgeBanding(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
            />
            <span className="text-stone-700">Tapacantos</span>
          </label>

          <span className="text-stone-300">|</span>

          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showWasteAreas}
              onChange={(e) => setShowWasteAreas(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
            />
            <span className="text-stone-700">Retales Útiles</span>
          </label>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            className="p-1 hover:bg-stone-100 rounded text-stone-600"
            title="Reducir zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] px-1 text-stone-700 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            className="p-1 hover:bg-stone-100 rounded text-stone-600"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1 hover:bg-stone-100 rounded text-stone-600 ml-0.5 border-l border-stone-200"
            title="Restablecer zoom al 100%"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="flex-1 bg-stone-100 p-4 sm:p-6 overflow-auto flex items-center justify-center min-h-[420px] max-h-[620px] relative">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
          }}
          className="shadow-lg rounded-lg overflow-hidden bg-white border border-stone-300"
        >
          <svg
            ref={svgRef}
            width={Math.min(900, viewBoxWidth)}
            height={Math.min(600, (viewBoxHeight / viewBoxWidth) * 900)}
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className="select-none"
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          >
            <defs>
              {/* Wood texture background pattern */}
              <pattern
                id="wood-grain-pattern"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M0 20 Q 15 25, 30 20 T 60 20 M0 40 Q 15 35, 30 40 T 60 40"
                  stroke="#e7dfd5"
                  strokeWidth="0.75"
                  fill="none"
                />
              </pattern>

              {/* Usable offcut pattern */}
              <pattern
                id="usable-offcut-pattern"
                width="16"
                height="16"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="16" stroke="#86efac" strokeWidth="2.5" />
              </pattern>

              {/* Waste sawdust pattern */}
              <pattern
                id="waste-sawdust-pattern"
                width="12"
                height="12"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="12" stroke="#e2e8f0" strokeWidth="1.5" />
              </pattern>
            </defs>

            {/* Main Canvas Background */}
            <rect width={viewBoxWidth} height={viewBoxHeight} fill="#fcfbf9" />

            {/* Transform group for Sheet & Rulers */}
            <g transform={`translate(${paddingX}, ${paddingY})`}>
              {/* Outer Sheet Body */}
              <rect
                x={0}
                y={0}
                width={sheetW}
                height={sheetH}
                fill="#f4ede4"
                stroke="#78716c"
                strokeWidth="2"
                rx="3"
              />
              <rect
                x={0}
                y={0}
                width={sheetW}
                height={sheetH}
                fill="url(#wood-grain-pattern)"
                opacity="0.6"
              />

              {/* Perimeter Trim Margin (Refilado) if > 0 */}
              {sheetConfig.trimMargin > 0 && (
                <rect
                  x={sheetConfig.trimMargin}
                  y={sheetConfig.trimMargin}
                  width={sheetW - 2 * sheetConfig.trimMargin}
                  height={sheetH - 2 * sheetConfig.trimMargin}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
              )}

              {/* Waste Areas / Usable Offcuts */}
              {showWasteAreas &&
                wasteAreas.map((w) => (
                  <g key={w.id} onMouseEnter={() => setHoveredWaste(w)} onMouseLeave={() => setHoveredWaste(null)}>
                    <rect
                      x={w.x}
                      y={w.y}
                      width={w.width}
                      height={w.height}
                      fill={w.isUsableOffcut ? 'url(#usable-offcut-pattern)' : 'url(#waste-sawdust-pattern)'}
                      stroke={w.isUsableOffcut ? '#22c55e' : '#cbd5e1'}
                      strokeWidth="1"
                      opacity="0.85"
                    />
                    {w.isUsableOffcut && w.width > 120 && w.height > 80 && (
                      <text
                        x={w.x + w.width / 2}
                        y={w.y + w.height / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#15803d"
                        fontSize={Math.min(18, Math.max(10, Math.min(w.width, w.height) / 8))}
                        fontWeight="600"
                        className="font-mono"
                      >
                        RETAL ÚTIL ({Math.round(w.width)}×{Math.round(w.height)})
                      </text>
                    )}
                  </g>
                ))}

              {/* Placed Pieces */}
              {placedPieces.map((piece) => {
                const isHovered = hoveredPiece?.id === piece.id;
                const eb = piece.edgeBanding || { top: false, bottom: false, left: false, right: false };
                const fontSize = Math.min(
                  20,
                  Math.max(10, Math.min(piece.width / (piece.pieceName.length * 0.7), piece.height / 4))
                );

                return (
                  <g
                    key={piece.id}
                    onMouseEnter={() => setHoveredPiece(piece)}
                    onMouseLeave={() => setHoveredPiece(null)}
                    className="cursor-pointer transition-all"
                  >
                    {/* Piece Base Rect */}
                    <rect
                      x={piece.x}
                      y={piece.y}
                      width={piece.width}
                      height={piece.height}
                      fill={piece.color || '#e2e8f0'}
                      stroke={isHovered ? '#b45309' : '#44403c'}
                      strokeWidth={isHovered ? '2.5' : '1.2'}
                      rx="1"
                    />

                    {/* Edge Banding Lines (Tapacantos) */}
                    {showEdgeBanding && (
                      <>
                        {/* Top (L1) */}
                        {eb.top && (
                          <line
                            x1={piece.x}
                            y1={piece.y + 1.5}
                            x2={piece.x + piece.width}
                            y2={piece.y + 1.5}
                            stroke="#b91c1c"
                            strokeWidth="3.5"
                          />
                        )}
                        {/* Bottom (L2) */}
                        {eb.bottom && (
                          <line
                            x1={piece.x}
                            y1={piece.y + piece.height - 1.5}
                            x2={piece.x + piece.width}
                            y2={piece.y + piece.height - 1.5}
                            stroke="#b91c1c"
                            strokeWidth="3.5"
                          />
                        )}
                        {/* Left (A1) */}
                        {eb.left && (
                          <line
                            x1={piece.x + 1.5}
                            y1={piece.y}
                            x2={piece.x + 1.5}
                            y2={piece.y + piece.height}
                            stroke="#b91c1c"
                            strokeWidth="3.5"
                          />
                        )}
                        {/* Right (A2) */}
                        {eb.right && (
                          <line
                            x1={piece.x + piece.width - 1.5}
                            y1={piece.y}
                            x2={piece.x + piece.width - 1.5}
                            y2={piece.y + piece.height}
                            stroke="#b91c1c"
                            strokeWidth="3.5"
                          />
                        )}
                      </>
                    )}

                    {/* Piece Label / Name */}
                    {piece.width >= 40 && piece.height >= 25 && (
                      <text
                        x={piece.x + piece.width / 2}
                        y={piece.y + piece.height / 2 - (showDimensions ? fontSize * 0.4 : 0)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#1c1917"
                        fontSize={fontSize}
                        fontWeight="700"
                        style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
                      >
                        {piece.pieceName}
                        {piece.rotated ? ' ⟲' : ''}
                      </text>
                    )}

                    {/* Dimension label */}
                    {showDimensions && piece.width >= 60 && piece.height >= 40 && (
                      <text
                        x={piece.x + piece.width / 2}
                        y={piece.y + piece.height / 2 + fontSize * 0.75}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#44403c"
                        fontSize={Math.max(9, fontSize * 0.8)}
                        fontWeight="600"
                        className="font-mono"
                        style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
                      >
                        {Math.round(piece.width)} × {Math.round(piece.height)} {unit}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Guillotine Cut Lines */}
              {showCutLines &&
                cutLines.map((cut) => (
                  <g key={cut.id}>
                    <line
                      x1={cut.x1}
                      y1={cut.y1}
                      x2={cut.x2}
                      y2={cut.y2}
                      stroke="#dc2626"
                      strokeWidth="1.8"
                      strokeDasharray={cut.stage === 1 ? 'none' : '4 3'}
                      opacity="0.85"
                    />
                    {/* Small cut indicator label */}
                    <circle
                      cx={(cut.x1 + cut.x2) / 2}
                      cy={(cut.y1 + cut.y2) / 2}
                      r="7"
                      fill="#dc2626"
                    />
                    <text
                      x={(cut.x1 + cut.x2) / 2}
                      y={(cut.y1 + cut.y2) / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {cut.stage}
                    </text>
                  </g>
                ))}

              {/* Top X-Axis Ruler / Dimension */}
              <line x1={0} y1={-15} x2={sheetW} y2={-15} stroke="#78716c" strokeWidth="1.5" />
              <line x1={0} y1={-22} x2={0} y2={-8} stroke="#78716c" strokeWidth="1.5" />
              <line x1={sheetW} y1={-22} x2={sheetW} y2={-8} stroke="#78716c" strokeWidth="1.5" />
              <text
                x={sheetW / 2}
                y={-24}
                textAnchor="middle"
                fill="#44403c"
                fontSize="13"
                fontWeight="700"
                className="font-mono"
              >
                {sheetW} {unit} (Largo Tablero)
              </text>

              {/* Left Y-Axis Ruler / Dimension */}
              <line x1={-15} y1={0} x2={-15} y2={sheetH} stroke="#78716c" strokeWidth="1.5" />
              <line x1={-22} y1={0} x2={-8} y2={0} stroke="#78716c" strokeWidth="1.5" />
              <line x1={-22} y1={sheetH} x2={-8} y2={sheetH} stroke="#78716c" strokeWidth="1.5" />
              <text
                x={-24}
                y={sheetH / 2}
                textAnchor="middle"
                transform={`rotate(-90, -24, ${sheetH / 2})`}
                fill="#44403c"
                fontSize="13"
                fontWeight="700"
                className="font-mono"
              >
                {sheetH} {unit} (Ancho)
              </text>
            </g>
          </svg>
        </div>

        {/* Hovered Piece Detail Popover (Fixed Overlay) */}
        {hoveredPiece && (
          <div className="absolute bottom-4 right-4 bg-stone-900/95 text-stone-100 p-3 rounded-lg shadow-xl border border-stone-700 text-xs backdrop-blur-xs max-w-xs animate-in fade-in">
            <div className="flex items-center justify-between gap-2 border-b border-stone-700 pb-1.5 mb-1.5">
              <span className="font-bold text-amber-300">{hoveredPiece.pieceName}</span>
              {hoveredPiece.rotated && (
                <span className="bg-amber-500/30 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-mono">
                  Girada 90°
                </span>
              )}
            </div>
            <div className="space-y-1 font-mono text-[11px] text-stone-300">
              <div className="flex justify-between">
                <span>Dimensiones:</span>
                <strong className="text-white">
                  {Math.round(hoveredPiece.width)} × {Math.round(hoveredPiece.height)} {unit}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Posición (X, Y):</span>
                <span>
                  {Math.round(hoveredPiece.x)}, {Math.round(hoveredPiece.y)} {unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Área:</span>
                <span>{formatArea(hoveredPiece.width * hoveredPiece.height, unit)}</span>
              </div>
              {showEdgeBanding && (
                <div className="pt-1 border-t border-stone-800 flex items-center justify-between text-[10px]">
                  <span>Tapacantos:</span>
                  <span className="text-amber-400">
                    {[
                      hoveredPiece.edgeBanding.top ? 'L1' : null,
                      hoveredPiece.edgeBanding.bottom ? 'L2' : null,
                      hoveredPiece.edgeBanding.left ? 'A1' : null,
                      hoveredPiece.edgeBanding.right ? 'A2' : null,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Ninguno'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sheet Summary Legend */}
      <div className="bg-stone-50 border-t border-stone-200 p-3 px-4 flex flex-wrap items-center justify-between text-xs text-stone-700 gap-3">
        {/* Visual Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-amber-200 border border-amber-500" />
            <span>Piezas útiles ({placedPieces.length})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-500" />
            <span>Retales aprovechables ({wasteAreas.filter((w) => w.isUsableOffcut).length})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-red-600" />
            <span>Líneas de corte guillotina</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-4 h-1 bg-red-700 rounded-xs" />
            <span>Tapacanto rojo</span>
          </div>
        </div>

        {/* Current Sheet Metrics */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <span>
            Aprovechamiento Lámina {activeSheetIndex + 1}:{' '}
            <strong className="text-amber-700">{efficiencyPercentage.toFixed(1)}%</strong>
          </span>
          <span className="text-stone-300">•</span>
          <span>
            Cortes:{' '}
            <strong className="text-stone-900">{formatLinear(currentSheet.cutsLength, unit)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
