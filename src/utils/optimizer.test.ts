import { describe, expect, it } from 'vitest';
import { MM_PER_UNIT, optimizeCuts } from './optimizer';
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

describe('optimizeCuts — trim cuts', () => {
  const lengthOf = (c: CutLine) => Math.abs(c.x2 - c.x1) + Math.abs(c.y2 - c.y1);

  it('starts the sequence with the long-edge trims, then the short-edge trims', () => {
    const result = optimizeCuts([piece('a', 600, 400)], sheet({ trimMargin: 10 }), 'guillotine_vertical');
    const trims = result.sheets[0].cutLines.filter((c) => c.isTrim);

    expect(trims).toHaveLength(4);
    expect(trims.filter((c) => c.stage === 1)).toEqual([
      expect.objectContaining({ orientation: 'horizontal', position: 10, x1: 0, x2: 2440 }),
      expect.objectContaining({ orientation: 'horizontal', position: 1210, x1: 0, x2: 2440 }),
    ]);
    expect(trims.filter((c) => c.stage === 2)).toEqual([
      expect.objectContaining({ orientation: 'vertical', position: 10, y1: 10, y2: 1210 }),
      expect.objectContaining({ orientation: 'vertical', position: 2430, y1: 10, y2: 1210 }),
    ]);
  });

  it('runs every interior cut after the trims', () => {
    const result = optimizeCuts(
      [piece('a', 600, 400, 3, true), piece('b', 300, 200, 4, true)],
      sheet({ trimMargin: 10 })
    );
    for (const layout of result.sheets) {
      const interior = layout.cutLines.filter((c) => !c.isTrim);
      expect(interior.length).toBeGreaterThan(0);
      expect(interior.every((c) => c.stage >= 3)).toBe(true);
    }
  });

  it('counts each cut once in the total cut length', () => {
    const result = optimizeCuts([piece('a', 600, 400)], sheet({ trimMargin: 10 }));
    const layout = result.sheets[0];

    expect(layout.cutsLength).toBeCloseTo(layout.cutLines.reduce((sum, c) => sum + lengthOf(c), 0));
  });

  it('adds no trim cuts when there is no trim margin', () => {
    const result = optimizeCuts([piece('a', 600, 400)], sheet({ trimMargin: 0 }));

    expect(result.sheets[0].cutLines.some((c) => c.isTrim)).toBe(false);
    expect(Math.min(...result.sheets[0].cutLines.map((c) => c.stage))).toBe(1);
  });
});

describe('optimizeCuts — edge banding thickness', () => {
  const banded = (edges: Partial<PieceInput['edgeBanding']>, length = 600, width = 400): PieceInput => ({
    ...piece('p', length, width),
    edgeBanding: { ...noBanding, ...edges },
  });

  it('cuts each banded side short by the banding thickness so the finished piece keeps its size', () => {
    const result = optimizeCuts(
      [banded({ top: true, bottom: true, left: true, right: true })],
      sheet({ edgeBandingThickness: 2 })
    );
    const placed = result.sheets[0].placedPieces[0];

    expect(placed.width).toBe(596);
    expect(placed.height).toBe(396);
  });

  it('only shortens the dimension across a banded edge', () => {
    // L1 (top) runs along the length, so it eats into the width only
    const result = optimizeCuts([banded({ top: true })], sheet({ edgeBandingThickness: 2 }));
    const placed = result.sheets[0].placedPieces[0];

    expect(placed.width).toBe(600);
    expect(placed.height).toBe(398);
  });

  it('keeps finished sizes for edge banding length and piece reference', () => {
    const result = optimizeCuts([banded({ top: true, left: true })], sheet({ edgeBandingThickness: 2 }));
    const placed = result.sheets[0].placedPieces[0];

    expect(placed.originalLength).toBe(600);
    expect(placed.originalWidth).toBe(400);
    expect(result.totalEdgeBandingLength).toBe(1000);
  });

  it('places a piece that only fits once the banding is discounted', () => {
    // Finished 2444 mm long with 2 mm banding on both ends: cut length is exactly 2440
    const result = optimizeCuts([banded({ left: true, right: true }, 2444, 1000)], sheet({ edgeBandingThickness: 2 }));

    expect(result.unplacedPieces).toEqual([]);
    expect(result.sheets[0].placedPieces[0].width).toBe(2440);
  });

  it('refuses to place a piece whose banding leaves no material to cut', () => {
    // 3 mm finished width with 2 mm banding on both long edges: cut width would be −1 mm
    const result = optimizeCuts(
      [banded({ top: true, bottom: true }, 600, 3), { ...banded({}, 500, 300), id: 'ok' }],
      sheet({ edgeBandingThickness: 2 })
    );

    expect(result.totalPiecesPlaced).toBe(1);
    expect(result.sheets.flatMap((s) => s.placedPieces).every((p) => p.width > 0 && p.height > 0)).toBe(true);
    expect(result.unplacedPieces).toEqual([expect.objectContaining({ remainingQty: 1, reason: 'invalid_size' })]);
  });

  it('leaves sizes unchanged when no thickness is configured', () => {
    const result = optimizeCuts([banded({ top: true, bottom: true, left: true, right: true })], sheet());
    const placed = result.sheets[0].placedPieces[0];

    expect([placed.width, placed.height]).toEqual([600, 400]);
  });
});

describe('optimizeCuts — unplaced pieces', () => {
  it('reports a piece larger than the sheet as too large', () => {
    const result = optimizeCuts([piece('giant', 3000, 500, 1, true)], sheet());

    expect(result.unplacedPieces).toEqual([
      expect.objectContaining({ remainingQty: 1, reason: 'too_large' }),
    ]);
  });

  it('reports a locked piece that only fits rotated as too large', () => {
    const result = optimizeCuts([piece('door', 1000, 2000, 1, false)], sheet({ grainDirection: 'horizontal' }));

    expect(result.unplacedPieces[0].reason).toBe('too_large');
  });

  it('reports pieces left over by the sheet limit separately from oversized ones', () => {
    // Each piece needs its own sheet; the optimizer stops at 50 sheets
    const result = optimizeCuts([piece('top', 2440, 1220, 55), piece('giant', 3000, 500, 1)], sheet());

    expect(result.totalSheetsNeeded).toBe(50);
    expect(result.unplacedPieces).toEqual([
      expect.objectContaining({ piece: expect.objectContaining({ id: 'top' }), remainingQty: 5, reason: 'sheet_limit' }),
      expect.objectContaining({ piece: expect.objectContaining({ id: 'giant' }), remainingQty: 1, reason: 'too_large' }),
    ]);
  });
});

describe('optimizeCuts — determinism', () => {
  it('returns identical layouts for identical input', () => {
    const pieces = [piece('a', 600, 400, 3, true), piece('b', 300, 200, 5, true)];
    const strip = ({ calculationTimeMs, ...rest }: ReturnType<typeof optimizeCuts>) => rest;

    expect(strip(optimizeCuts(pieces, sheet()))).toEqual(strip(optimizeCuts(pieces, sheet())));
  });
});

describe('optimizeCuts — choosing the best variant', () => {
  const usableOffcutArea = (sheets: SheetLayout[]) =>
    sheets.flatMap((s) => s.wasteAreas).reduce((sum, w) => (w.isUsableOffcut ? sum + w.width * w.height : sum), 0);

  const jobs: { name: string; pieces: PieceInput[] }[] = [
    {
      name: 'wardrobe',
      pieces: [
        piece('side', 2000, 580, 2, true),
        piece('shelf', 864, 560, 4, true),
        piece('door', 1990, 445, 2, false),
        piece('plinth', 864, 100, 2, true),
      ],
    },
    {
      name: 'drawers',
      pieces: [piece('front', 596, 180, 6, true), piece('side', 500, 150, 12, true), piece('bottom', 520, 480, 3, true)],
    },
    {
      name: 'bookcase',
      pieces: [piece('side', 1800, 300, 2, true), piece('shelf', 764, 280, 6, true), piece('back', 800, 600, 1, true)],
    },
  ];

  const explicitAlgorithms: AlgorithmType[] = [
    'guillotine_horizontal',
    'guillotine_vertical',
    'maxrects_bssf',
    'maxrects_blsf',
  ];

  for (const job of jobs) {
    it(`auto_best keeps at least as much usable offcut as any single algorithm with the same sheets (${job.name})`, () => {
      const best = optimizeCuts(job.pieces, sheet());

      for (const algorithm of explicitAlgorithms) {
        const other = optimizeCuts(job.pieces, sheet(), algorithm);
        if (other.totalPiecesPlaced !== best.totalPiecesPlaced || other.totalSheetsNeeded !== best.totalSheetsNeeded) {
          continue;
        }
        expect(usableOffcutArea(best.sheets), algorithm).toBeGreaterThanOrEqual(usableOffcutArea(other.sheets));
      }
    });
  }
});

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
  function offcutsFor(unit: SheetConfig['unit']) {
    const f = MM_PER_UNIT[unit];
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

  it('still records the sizing cut when the leftover is no wider than the kerf', () => {
    // 2440 − 2436 = 4 mm leftover, exactly one kerf: no offcut, but the piece must still be cut to size
    const result = optimizeCuts([piece('a', 2436, 1220)], sheet(), 'guillotine_vertical');
    const cuts = result.sheets[0].cutLines;

    expect(cuts).toHaveLength(1);
    expect(cuts[0]).toMatchObject({ orientation: 'vertical', position: 2436 });
    expect(result.sheets[0].wasteAreas).toEqual([]);
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
