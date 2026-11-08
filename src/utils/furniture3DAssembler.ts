import * as THREE from 'three';
import { PieceInput, Unit } from '../types';

export type Piece3DType = 'lateral' | 'horizontal' | 'shelf' | 'door' | 'back' | 'top' | 'drawer' | 'misc';

export interface Piece3DDef {
  id: string;
  name: string;
  furnitureGroup: string;
  w: number; // width along X in mm
  h: number; // height along Y in mm
  d: number; // depth along Z in mm
  x: number; // center X in mm
  y: number; // center Y in mm
  z: number; // center Z in mm
  ex: THREE.Vector3; // explosion direction & distance offset
  type: Piece3DType;
  color?: string;
  actualDimensions: { length: number; width: number; qty: number };
}

export interface FurnitureModule3D {
  name: string;
  width: number;
  height: number;
  depth: number;
  boardThickness: number;
  interiorWidth: number;
  piecesCount: number;
  defs: Piece3DDef[];
  center: THREE.Vector3;
  bounds: { height: number; dist: number };
}

export interface AssemblySceneResult {
  modules: FurnitureModule3D[];
  allDefs: Piece3DDef[];
  totalBounds: { height: number; dist: number; width: number };
}

// Convert units to mm
export function toMillimeters(value: number, unit: Unit): number {
  switch (unit) {
    case 'cm':
      return value * 10;
    case 'in':
      return value * 25.4;
    case 'mm':
    default:
      return value;
  }
}

// Classify piece role from its name and dimensions
export function classifyPieceRole(name: string, len: number, wid: number): Piece3DType {
  const n = name.toLowerCase();

  // 1. Back panel (fondo, trasera, respaldo)
  if (
    n.includes('fondo') ||
    n.includes('traser') ||
    n.includes('respaldo') ||
    n.includes('back') ||
    n.includes('faldon') ||
    n.includes('faldón')
  ) {
    return 'back';
  }

  // 2. Lateral sides (lateral, costado, parante, pata)
  if (
    n.includes('lateral') ||
    n.includes('costado') ||
    n.includes('parante') ||
    n.includes('pata') ||
    n.includes('side') ||
    n.includes('montante')
  ) {
    return 'lateral';
  }

  // 3. Shelves / Entrepaños (entrepaño, repisa, estante, divisor)
  if (
    n.includes('entrepa') ||
    n.includes('entrepano') ||
    n.includes('estante') ||
    n.includes('repisa') ||
    n.includes('balda') ||
    n.includes('shelf') ||
    n.includes('divisor') ||
    n.includes('division') ||
    n.includes('separador')
  ) {
    return 'shelf';
  }

  // 4. Doors & Drawers (puerta, frente, cajon)
  if (
    n.includes('puerta') ||
    n.includes('door') ||
    n.includes('frente caj') ||
    n.includes('tapa caj') ||
    n.includes('frente') ||
    n.includes('frontal')
  ) {
    return 'door';
  }

  if (n.includes('cajon') || n.includes('cajón') || n.includes('drawer') || n.includes('gaveta')) {
    return 'drawer';
  }

  // 5. Horizontals (tapa, cubierta, base, piso, techo, travesaño)
  if (n.includes('cubierta') || n.includes('tapa superior') || n.includes('top')) {
    return 'top';
  }

  if (
    n.includes('base') ||
    n.includes('piso') ||
    n.includes('techo') ||
    n.includes('amarre') ||
    n.includes('traves') ||
    n.includes('zocalo') ||
    n.includes('zócalo') ||
    n.includes('liston') ||
    n.includes('listón')
  ) {
    return 'horizontal';
  }

  // Dimension-based heuristic fallback:
  // If piece has high aspect ratio, it could be a lateral or back
  if (len > 1200 && wid > 400) {
    return 'lateral';
  }

  return 'shelf';
}

/**
 * Parametric Auto-Assembly Engine
 * Intelligently computes the 3D position and orientation of each piece in the furniture.
 */
export function buildFurnitureAssembly(
  pieces: PieceInput[],
  unit: Unit,
  boardThicknessMm = 18
): AssemblySceneResult {
  if (!pieces || pieces.length === 0) {
    return {
      modules: [],
      allDefs: [],
      totalBounds: { height: 350, dist: 1800, width: 600 },
    };
  }

  // 1. Group pieces by furnitureGroup (or auto-detect from names if omitted)
  const groupsMap = new Map<string, PieceInput[]>();

  pieces.forEach((p) => {
    let group = (p.furnitureGroup || '').trim();

    // Auto-detect group from name prefixes like "Estante - Lateral" or "Mesita / Tapa"
    if (!group) {
      if (p.name.includes('-')) {
        const parts = p.name.split('-');
        if (parts.length >= 2 && parts[0].trim().length > 2) {
          group = parts[0].trim();
        }
      } else if (p.name.includes(':')) {
        const parts = p.name.split(':');
        if (parts.length >= 2 && parts[0].trim().length > 2) {
          group = parts[0].trim();
        }
      } else if (p.name.toLowerCase().includes('mesita') || p.name.toLowerCase().includes('noche')) {
        group = 'Mesita de Noche';
      } else if (p.name.toLowerCase().includes('estante') || p.name.toLowerCase().includes('biblioteca')) {
        group = 'Estantería';
      } else if (p.name.toLowerCase().includes('escritorio') || p.name.toLowerCase().includes('mesa')) {
        group = 'Escritorio';
      } else if (p.name.toLowerCase().includes('cocina') || p.name.toLowerCase().includes('gabinete') || p.name.toLowerCase().includes('alacena')) {
        group = 'Gabinete';
      } else {
        group = 'Mueble Principal';
      }
    }

    if (!groupsMap.has(group)) {
      groupsMap.set(group, []);
    }
    groupsMap.get(group)!.push(p);
  });

  const groupEntries = Array.from(groupsMap.entries());
  const modules: FurnitureModule3D[] = [];
  const allDefs: Piece3DDef[] = [];

  // Calculate layout offset along X so multiple furniture appear side-by-side
  let currentOffsetX = 0;
  const moduleSpacing = 450; // mm gap between furniture in 3D scene

  groupEntries.forEach(([groupName, groupPieces]) => {
    const t = boardThicknessMm; // Standard 18mm

    // Categorize pieces in this group
    const classified: { piece: PieceInput; role: Piece3DType; lenMm: number; widMm: number }[] = [];

    groupPieces.forEach((p) => {
      const lenMm = toMillimeters(p.length, unit);
      const widMm = toMillimeters(p.width, unit);
      // Determine length as the longer dimension
      const dimL = Math.max(lenMm, widMm);
      const dimW = Math.min(lenMm, widMm);
      const role = classifyPieceRole(p.name, dimL, dimW);
      classified.push({ piece: p, role, lenMm: dimL, widMm: dimW });
    });

    // Determine furniture bounding box (Height, Depth, Width)
    const laterals = classified.filter((c) => c.role === 'lateral');
    const backs = classified.filter((c) => c.role === 'back');
    const tops = classified.filter((c) => c.role === 'top');
    const shelves = classified.filter((c) => c.role === 'shelf');
    const horizontals = classified.filter((c) => c.role === 'horizontal');
    const doors = classified.filter((c) => c.role === 'door' || c.role === 'drawer');

    // Height H: from laterals or backs or max dimension
    let H = 800; // default 800mm
    if (laterals.length > 0) {
      H = Math.max(...laterals.map((l) => l.lenMm));
    } else if (backs.length > 0) {
      H = Math.max(...backs.map((b) => b.lenMm));
    } else {
      H = Math.max(...classified.map((c) => c.lenMm));
    }

    // Depth D: from lateral width or shelf width
    let D = 400; // default 400mm
    if (laterals.length > 0) {
      D = Math.max(...laterals.map((l) => l.widMm));
    } else if (shelves.length > 0) {
      D = Math.max(...shelves.map((s) => s.widMm));
    } else if (horizontals.length > 0) {
      D = Math.max(...horizontals.map((h) => h.widMm));
    }

    // Width W (Overall exterior width):
    // Carpentry geometry rule:
    // If back exists -> back width W
    // If top exists -> top length W
    // If shelves exist -> shelf length + 2*t
    let W = 600;
    if (backs.length > 0) {
      W = Math.max(...backs.map((b) => b.widMm));
    } else if (tops.length > 0) {
      W = Math.max(...tops.map((t) => t.lenMm));
    } else if (shelves.length > 0) {
      const maxShelfL = Math.max(...shelves.map((s) => s.lenMm));
      W = maxShelfL + 2 * t;
    } else if (horizontals.length > 0) {
      const maxHoriL = Math.max(...horizontals.map((h) => h.lenMm));
      W = maxHoriL + 2 * t;
    }

    const interiorWidth = Math.max(100, W - 2 * t);
    const moduleDefs: Piece3DDef[] = [];

    // --- 1. Assemble Laterals ---
    let lateralCount = 0;
    laterals.forEach((item) => {
      const qty = item.piece.quantity;
      for (let q = 0; q < qty; q++) {
        lateralCount++;
        const isLeft = lateralCount % 2 !== 0;
        const xPos = isLeft ? -W / 2 + t / 2 : W / 2 - t / 2;
        const exDir = isLeft ? new THREE.Vector3(-220, 0, 0) : new THREE.Vector3(220, 0, 0);

        moduleDefs.push({
          id: `${item.piece.id}-lat-${q}`,
          name: `${item.piece.name}${qty > 1 ? ` (${isLeft ? 'Izq' : 'Der'})` : ''}`,
          furnitureGroup: groupName,
          w: t,
          h: item.lenMm || H,
          d: item.widMm || D,
          x: xPos,
          y: (item.lenMm || H) / 2,
          z: 0,
          ex: exDir,
          type: 'lateral',
          color: item.piece.color,
          actualDimensions: { length: item.lenMm, width: item.widMm, qty: item.piece.quantity },
        });
      }
    });

    // If no explicit lateral pieces were tagged, provide virtual side reference if there are shelves
    if (lateralCount === 0 && (shelves.length > 0 || horizontals.length > 0)) {
      // Create structural sides for visualization
      const sideH = H;
      moduleDefs.push({
        id: `auto-lat-left-${groupName}`,
        name: 'Lateral Izquierdo (Estructura)',
        furnitureGroup: groupName,
        w: t,
        h: sideH,
        d: D,
        x: -W / 2 + t / 2,
        y: sideH / 2,
        z: 0,
        ex: new THREE.Vector3(-200, 0, 0),
        type: 'lateral',
        actualDimensions: { length: sideH, width: D, qty: 1 },
      });
      moduleDefs.push({
        id: `auto-lat-right-${groupName}`,
        name: 'Lateral Derecho (Estructura)',
        furnitureGroup: groupName,
        w: t,
        h: sideH,
        d: D,
        x: W / 2 - t / 2,
        y: sideH / 2,
        z: 0,
        ex: new THREE.Vector3(200, 0, 0),
        type: 'lateral',
        actualDimensions: { length: sideH, width: D, qty: 1 },
      });
    }

    // --- 2. Assemble Base & Top Horizontals ---
    let basePlaced = false;
    let topPlaced = false;

    tops.forEach((item) => {
      for (let q = 0; q < item.piece.quantity; q++) {
        moduleDefs.push({
          id: `${item.piece.id}-top-${q}`,
          name: item.piece.name,
          furnitureGroup: groupName,
          w: item.lenMm || W,
          h: t,
          d: item.widMm || D,
          x: 0,
          y: H - t / 2,
          z: 0,
          ex: new THREE.Vector3(0, 180, 0),
          type: 'top',
          color: item.piece.color,
          actualDimensions: { length: item.lenMm, width: item.widMm, qty: item.piece.quantity },
        });
        topPlaced = true;
      }
    });

    horizontals.forEach((item) => {
      const nameL = item.piece.name.toLowerCase();
      for (let q = 0; q < item.piece.quantity; q++) {
        if (nameL.includes('techo') && !topPlaced) {
          moduleDefs.push({
            id: `${item.piece.id}-hor-top-${q}`,
            name: item.piece.name,
            furnitureGroup: groupName,
            w: Math.min(item.lenMm, interiorWidth),
            h: t,
            d: item.widMm || D,
            x: 0,
            y: H - t / 2,
            z: 0,
            ex: new THREE.Vector3(0, 180, 0),
            type: 'horizontal',
            color: item.piece.color,
            actualDimensions: { length: item.lenMm, width: item.widMm, qty: item.piece.quantity },
          });
          topPlaced = true;
        } else if ((nameL.includes('base') || nameL.includes('piso') || !basePlaced) && !basePlaced) {
          moduleDefs.push({
            id: `${item.piece.id}-hor-base-${q}`,
            name: item.piece.name,
            furnitureGroup: groupName,
            w: Math.min(item.lenMm, interiorWidth),
            h: t,
            d: item.widMm || D,
            x: 0,
            y: 50 + t / 2,
            z: 0,
            ex: new THREE.Vector3(0, -120, 0),
            type: 'horizontal',
            color: item.piece.color,
            actualDimensions: { length: item.lenMm, width: item.widMm, qty: item.piece.quantity },
          });
          basePlaced = true;
        } else {
          // Extra horizontal or crossbar (travesaño/zócalo)
          const isZocalo = nameL.includes('zocalo') || nameL.includes('zócalo');
          moduleDefs.push({
            id: `${item.piece.id}-hor-other-${q}`,
            name: item.piece.name,
            furnitureGroup: groupName,
            w: Math.min(item.lenMm, interiorWidth),
            h: isZocalo ? item.widMm : t,
            d: isZocalo ? t : (item.widMm || D),
            x: 0,
            y: isZocalo ? item.widMm / 2 : H * 0.5,
            z: isZocalo ? D / 2 - 20 : 0,
            ex: new THREE.Vector3(0, -80, 80),
            type: 'horizontal',
            color: item.piece.color,
            actualDimensions: { length: item.lenMm, width: item.widMm, qty: item.piece.quantity },
          });
        }
      }
    });

    // --- 3. Assemble Shelves / Entrepaños (Carpentry spacing between Base and Top) ---
    const allShelvesFlat: { piece: PieceInput; lenMm: number; widMm: number }[] = [];
    shelves.forEach((s) => {
      for (let q = 0; q < s.piece.quantity; q++) {
        allShelvesFlat.push({ piece: s.piece, lenMm: s.lenMm, widMm: s.widMm });
      }
    });

    const totalShelves = allShelvesFlat.length;
    const startY = basePlaced ? 70 + t : 40;
    const endY = topPlaced ? H - t - 30 : H - 30;
    const stepY = totalShelves > 0 ? (endY - startY) / (totalShelves + 1) : 0;

    allShelvesFlat.forEach((sh, idx) => {
      const shelfY = startY + (idx + 1) * stepY;
      // Carpentry dimension fit: The shelf width fits inside the interior width between the two sides
      const shelfW = sh.lenMm > 0 ? Math.min(sh.lenMm, interiorWidth) : interiorWidth;
      const shelfD = sh.widMm > 0 ? Math.min(sh.widMm, D - 10) : D - 15;

      moduleDefs.push({
        id: `${sh.piece.id}-shelf-${idx}`,
        name: `${sh.piece.name}${totalShelves > 1 ? ` (Nivel ${idx + 1})` : ''}`,
        furnitureGroup: groupName,
        w: shelfW,
        h: t,
        d: shelfD,
        x: 0,
        y: shelfY,
        z: -5,
        ex: new THREE.Vector3(0, (idx + 1) * 30, 160 + idx * 30),
        type: 'shelf',
        color: sh.piece.color,
        actualDimensions: { length: sh.lenMm, width: sh.widMm, qty: 1 },
      });
    });

    // --- 4. Assemble Back Panel (Trasera / Fondo) ---
    backs.forEach((item) => {
      for (let q = 0; q < item.piece.quantity; q++) {
        const backW = item.widMm || W;
        const backH = item.lenMm || H;

        moduleDefs.push({
          id: `${item.piece.id}-back-${q}`,
          name: item.piece.name,
          furnitureGroup: groupName,
          w: backW,
          h: backH,
          d: 4, // 3-4mm MDF or melamina
          x: 0,
          y: backH / 2,
          z: -D / 2 - 2,
          ex: new THREE.Vector3(0, 0, -220),
          type: 'back',
          color: item.piece.color,
          actualDimensions: { length: item.lenMm, width: item.widMm, qty: item.piece.quantity },
        });
      }
    });

    // --- 5. Assemble Doors & Drawers (Puertas / Cajones) ---
    let doorIdx = 0;
    doors.forEach((item) => {
      const isDrawer = item.role === 'drawer';
      const qty = item.piece.quantity;
      for (let q = 0; q < qty; q++) {
        doorIdx++;
        const doorW = item.widMm || (W / Math.max(1, qty) - 6);
        const doorH = item.lenMm || (H / Math.max(1, qty) - 6);

        let doorX = 0;
        let doorY = H / 2;

        if (isDrawer) {
          // Stacked vertically
          const drawerStep = (H * 0.7) / Math.max(1, qty);
          doorY = 80 + q * drawerStep + drawerStep / 2;
        } else if (qty === 2) {
          // Double doors side by side
          doorX = q === 0 ? -W / 4 : W / 4;
        }

        moduleDefs.push({
          id: `${item.piece.id}-door-${q}`,
          name: `${item.piece.name}${qty > 1 ? ` #${q + 1}` : ''}`,
          furnitureGroup: groupName,
          w: doorW,
          h: doorH,
          d: t,
          x: doorX,
          y: doorY,
          z: D / 2 + t / 2,
          ex: new THREE.Vector3(doorX * 0.5, 0, 240 + q * 30),
          type: isDrawer ? 'drawer' : 'door',
          color: item.piece.color,
          actualDimensions: { length: item.lenMm, width: item.widMm, qty: item.piece.quantity },
        });
      }
    });

    // Apply scene X-offset to place modules side-by-side
    const moduleCenterX = currentOffsetX + W / 2;
    moduleDefs.forEach((def) => {
      def.x += moduleCenterX;
    });

    const moduleCenter = new THREE.Vector3(moduleCenterX, H / 2, 0);

    modules.push({
      name: groupName,
      width: W,
      height: H,
      depth: D,
      boardThickness: t,
      interiorWidth,
      piecesCount: groupPieces.reduce((acc, p) => acc + p.quantity, 0),
      defs: moduleDefs,
      center: moduleCenter,
      bounds: {
        height: H / 2,
        dist: Math.max(1400, Math.max(W, H, D) * 1.8),
      },
    });

    allDefs.push(...moduleDefs);
    currentOffsetX += W + moduleSpacing;
  });

  // Calculate overall scene bounding camera distance and center
  const totalSceneWidth = currentOffsetX - moduleSpacing;
  // Center all modules around origin X = 0
  const globalShiftX = -totalSceneWidth / 2;

  allDefs.forEach((d) => {
    d.x += globalShiftX;
  });
  modules.forEach((m) => {
    m.center.x += globalShiftX;
  });

  const maxH = Math.max(...modules.map((m) => m.height), 600);
  const totalBounds = {
    height: maxH / 2,
    dist: Math.max(1600, Math.max(totalSceneWidth, maxH) * 1.4 + 400),
    width: totalSceneWidth,
  };

  return {
    modules,
    allDefs,
    totalBounds,
  };
}
