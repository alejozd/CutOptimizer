import { describe, expect, it } from 'vitest';
import { optimizeCuts } from './optimizer';
import { AlgorithmType, CutLine, PieceInput, SheetConfig, SheetLayout } from '../types';

const noBanding = { top: false, bottom: false, left: false, right: false };

function piece(id: string, length: number, width: number, quantity = 1, allowRotation = false): PieceInput {
  return { id, name: id, length, width, quantity, allowRotation, color: '#000', edgeBanding: noBanding };
}

function sheet(overrides: Partial<SheetConfig> = {}): SheetConfig {
  return {
    name: 'test',
    length: 2440,
    width: 1220,
    kerf: 4,
    trimMargin: 0,
    grainDirection: 'none',
    unit: 'mm',
    ...overrides,
  };
}

const EPS = 1e-6;

/**
 * An endpoint of a cut is physically reachable only if it lies on the usable-area
 * boundary, or on the far side of the kerf of a perpendicular cut made in an earlier stage.
 */
function findBlockingEndpoint(cut: CutLine, layout: SheetLayout): string | null {
  const { trimMargin, kerf, length, width } = layout.sheetConfig;
  const minX = trimMargin;
  const minY = trimMargin;
  const maxX = length - trimMargin;
  const maxY = width - trimMargin;

  const endpoints =
    cut.orientation === 'vertical'
      ? [cut.y1, cut.y2].map((y) => ({ along: y, onBoundary: y <= minY + EPS || y >= maxY - EPS }))
      : [cut.x1, cut.x2].map((x) => ({ along: x, onBoundary: x <= minX + EPS || x >= maxX - EPS }));

  for (const ep of endpoints) {
    if (ep.onBoundary) continue;

    const hasParent = layout.cutLines.some((p) => {
      if (p.orientation === cut.orientation || p.stage >= cut.stage) return false;
      // Parent position must be within one kerf of this endpoint
      if (ep.along < p.position - EPS || ep.along > p.position + kerf + EPS) return false;
      // And the parent must span across the cut's line
      if (cut.orientation === 'vertical') {
        return cut.x1 >= Math.min(p.x1, p.x2) - EPS && cut.x1 <= Math.max(p.x1, p.x2) + EPS;
      }
      return cut.y1 >= Math.min(p.y1, p.y2) - EPS && cut.y1 <= Math.max(p.y1, p.y2) + EPS;
    });

    if (!hasParent) {
      return `${cut.orientation} cut at ${cut.position} (stage ${cut.stage}) has unsupported endpoint at ${ep.along}`;
    }
  }
  return null;
}

function blockingCuts(layout: SheetLayout): string[] {
  return layout.cutLines.map((c) => findBlockingEndpoint(c, layout)).filter((m): m is string => m !== null);
}

describe('optimizeCuts — grain and rotation', () => {
  // 1000×2000 only fits a 2440×1220 sheet when rotated 90°
  const tallPiece = (allowRotation: boolean) => piece('door', 1000, 2000, 1, allowRotation);

  it('rotates a piece that allows rotation even when the sheet has grain', () => {
    const result = optimizeCuts([tallPiece(true)], sheet({ grainDirection: 'horizontal' }));

    expect(result.unplacedPieces).toEqual([]);
    expect(result.sheets[0].placedPieces[0].rotated).toBe(true);
  });

  it('keeps a locked piece unrotated when the sheet grain runs along its length', () => {
    const result = optimizeCuts([tallPiece(false)], sheet({ grainDirection: 'horizontal' }));

    expect(result.totalPiecesPlaced).toBe(0);
    expect(result.unplacedPieces[0].remainingQty).toBe(1);
  });

  it('rotates a locked piece so its length follows a grain that runs across the sheet', () => {
    const result = optimizeCuts([piece('side', 600, 300, 1, false)], sheet({ grainDirection: 'vertical' }));
    const placed = result.sheets[0].placedPieces[0];

    expect(placed.rotated).toBe(true);
    expect(placed.width).toBe(300);
    expect(placed.height).toBe(600);
  });

  it('never rotates a locked piece on a sheet without grain', () => {
    const result = optimizeCuts([tallPiece(false)], sheet({ grainDirection: 'none' }));

    expect(result.totalPiecesPlaced).toBe(0);
  });
});

describe('optimizeCuts — usable offcut classification', () => {
  const MM_PER: Record<SheetConfig['unit'], number> = { mm: 1, cm: 10, in: 25.4 };

  function offcutsFor(unit: SheetConfig['unit']) {
    const f = MM_PER[unit];
    // Same physical layout in every unit: 2440×1220 mm sheet, one 2000×800 mm piece
    const result = optimizeCuts(
      [piece('a', 2000 / f, 800 / f)],
      sheet({ length: 2440 / f, width: 1220 / f, kerf: 4 / f, unit }),
      'guillotine_vertical'
    );
    return result.sheets[0].wasteAreas
      .map((w) => ({ w: Math.round(w.width * f), h: Math.round(w.height * f), usable: w.isUsableOffcut }))
      .sort((a, b) => a.w - b.w || a.h - b.h);
  }

  it('marks large offcuts as usable when working in centimetres', () => {
    // 200×41.6 cm and 43.6×122 cm are clearly reusable boards
    expect(offcutsFor('cm').every((o) => o.usable)).toBe(true);
  });

  it('classifies the same physical offcuts identically in mm, cm and inches', () => {
    const mm = offcutsFor('mm');
    expect(offcutsFor('cm')).toEqual(mm);
    expect(offcutsFor('in')).toEqual(mm);
  });

  it('does not treat a long, very thin strip as a usable offcut', () => {
    // Leaves a 16 mm × 2440 mm strip: large area, but too narrow to reuse
    const result = optimizeCuts([piece('a', 2440, 1200)], sheet(), 'guillotine_horizontal');
    const strip = result.sheets[0].wasteAreas.find((w) => Math.round(w.height) === 16);

    expect(strip).toBeDefined();
    expect(strip!.isUsableOffcut).toBe(false);
  });
});

describe('optimizeCuts — cut sequence', () => {
  it('gives a nested cut a later stage than the cut that frees its sub-panel', () => {
    // Piece "c" lands under piece "a"; its vertical cut needs the horizontal cut under "a" first.
    const result = optimizeCuts([piece('a', 600, 1000), piece('c', 500, 200)], sheet(), 'guillotine_vertical');
    const layout = result.sheets[0];

    const cutUnderA = layout.cutLines.find((c) => c.orientation === 'horizontal' && c.position === 1000)!;
    const cutBesideC = layout.cutLines.find((c) => c.orientation === 'vertical' && c.position === 500)!;

    expect(cutUnderA).toBeDefined();
    expect(cutBesideC).toBeDefined();
    expect(cutBesideC.stage).toBeGreaterThan(cutUnderA.stage);
  });

  it('returns cuts ordered by stage so they can be executed top to bottom', () => {
    const result = optimizeCuts(
      [piece('a', 600, 1000), piece('b', 400, 300, 3), piece('c', 500, 200, 2)],
      sheet(),
      'auto_best'
    );
    for (const layout of result.sheets) {
      const stages = layout.cutLines.map((c) => c.stage);
      expect(stages).toEqual([...stages].sort((x, y) => x - y));
    }
  });

  const algorithms: AlgorithmType[] = [
    'auto_best',
    'guillotine_horizontal',
    'guillotine_vertical',
    'maxrects_bssf',
    'maxrects_blsf',
  ];

  const scenarios: { name: string; pieces: PieceInput[]; config: SheetConfig }[] = [
    {
      name: 'kitchen cabinet mix',
      pieces: [
        piece('side', 720, 560, 2, true),
        piece('base', 764, 560, 1, true),
        piece('shelf', 764, 540, 2, true),
        piece('door', 716, 396, 2, true),
        piece('strip', 764, 100, 2, true),
      ],
      config: sheet({ trimMargin: 10 }),
    },
    {
      name: 'many small parts, no rotation',
      pieces: [piece('p1', 300, 200, 12), piece('p2', 450, 150, 8), piece('p3', 900, 350, 3)],
      config: sheet({ kerf: 3.2 }),
    },
  ];

  for (const algorithm of algorithms) {
    for (const scenario of scenarios) {
      it(`every cut is reachable from earlier stages (${algorithm}, ${scenario.name})`, () => {
        const result = optimizeCuts(scenario.pieces, scenario.config, algorithm);
        expect(result.sheets.length).toBeGreaterThan(0);
        for (const layout of result.sheets) {
          expect(blockingCuts(layout)).toEqual([]);
        }
      });
    }
  }
});
