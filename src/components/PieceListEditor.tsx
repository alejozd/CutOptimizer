import React, { useState, useMemo } from 'react';
import { EdgeBanding, PieceInput, Unit } from '../types';
import { PIECE_COLORS } from '../utils/presets';
import { formatArea } from '../utils/optimizer';
import { 
  Plus, 
  Trash2, 
  Copy, 
  RotateCw, 
  FileSpreadsheet, 
  Layers,
  X,
  Upload,
  Download,
  AlertCircle,
  FolderPlus,
  Sparkles,
  Info,
  Layers as LayersIcon
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
  const [draftFurnitureGroup, setDraftFurnitureGroup] = useState('');
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

  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchError, setBatchError] = useState('');

  // Extract distinct furniture groups
  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    pieces.forEach((p) => {
      const g = (p.furnitureGroup || '').trim();
      if (g) set.add(g);
    });
    return Array.from(set);
  }, [pieces]);

  // Total metrics
  const totalItemsCount = pieces.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const totalPiecesArea = pieces.reduce(
    (sum, p) => sum + (p.length || 0) * (p.width || 0) * (p.quantity || 0),
    0
  );

  // Carpentry calculation hint
  const carpentryAdvice = useMemo(() => {
    // Find if there is a group with laterals and shelves
    for (const grp of (existingGroups.length > 0 ? existingGroups : ['Mueble'])) {
      const groupPieces = pieces.filter(
        (p) => (p.furnitureGroup || '').trim() === grp || existingGroups.length === 0
      );

      const lateral = groupPieces.find((p) => {
        const n = p.name.toLowerCase();
        return n.includes('lateral') || n.includes('costado');
      });

      const shelf = groupPieces.find((p) => {
        const n = p.name.toLowerCase();
        return n.includes('entrepa') || n.includes('estante') || n.includes('repisa');
      });

      const back = groupPieces.find((p) => {
        const n = p.name.toLowerCase();
        return n.includes('traser') || n.includes('fondo') || n.includes('respaldo');
      });

      if (lateral || shelf || back) {
        const standardThickness = unit === 'cm' ? 1.8 : unit === 'in' ? 0.75 : 18;
        const totalThicknessDiscount = standardThickness * 2;
        
        let outerWidth = 0;
        if (back) outerWidth = Math.min(back.length, back.width);
        else if (lateral && shelf) outerWidth = Math.max(shelf.length, shelf.width) + totalThicknessDiscount;

        return {
          groupName: grp,
          outerWidth: outerWidth > 0 ? outerWidth : null,
          thickness: standardThickness,
          discount: totalThicknessDiscount,
          shelfInteriorWidth: outerWidth > 0 ? Math.max(0, outerWidth - totalThicknessDiscount) : null,
        };
      }
    }
    return null;
  }, [pieces, existingGroups, unit]);

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
      furnitureGroup: draftFurnitureGroup.trim() || (existingGroups[0] || 'Mueble 1'),
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

  // Direct CSV Export from the Editor
  const handleExportCSV = () => {
    const headers = ['Mueble / Grupo', 'Nombre', `Largo (${unit})`, `Ancho (${unit})`, 'Cantidad', 'Girar 90°', 'L1', 'L2', 'A1', 'A2'];
    const rows = pieces.map((p) => [
      `"${p.furnitureGroup || 'General'}"`,
      `"${p.name}"`,
      p.length,
      p.width,
      p.quantity,
      p.allowRotation ? 'Sí' : 'No',
      p.edgeBanding?.top ? '1' : '0',
      p.edgeBanding?.bottom ? '1' : '0',
      p.edgeBanding?.left ? '1' : '0',
      p.edgeBanding?.right ? '1' : '0',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Despiece_Muebles_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Batch CSV / Excel Parser supporting multi-furniture
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
        // Skip header line
        if (
          i === 0 &&
          (line.toLowerCase().includes('largo') ||
            line.toLowerCase().includes('length') ||
            line.toLowerCase().includes('nombre') ||
            line.toLowerCase().includes('mueble') ||
            line.toLowerCase().includes('pieza'))
        ) {
          continue;
        }

        // Split by tab, comma, or semicolon
        const parts = line.split(/[\t,;]+/).map((p) => p.trim().replace(/^"|"$/g, ''));
        if (parts.length < 2) continue;

        let furnitureGroup = 'Mueble 1';
        let name = '';
        let length = 0;
        let width = 0;
        let qty = 1;
        let rot = true;

        // Case A: 5+ columns (Mueble, Nombre, Largo, Ancho, Cantidad)
        if (
          parts.length >= 4 &&
          isNaN(Number(parts[0])) &&
          isNaN(Number(parts[1])) &&
          !isNaN(Number(parts[2].replace(',', '.')))
        ) {
          furnitureGroup = parts[0] || 'Mueble 1';
          name = parts[1];
          length = parseFloat(parts[2].replace(',', '.'));
          width = parseFloat(parts[3].replace(',', '.'));
          qty = parts[4] ? parseInt(parts[4], 10) || 1 : 1;
          rot = parts[5] ? parts[5].toLowerCase() !== 'no' && parts[5] !== '0' : true;
        }
        // Case B: (Nombre, Largo, Ancho, Cantidad, [Giro], [Mueble])
        else if (parts.length >= 3 && isNaN(Number(parts[0])) && !isNaN(Number(parts[1].replace(',', '.')))) {
          name = parts[0];
          length = parseFloat(parts[1].replace(',', '.'));
          width = parseFloat(parts[2].replace(',', '.'));
          qty = parts[3] ? parseInt(parts[3], 10) || 1 : 1;
          rot = parts[4] ? parts[4].toLowerCase() !== 'no' && parts[4] !== '0' : true;
          if (parts[5]) {
            furnitureGroup = parts[5];
          } else {
            // Auto detect from name if has prefix (e.g. "Estante - Lateral")
            if (name.includes('-')) {
              const prefix = name.split('-')[0].trim();
              if (prefix.length > 2) furnitureGroup = prefix;
            } else if (name.toLowerCase().includes('mesita') || name.toLowerCase().includes('noche')) {
              furnitureGroup = 'Mesita de Noche';
            } else if (name.toLowerCase().includes('estante') || name.toLowerCase().includes('biblioteca')) {
              furnitureGroup = 'Estantería';
            }
          }
        }
        // Case C: (Largo, Ancho, Cantidad, Nombre, [Mueble])
        else if (!isNaN(Number(parts[0].replace(',', '.'))) && !isNaN(Number(parts[1].replace(',', '.')))) {
          length = parseFloat(parts[0].replace(',', '.'));
          width = parseFloat(parts[1].replace(',', '.'));
          qty = parts[2] ? parseInt(parts[2], 10) || 1 : 1;
          name = parts[3] || `Pieza ${importedPieces.length + 1}`;
          if (parts[4]) furnitureGroup = parts[4];
        }

        if (length > 0 && width > 0) {
          importedPieces.push({
            id: `piece-imp-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            name: name || `Pieza ${importedPieces.length + 1}`,
            furnitureGroup,
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
        setBatchError('No se detectaron piezas válidas con formato (Nombre, Largo, Ancho, Cantidad).');
        return;
      }

      onChange([...pieces, ...importedPieces]);
      setShowBatchModal(false);
      setBatchText('');
    } catch {
      setBatchError('Error al procesar el texto. Verifica el formato e inténtalo de nuevo.');
    }
  };

  // Filtered pieces according to group selection
  const displayedPieces = useMemo(() => {
    if (filterGroup === 'all') return pieces;
    return pieces.filter((p) => (p.furnitureGroup || '').trim() === filterGroup);
  }, [pieces, filterGroup]);

  return (
    <div id="piece-list-editor" className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
      {/* Panel Header */}
      <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            2
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <span>Piezas a Cortar ({pieces.length} tipos, {totalItemsCount} unidades)</span>
              {existingGroups.length > 1 && (
                <span className="text-[11px] font-normal px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full">
                  {existingGroups.length} muebles en proyecto
                </span>
              )}
            </h2>
            <p className="text-xs text-stone-500">
              Ingresa las dimensiones y asigna cada pieza a su mueble para auto-ensamble 3D
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* CSV Import */}
          <button
            id="batch-import-button"
            type="button"
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1 text-xs bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 px-2.5 py-1 rounded-lg transition-colors font-medium shadow-2xs"
            title="Importar lista desde Excel o CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
            <span>Pegar / CSV</span>
          </button>

          {/* CSV Export */}
          {pieces.length > 0 && (
            <button
              id="export-csv-button"
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 text-xs bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 px-2.5 py-1 rounded-lg transition-colors font-medium shadow-2xs"
              title="Descargar archivo CSV con la lista de piezas"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}

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
          {/* Furniture / Group Name */}
          <div className="sm:col-span-3">
            <label htmlFor="draft-piece-group" className="block text-[11px] font-medium text-stone-600 mb-1 flex items-center gap-1">
              <FolderPlus className="w-3 h-3 text-amber-600" />
              <span>Mueble / Proyecto</span>
            </label>
            <input
              id="draft-piece-group"
              type="text"
              list="existing-groups-list"
              value={draftFurnitureGroup}
              onChange={(e) => setDraftFurnitureGroup(e.target.value)}
              placeholder={existingGroups[0] || 'Ej: Estante, Mesita...'}
              className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
            <datalist id="existing-groups-list">
              {existingGroups.map((grp) => (
                <option key={grp} value={grp} />
              ))}
            </datalist>
          </div>

          {/* Piece Name */}
          <div className="sm:col-span-3">
            <label htmlFor="draft-piece-name" className="block text-[11px] font-medium text-stone-600 mb-1">
              Nombre de la Pieza
            </label>
            <input
              id="draft-piece-name"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Ej: Lateral, Entrepaño, Puerta..."
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
          <div className="sm:col-span-1">
            <label htmlFor="draft-piece-qty" className="block text-[11px] font-medium text-stone-600 mb-1 text-center">
              Cant.
            </label>
            <input
              id="draft-piece-qty"
              type="number"
              min="1"
              max="1000"
              step="1"
              value={draftQuantity}
              onChange={(e) => setDraftQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full bg-white border border-stone-300 rounded-lg py-1.5 text-center text-xs text-stone-900 font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
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

      {/* Carpentry Rule Banner / Shelf Dimension Assistant */}
      {carpentryAdvice && carpentryAdvice.shelfInteriorWidth !== null && (
        <div className="bg-amber-50/70 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>📐 Regla de Entrepaños ({carpentryAdvice.groupName}):</strong> Para un ancho exterior de{' '}
              <strong>{carpentryAdvice.outerWidth} {unit}</strong> y melamina de <strong>{carpentryAdvice.thickness} {unit}</strong>,
              los entrepaños interiores deben medir <strong>{carpentryAdvice.shelfInteriorWidth.toFixed(1)} {unit}</strong> de largo
              ({carpentryAdvice.outerWidth} − {carpentryAdvice.discount} {unit}) para encajar perfectamente entre los 2 laterales.
            </span>
          </div>
        </div>
      )}

      {/* Filter by furniture group tabs if multiple exist */}
      {existingGroups.length > 1 && (
        <div className="px-4 py-2 bg-stone-100/70 border-b border-stone-200 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-medium text-stone-500 mr-1">Filtrar tabla:</span>
          <button
            onClick={() => setFilterGroup('all')}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
              filterGroup === 'all'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
            }`}
          >
            Todos ({pieces.length})
          </button>
          {existingGroups.map((grp) => {
            const count = pieces.filter((p) => (p.furnitureGroup || '').trim() === grp).length;
            return (
              <button
                key={grp}
                onClick={() => setFilterGroup(grp)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                  filterGroup === grp
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                }`}
              >
                {grp} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Pieces Table */}
      <div className="flex-1 overflow-x-auto max-h-[380px] overflow-y-auto">
        {pieces.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-2.5">
              <Layers className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-stone-700">No hay piezas añadidas</p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto mt-1">
              Ingresa las medidas en la barra superior, pega un CSV o carga una plantilla.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-100/80 text-stone-600 uppercase text-[10px] font-semibold tracking-wider sticky top-0 border-b border-stone-200 z-10">
              <tr>
                <th className="py-2 px-3">Mueble</th>
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
              {displayedPieces.map((piece) => {
                const eb = piece.edgeBanding || { top: false, bottom: false, left: false, right: false };
                return (
                  <tr key={piece.id} className="hover:bg-amber-50/40 transition-colors group">
                    {/* Furniture Group */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={piece.furnitureGroup || ''}
                        placeholder="Mueble 1"
                        onChange={(e) => handleUpdatePiece(piece.id, { furnitureGroup: e.target.value })}
                        className="bg-stone-50 group-hover:bg-white border border-stone-200 hover:border-stone-300 focus:border-amber-500 rounded px-1.5 py-0.5 text-xs text-amber-900 font-medium w-24 sm:w-28 focus:outline-none"
                      />
                    </td>

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
                          className="bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-stone-300 focus:border-amber-500 rounded px-1.5 py-0.5 text-xs text-stone-900 font-medium w-32 sm:w-40 focus:outline-none transition-all"
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
          Tip: Asigna el mismo nombre de Mueble a las piezas que componen un mismo mueble
        </div>
      </div>

      {/* CSV / Excel Batch Import Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-lg w-full overflow-hidden">
            <div className="bg-stone-900 text-stone-100 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold">Pegar desde Excel o CSV Multi-Mueble</h3>
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
                <strong className="text-stone-800">Formatos soportados:</strong>
                <br />
                • <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[11px]">Mueble, Nombre, Largo, Ancho, Cantidad</code>
                <br />
                • <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[11px]">Nombre, Largo, Ancho, Cantidad</code>
              </p>

              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={`Estante\tLateral\t150\t44\t2\nEstante\tTrasera\t150\t55\t1\nEstante\tEntrepaño\t51.4\t44\t4\nMesita\tLateral\t60\t35\t2\nMesita\tTapa\t45\t35\t1`}
                className="w-full h-44 bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:bg-white"
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
