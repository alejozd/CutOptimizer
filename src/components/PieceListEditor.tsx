import React, { useState } from 'react';
import { EdgeBanding, PieceInput, Unit } from '../types';
import { PIECE_COLORS } from '../utils/presets';
import { formatArea } from '../utils/optimizer';
import { 
  Plus, 
  Trash2, 
  Copy, 
  RotateCw, 
  FileSpreadsheet, 
  Sparkles,
  Layers,
  Check,
  X,
  Upload,
  Download,
  AlertCircle
} from 'lucide-react';

interface PieceListEditorProps {
  pieces: PieceInput[];
  onChange: (updatedPieces: PieceInput[]) => void;
  unit: Unit;
  sheetArea: number;
}

export const PieceListEditor: React.FC<PieceListEditorProps> = ({
  pieces,
  onChange,
  unit,
  sheetArea,
}) => {
  // New piece draft state
  const [draftName, setDraftName] = useState('');
  const [draftLength, setDraftLength] = useState<string>('');
  const [draftWidth, setDraftWidth] = useState<string>('');
  const [draftQuantity, setDraftQuantity] = useState<number>(1);
  const [draftRotation, setDraftRotation] = useState<boolean>(true);
  const [draftColor, setDraftColor] = useState<string>(PIECE_COLORS[0].hex);
  const [draftEdgeBanding, setDraftEdgeBanding] = useState<EdgeBanding>({
    top: false,
    bottom: false,
    left: false,
    right: false,
  });

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchError, setBatchError] = useState('');

  // Total metrics
  const totalItemsCount = pieces.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const totalPiecesArea = pieces.reduce(
    (sum, p) => sum + (p.length || 0) * (p.width || 0) * (p.quantity || 0),
    0
  );

  const handleAddPiece = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanL = draftLength.toString().replace(',', '.').trim();
    const cleanW = draftWidth.toString().replace(',', '.').trim();
    const parsedLength = parseFloat(cleanL);
    const parsedWidth = parseFloat(cleanW);

    if (isNaN(parsedLength) || isNaN(parsedWidth) || parsedLength <= 0 || parsedWidth <= 0) {
      return;
    }

    const newPiece: PieceInput = {
      id: `piece-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: draftName.trim() || `Pieza ${pieces.length + 1}`,
      length: parsedLength,
      width: parsedWidth,
      quantity: Math.max(1, draftQuantity),
      allowRotation: draftRotation,
      color: draftColor,
      edgeBanding: { ...draftEdgeBanding },
    };

    onChange([...pieces, newPiece]);

    // Reset draft form but cycle color
    setDraftName('');
    setDraftLength('');
    setDraftWidth('');
    setDraftQuantity(1);
    const currentColorIdx = PIECE_COLORS.findIndex((c) => c.hex === draftColor);
    const nextColor = PIECE_COLORS[(currentColorIdx + 1) % PIECE_COLORS.length].hex;
    setDraftColor(nextColor);
  };

  const handleUpdatePiece = (id: string, updates: Partial<PieceInput>) => {
    onChange(
      pieces.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const handleDeletePiece = (id: string) => {
    onChange(pieces.filter((p) => p.id !== id));
  };

  const handleDuplicatePiece = (piece: PieceInput) => {
    const duplicated: PieceInput = {
      ...piece,
      id: `piece-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${piece.name} (Copia)`,
    };
    onChange([...pieces, duplicated]);
  };

  const handleClearAll = () => {
    if (window.confirm('¿Deseas eliminar todas las piezas de la lista?')) {
      onChange([]);
    }
  };

  const toggleEdgeBanding = (pieceId: string, side: keyof EdgeBanding) => {
    const target = pieces.find((p) => p.id === pieceId);
    if (!target) return;
    const currentEb = target.edgeBanding || { top: false, bottom: false, left: false, right: false };
    handleUpdatePiece(pieceId, {
      edgeBanding: {
        ...currentEb,
        [side]: !currentEb[side],
      },
    });
  };

  // Batch CSV Import
  const handleProcessBatchText = () => {
    try {
      setBatchError('');
      const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setBatchError('Pega o escribe al menos una línea de datos.');
        return;
      }

      const importedPieces: PieceInput[] = [];
      let colorIdx = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip header if present
        if (i === 0 && (line.toLowerCase().includes('largo') || line.toLowerCase().includes('length') || line.toLowerCase().includes('nombre'))) {
          continue;
        }

        // Split by tab, comma, or semicolon
        const parts = line.split(/[\t,;]+/).map((p) => p.trim());
        if (parts.length < 2) continue;

        let name = '';
        let length = 0;
        let width = 0;
        let qty = 1;
        let rot = true;

        if (parts.length >= 3 && isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
          // Format: Nombre, Largo, Ancho, [Cantidad], [Giro]
          name = parts[0];
          length = parseFloat(parts[1]);
          width = parseFloat(parts[2]);
          qty = parts[3] ? parseInt(parts[3], 10) || 1 : 1;
          rot = parts[4] ? parts[4].toLowerCase() !== 'no' && parts[4] !== '0' : true;
        } else if (!isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
          // Format: Largo, Ancho, [Cantidad], [Nombre]
          length = parseFloat(parts[0]);
          width = parseFloat(parts[1]);
          qty = parts[2] ? parseInt(parts[2], 10) || 1 : 1;
          name = parts[3] || `Pieza ${importedPieces.length + 1}`;
        }

        if (length > 0 && width > 0) {
          importedPieces.push({
            id: `piece-imp-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            name: name || `Pieza ${importedPieces.length + 1}`,
            length,
            width,
            quantity: Math.max(1, qty),
            allowRotation: rot,
            color: PIECE_COLORS[colorIdx % PIECE_COLORS.length].hex,
            edgeBanding: { top: false, bottom: false, left: false, right: false },
          });
          colorIdx++;
        }
      }

      if (importedPieces.length === 0) {
        setBatchError('No se detectaron piezas válidas con formato (Largo, Ancho, Cantidad).');
        return;
      }

      onChange([...pieces, ...importedPieces]);
      setShowBatchModal(false);
      setBatchText('');
    } catch {
      setBatchError('Error al procesar el texto. Verifica el formato e inténtalo de nuevo.');
    }
  };

  return (
    <div id="piece-list-editor" className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
      {/* Panel Header */}
      <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            2
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              Piezas a Cortar ({pieces.length} tipos, {totalItemsCount} unidades)
            </h2>
            <p className="text-xs text-stone-500">
              Ingresa las dimensiones de cada pieza y configuración de cantos
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            id="batch-import-button"
            type="button"
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1 text-xs bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 px-2.5 py-1 rounded-lg transition-colors font-medium"
            title="Importar lista desde Excel o CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
            <span>Pegar / CSV</span>
          </button>

          {pieces.length > 0 && (
            <button
              id="clear-all-pieces-button"
              type="button"
              onClick={handleClearAll}
              className="text-xs text-stone-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
              title="Vaciar lista de piezas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Add Bar Form */}
      <form onSubmit={handleAddPiece} className="p-3.5 bg-stone-50/70 border-b border-stone-200">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          {/* Piece Name */}
          <div className="sm:col-span-4">
            <label htmlFor="draft-piece-name" className="block text-[11px] font-medium text-stone-600 mb-1">
              Nombre / Etiqueta
            </label>
            <input
              id="draft-piece-name"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Ej: Lateral, Puerta, Repisa..."
              className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Length */}
          <div className="sm:col-span-2">
            <label htmlFor="draft-piece-length" className="block text-[11px] font-medium text-stone-600 mb-1 flex justify-between">
              <span>Largo</span>
              <span className="text-stone-400 font-mono">[{unit}]</span>
            </label>
            <input
              id="draft-piece-length"
              type="number"
              min="0.01"
              step="any"
              value={draftLength}
              onChange={(e) => setDraftLength(e.target.value)}
              placeholder="0.0"
              className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 font-mono font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>

          {/* Width */}
          <div className="sm:col-span-2">
            <label htmlFor="draft-piece-width" className="block text-[11px] font-medium text-stone-600 mb-1 flex justify-between">
              <span>Ancho</span>
              <span className="text-stone-400 font-mono">[{unit}]</span>
            </label>
            <input
              id="draft-piece-width"
              type="number"
              min="0.01"
              step="any"
              value={draftWidth}
              onChange={(e) => setDraftWidth(e.target.value)}
              placeholder="0.0"
              className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 font-mono font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              required
            />
          </div>

          {/* Quantity */}
          <div className="sm:col-span-2">
            <label htmlFor="draft-piece-qty" className="block text-[11px] font-medium text-stone-600 mb-1 text-center">
              Cant.
            </label>
            <div className="flex items-center justify-center bg-white border border-stone-300 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setDraftQuantity((q) => Math.max(1, q - 1))}
                className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs transition-colors shrink-0"
                title="Disminuir cantidad"
              >
                -
              </button>
              <input
                id="draft-piece-qty"
                type="number"
                min="1"
                max="1000"
                step="1"
                value={draftQuantity}
                onChange={(e) => setDraftQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-12 bg-transparent text-center text-xs text-stone-900 font-mono font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setDraftQuantity((q) => q + 1)}
                className="w-6 h-6 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs transition-colors shrink-0"
                title="Aumentar cantidad"
              >
                +
              </button>
            </div>
          </div>

          {/* Rotate Toggle */}
          <div className="sm:col-span-1 flex flex-col items-center">
            <label htmlFor="draft-piece-rotation" className="block text-[11px] font-medium text-stone-600 mb-1" title="Permitir girar la pieza para mejor ajuste">
              Giro
            </label>
            <button
              id="draft-piece-rotation"
              type="button"
              onClick={() => setDraftRotation(!draftRotation)}
              className={`w-full py-1.5 rounded-lg border text-xs flex items-center justify-center transition-all ${
                draftRotation
                  ? 'bg-amber-100 border-amber-400 text-amber-900 font-medium'
                  : 'bg-stone-200 border-stone-300 text-stone-500'
              }`}
              title={draftRotation ? 'Giro permitido (90°)' : 'Orientación bloqueada'}
            >
              <RotateCw className={`w-3.5 h-3.5 ${draftRotation ? 'text-amber-700' : 'text-stone-400'}`} />
            </button>
          </div>

          {/* Add Button */}
          <div className="sm:col-span-1">
            <label className="block text-[11px] font-medium text-transparent mb-1 select-none">
              Añadir
            </label>
            <button
              id="add-piece-submit-button"
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-xs"
              title="Añadir pieza a la lista"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir</span>
            </button>
          </div>
        </div>
      </form>

      {/* Pieces Table */}
      <div className="flex-1 overflow-x-auto max-h-[380px] overflow-y-auto">
        {pieces.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-2.5">
              <Layers className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-stone-700">No hay piezas añadidas</p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto mt-1">
              Ingresa las medidas en la barra superior o carga una plantilla de mueble prediseñada.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-100/80 text-stone-600 uppercase text-[10px] font-semibold tracking-wider sticky top-0 border-b border-stone-200 z-10">
              <tr>
                <th className="py-2 px-3">Pieza</th>
                <th className="py-2 px-2">Largo ({unit})</th>
                <th className="py-2 px-2">Ancho ({unit})</th>
                <th className="py-2 px-2 text-center">Cantidad</th>
                <th className="py-2 px-2 text-center">Girar 90°</th>
                <th className="py-2 px-2 text-center" title="Tapacantos en bordes: Superior (L1), Inferior (L2), Izquierdo (A1), Derecho (A2)">
                  Tapacantos (L1, L2, A1, A2)
                </th>
                <th className="py-2 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pieces.map((piece, index) => {
                const eb = piece.edgeBanding || { top: false, bottom: false, left: false, right: false };
                return (
                  <tr key={piece.id} className="hover:bg-amber-50/40 transition-colors group">
                    {/* Color dot + Name */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {/* Color Selector Mini */}
                        <div className="relative">
                          <input
                            type="color"
                            id={`piece-color-${piece.id}`}
                            value={piece.color}
                            onChange={(e) => handleUpdatePiece(piece.id, { color: e.target.value })}
                            className="w-5 h-5 rounded-md border border-stone-300 cursor-pointer p-0 opacity-0 absolute inset-0 z-10"
                            title="Cambiar color de la pieza"
                          />
                          <div
                            className="w-4 h-4 rounded-full border shadow-xs"
                            style={{ backgroundColor: piece.color, borderColor: 'rgba(0,0,0,0.15)' }}
                          />
                        </div>
                        <input
                          type="text"
                          value={piece.name}
                          onChange={(e) => handleUpdatePiece(piece.id, { name: e.target.value })}
                          className="bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-stone-300 focus:border-amber-500 rounded px-1.5 py-0.5 text-xs text-stone-900 font-medium w-36 sm:w-44 focus:outline-none transition-all"
                        />
                      </div>
                    </td>

                    {/* Length input */}
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={piece.length ?? ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(',', '.'));
                          handleUpdatePiece(piece.id, {
                            length: isNaN(val) ? 0 : val,
                          });
                        }}
                        className="w-20 bg-stone-50 group-hover:bg-white border border-stone-200 focus:border-amber-500 rounded px-2 py-1 text-xs font-mono font-semibold text-stone-800 text-right focus:outline-none"
                      />
                    </td>

                    {/* Width input */}
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={piece.width ?? ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(',', '.'));
                          handleUpdatePiece(piece.id, {
                            width: isNaN(val) ? 0 : val,
                          });
                        }}
                        className="w-20 bg-stone-50 group-hover:bg-white border border-stone-200 focus:border-amber-500 rounded px-2 py-1 text-xs font-mono font-semibold text-stone-800 text-right focus:outline-none"
                      />
                    </td>

                    {/* Quantity controls */}
                    <td className="py-2 px-2 text-center">
                      <div className="inline-flex items-center justify-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePiece(piece.id, { quantity: Math.max(1, piece.quantity - 1) })
                          }
                          className="w-5 h-5 rounded bg-white hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs transition-colors shadow-2xs"
                          title="Restar 1"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          step="1"
                          value={piece.quantity}
                          onChange={(e) =>
                            handleUpdatePiece(piece.id, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                          }
                          className="w-10 text-center font-mono font-bold text-xs text-stone-900 bg-transparent focus:bg-white focus:outline-none rounded"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePiece(piece.id, { quantity: piece.quantity + 1 })
                          }
                          className="w-5 h-5 rounded bg-white hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs transition-colors shadow-2xs"
                          title="Sumar 1"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Allow rotation toggle */}
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdatePiece(piece.id, { allowRotation: !piece.allowRotation })
                        }
                        className={`p-1 rounded-md border text-xs inline-flex items-center justify-center transition-all ${
                          piece.allowRotation
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-stone-100 border-stone-300 text-stone-400'
                        }`}
                        title={piece.allowRotation ? 'Giro permitido (90°)' : 'Orientación bloqueada'}
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </td>

                    {/* Edge Banding (Tapacantos L1, L2, A1, A2) */}
                    <td className="py-2 px-2 text-center">
                      <div className="inline-flex items-center gap-1 bg-stone-100 p-0.5 rounded-md border border-stone-200">
                        <button
                          type="button"
                          onClick={() => toggleEdgeBanding(piece.id, 'top')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                            eb.top ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-700'
                          }`}
                          title="Tapacanto en Largo 1 (Superior)"
                        >
                          L1
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleEdgeBanding(piece.id, 'bottom')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                            eb.bottom ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-700'
                          }`}
                          title="Tapacanto en Largo 2 (Inferior)"
                        >
                          L2
                        </button>
                        <span className="text-stone-300">|</span>
                        <button
                          type="button"
                          onClick={() => toggleEdgeBanding(piece.id, 'left')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                            eb.left ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-700'
                          }`}
                          title="Tapacanto en Ancho 1 (Izquierdo)"
                        >
                          A1
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleEdgeBanding(piece.id, 'right')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                            eb.right ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-700'
                          }`}
                          title="Tapacanto en Ancho 2 (Derecho)"
                        >
                          A2
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicatePiece(piece)}
                          className="text-stone-400 hover:text-stone-700 p-1 rounded hover:bg-stone-100 transition-colors"
                          title="Duplicar pieza"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePiece(piece.id)}
                          className="text-stone-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Eliminar pieza"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer info bar */}
      <div className="bg-stone-50 border-t border-stone-200 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-stone-600 gap-2">
        <div className="flex items-center gap-3">
          <span className="font-medium text-stone-700">
            Área total requerida: <strong className="font-mono text-stone-900">{formatArea(totalPiecesArea, unit)}</strong>
          </span>
          {sheetArea > 0 && (
            <span className="text-stone-500 text-[11px] hidden sm:inline">
              (~{(totalPiecesArea / sheetArea).toFixed(1)} láminas teóricas mínimas)
            </span>
          )}
        </div>

        <div className="text-[11px] text-stone-400">
          Tip: Haz clic en L1/L2/A1/A2 para asignar tapacanto por lado
        </div>
      </div>

      {/* CSV / Excel Batch Import Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-lg w-full overflow-hidden">
            <div className="bg-stone-900 text-stone-100 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold">Pegar desde Excel o CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-stone-600">
                Pega directamente columnas copiadas de Excel o texto delimitado por comas/tabulaciones.
                <br />
                <strong className="text-stone-800">Formatos reconocidos:</strong>
                <br />
                • <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[11px]">Nombre, Largo, Ancho, Cantidad</code>
                <br />
                • <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[11px]">Largo, Ancho, Cantidad, Nombre</code>
              </p>

              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={`Lateral 1\t720\t580\t2\nBase\t564\t580\t1\nEstante\t562\t560\t2`}
                className="w-full h-40 bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white"
              />

              {batchError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{batchError}</span>
                </div>
              )}
            </div>

            <div className="bg-stone-50 border-t border-stone-200 px-4 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessBatchText}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar Piezas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
