import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { 
  Box, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Eye,
  Info,
  Layers,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { FurniturePreset, PieceInput, Unit } from '../types';
import { buildFurnitureAssembly, FurnitureModule3D, Piece3DDef } from '../utils/furniture3DAssembler';

interface Furniture3DViewerProps {
  preset: FurniturePreset | null;
  pieces: PieceInput[];
  unit: Unit;
}

interface PieceMeshMeta {
  id: string;
  name: string;
  furnitureGroup: string;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  mesh: THREE.Mesh;
  def: Piece3DDef;
}

export const Furniture3DViewer: React.FC<Furniture3DViewerProps> = ({
  preset,
  pieces,
  unit,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const piecesMetaRef = useRef<PieceMeshMeta[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Interaction & UI State
  const [isExploded, setIsExploded] = useState<boolean>(false);
  const [explosionAmount, setExplosionAmount] = useState<number>(0); // 0 to 1
  const [selectedPieceMeta, setSelectedPieceMeta] = useState<Piece3DDef | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [woodTheme, setWoodTheme] = useState<'oak' | 'walnut' | 'white' | 'pine'>('oak');
  const [activeModuleFilter, setActiveModuleFilter] = useState<'all' | string>('all');

  // References for animation loop (prevents scene re-creation / flickering)
  const autoRotateRef = useRef<boolean>(false);
  autoRotateRef.current = autoRotate;

  const explosionAmountRef = useRef<number>(0);
  explosionAmountRef.current = isExploded ? (explosionAmount > 0 ? explosionAmount : 1) : 0;

  // Mouse drag / rotation controls
  const isDraggingRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0.35, y: -0.6 });
  const targetRotationRef = useRef({ x: 0.35, y: -0.6 });
  const zoomDistRef = useRef(1800);
  const targetZoomRef = useRef(1800);
  const centerTargetRef = useRef(new THREE.Vector3(0, 400, 0));
  const currentCenterRef = useRef(new THREE.Vector3(0, 400, 0));

  // Theme palette definitions
  const themeColors = useMemo(() => {
    switch (woodTheme) {
      case 'walnut':
        return { base: 0x4a2e18, accent: 0x5c3a21, door: 0x3d2413, shelf: 0x6e472b, edge: 0x2b180a };
      case 'white':
        return { base: 0xf8fafc, accent: 0xe2e8f0, door: 0xffffff, shelf: 0xcbd5e1, edge: 0x94a3b8 };
      case 'pine':
        return { base: 0xd4a373, accent: 0xfaedcd, door: 0xe9edc9, shelf: 0xccd5ae, edge: 0xbc6c25 };
      case 'oak':
      default:
        return { base: 0xc89666, accent: 0xdfb182, door: 0xb57c48, shelf: 0xd4a574, edge: 0x8c532b };
    }
  }, [woodTheme]);

  // Determine active piece collection (from active preset or current pieces list)
  const effectivePieces = useMemo(() => {
    if (preset && preset.pieces.length > 0 && pieces.length === 0) {
      return preset.pieces.map((p, idx) => ({
        ...p,
        id: `preset-piece-${idx}`,
        furnitureGroup: preset.name,
      }));
    }
    return pieces;
  }, [preset, pieces]);

  // Parametric Assembly Computation
  const assemblyResult = useMemo(() => {
    const standardThickness = unit === 'cm' ? 18 : unit === 'in' ? 19.05 : 18;
    return buildFurnitureAssembly(effectivePieces, unit, standardThickness);
  }, [effectivePieces, unit]);

  // Active module details
  const activeModule = useMemo(() => {
    if (activeModuleFilter === 'all') return null;
    return assemblyResult.modules.find((m) => m.name === activeModuleFilter) || null;
  }, [assemblyResult, activeModuleFilter]);

  // Update camera target when switching between modules
  useEffect(() => {
    if (activeModule) {
      centerTargetRef.current = activeModule.center.clone();
      targetZoomRef.current = activeModule.bounds.dist;
    } else {
      centerTargetRef.current = new THREE.Vector3(0, assemblyResult.totalBounds.height, 0);
      targetZoomRef.current = assemblyResult.totalBounds.dist;
    }
  }, [activeModule, assemblyResult]);

  // Initial Scene Setup (Mounts Once)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 440;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 15000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfff7ed, 0.9);
    dirLight1.position.set(1500, 2500, 1800);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 100;
    dirLight1.shadow.camera.far = 7000;
    const d = 2500;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    dirLight1.shadow.bias = -0.0005;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xe0f2fe, 0.4);
    dirLight2.position.set(-1500, 1200, -1200);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.4);
    scene.add(hemiLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(5000, 50, 0xd6d3d1, 0xe7e5e4);
    gridHelper.position.y = -1;
    scene.add(gridHelper);

    // Shadow plane
    const planeGeo = new THREE.PlaneGeometry(5000, 5000);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const shadowPlane = new THREE.Mesh(planeGeo, planeMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Group for all pieces
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Raycaster for piece click selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - mousePosRef.current.x;
      const dy = e.clientY - mousePosRef.current.y;

      targetRotationRef.current.y += dx * 0.008;
      targetRotationRef.current.x += dy * 0.008;
      targetRotationRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 2.2, targetRotationRef.current.x));

      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: MouseEvent) => {
      isDraggingRef.current = false;
      const rect = container.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const clickY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      mouse.x = clickX;
      mouse.y = clickY;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(group.children);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const hitMeta = piecesMetaRef.current.find((pm) => pm.mesh === hitMesh);
        if (hitMeta) {
          setSelectedPieceMeta(hitMeta.def);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoomRef.current = Math.max(400, Math.min(8000, targetZoomRef.current + e.deltaY * 1.5));
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    // Animation Render Loop (smooth 60fps)
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (autoRotateRef.current) {
        targetRotationRef.current.y += 0.006;
      }

      // Smooth camera interpolation
      rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * 0.08;
      rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * 0.08;
      zoomDistRef.current += (targetZoomRef.current - zoomDistRef.current) * 0.08;

      currentCenterRef.current.lerp(centerTargetRef.current, 0.08);

      const rx = rotationRef.current.x;
      const ry = rotationRef.current.y;
      const dist = zoomDistRef.current;

      const cx = currentCenterRef.current.x;
      const cy = currentCenterRef.current.y;
      const cz = currentCenterRef.current.z;

      camera.position.x = cx + dist * Math.sin(ry) * Math.cos(rx);
      camera.position.y = cy + dist * Math.sin(rx);
      camera.position.z = cz + dist * Math.cos(ry) * Math.cos(rx);
      camera.lookAt(cx, cy, cz);

      // Smooth Explosion Interpolation
      const curExplosion = explosionAmountRef.current;
      piecesMetaRef.current.forEach((pm) => {
        const targetPos = new THREE.Vector3().copy(pm.originalPos).addScaledVector(pm.explodedOffset, curExplosion);
        pm.mesh.position.lerp(targetPos, 0.1);
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      dom.removeEventListener('wheel', handleWheel);
      renderer.dispose();
    };
  }, []);

  // Update Meshes whenever assembly definition, theme, or active filter changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clear previous piece meshes
    while (group.children.length > 0) {
      const obj = group.children[0] as THREE.Mesh;
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
      group.remove(obj);
    }
    piecesMetaRef.current = [];

    const defsToRender =
      activeModuleFilter === 'all'
        ? assemblyResult.allDefs
        : assemblyResult.allDefs.filter((d) => d.furnitureGroup === activeModuleFilter);

    defsToRender.forEach((pDef) => {
      const geo = new THREE.BoxGeometry(pDef.w, pDef.h, pDef.d);

      let matColor = themeColors.base;
      if (pDef.type === 'lateral') matColor = themeColors.accent;
      else if (pDef.type === 'door' || pDef.type === 'drawer') matColor = themeColors.door;
      else if (pDef.type === 'shelf') matColor = themeColors.shelf;
      else if (pDef.type === 'top') matColor = themeColors.accent;
      else if (pDef.type === 'back') matColor = themeColors.edge;

      const mat = new THREE.MeshStandardMaterial({
        color: matColor,
        roughness: 0.45,
        metalness: 0.05,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pDef.x, pDef.y, pDef.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Add edge outline wireframe for clean architectural contrast
      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({
        color: themeColors.edge,
        linewidth: 1,
        transparent: true,
        opacity: 0.35,
      });
      const edgeLines = new THREE.LineSegments(edges, lineMat);
      mesh.add(edgeLines);

      group.add(mesh);

      piecesMetaRef.current.push({
        id: pDef.id,
        name: pDef.name,
        furnitureGroup: pDef.furnitureGroup,
        originalPos: new THREE.Vector3(pDef.x, pDef.y, pDef.z),
        explodedOffset: pDef.ex.clone(),
        mesh,
        def: pDef,
      });
    });
  }, [assemblyResult, themeColors, activeModuleFilter]);

  const handleZoom = (delta: number) => {
    targetZoomRef.current = Math.max(400, Math.min(8000, targetZoomRef.current + delta));
  };

  const handleResetCamera = () => {
    targetRotationRef.current = { x: 0.35, y: -0.6 };
    if (activeModule) {
      centerTargetRef.current = activeModule.center.clone();
      targetZoomRef.current = activeModule.bounds.dist;
    } else {
      centerTargetRef.current = new THREE.Vector3(0, assemblyResult.totalBounds.height, 0);
      targetZoomRef.current = assemblyResult.totalBounds.dist;
    }
    setAutoRotate(false);
  };

  if (effectivePieces.length === 0) {
    return null;
  }

  return (
    <div id="furniture-3d-viewer-section" className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
      {/* Header Bar */}
      <div className="bg-stone-900 text-stone-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-xs shadow-xs">
            <Box className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                {preset ? preset.name : 'Simulador 3D de Ensamble y Despiece'}
              </h3>
              {assemblyResult.modules.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 bg-stone-800 text-amber-400 rounded-full font-mono font-medium">
                  {assemblyResult.modules.length} {assemblyResult.modules.length === 1 ? 'Mueble' : 'Muebles ensamblados'}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400">
              Vista 3D interactiva en tiempo real construida a partir de tus medidas
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Wood Theme Selector */}
          <div className="flex items-center bg-stone-800 rounded-lg p-0.5 border border-stone-700">
            <button
              onClick={() => setWoodTheme('oak')}
              className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                woodTheme === 'oak' ? 'bg-amber-600 text-white shadow-2xs' : 'text-stone-300 hover:text-white'
              }`}
              title="Roble Natural"
            >
              Roble
            </button>
            <button
              onClick={() => setWoodTheme('walnut')}
              className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                woodTheme === 'walnut' ? 'bg-amber-800 text-white shadow-2xs' : 'text-stone-300 hover:text-white'
              }`}
              title="Nogal Oscuro"
            >
              Nogal
            </button>
            <button
              onClick={() => setWoodTheme('white')}
              className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                woodTheme === 'white' ? 'bg-stone-200 text-stone-900 shadow-2xs' : 'text-stone-300 hover:text-white'
              }`}
              title="Blanco Nórdico"
            >
              Blanco
            </button>
            <button
              onClick={() => setWoodTheme('pine')}
              className={`px-2 py-1 text-[11px] rounded font-medium transition-all ${
                woodTheme === 'pine' ? 'bg-amber-500 text-stone-950 shadow-2xs' : 'text-stone-300 hover:text-white'
              }`}
              title="Pino Claro"
            >
              Pino
            </button>
          </div>

          {/* Explode View Toggle */}
          <button
            onClick={() => {
              setIsExploded(!isExploded);
              setExplosionAmount(isExploded ? 0 : 1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium transition-all shadow-xs ${
              isExploded
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white border border-stone-700'
            }`}
            title="Separar piezas para ver el ensamble interior"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isExploded ? 'Ensamblado' : 'Despiece (Explosión)'}</span>
          </button>

          {/* Auto Rotate */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              autoRotate ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white'
            }`}
            title={autoRotate ? 'Detener rotación' : 'Rotar 360° continuamente'}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => handleZoom(300)}
            className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white text-xs transition-colors"
            title="Alejar cámara"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Zoom In */}
          <button
            onClick={() => handleZoom(-300)}
            className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white text-xs transition-colors"
            title="Acercar cámara"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white text-xs transition-colors"
            title="Centrar vista"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Multi-Furniture Selection Tabs Bar */}
      {assemblyResult.modules.length > 1 && (
        <div className="bg-stone-800/95 px-4 py-2 flex items-center gap-1.5 overflow-x-auto border-t border-stone-700">
          <span className="text-[11px] text-stone-400 mr-1 font-medium">Ver en 3D:</span>
          <button
            onClick={() => setActiveModuleFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              activeModuleFilter === 'all'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-700 text-stone-300 hover:text-white'
            }`}
          >
            🏢 Todos los Muebles ({assemblyResult.modules.length})
          </button>
          {assemblyResult.modules.map((m) => (
            <button
              key={m.name}
              onClick={() => setActiveModuleFilter(m.name)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeModuleFilter === m.name
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'bg-stone-700 text-stone-300 hover:text-white'
              }`}
            >
              <span>{m.name}</span>
              <span className="text-[10px] opacity-75 font-mono">({m.piecesCount} pzs)</span>
            </button>
          ))}
        </div>
      )}

      {/* 3D Canvas Stage */}
      <div className="relative w-full h-[460px] bg-linear-to-b from-stone-50 to-stone-100 cursor-grab active:cursor-grabbing select-none overflow-hidden">
        <div ref={mountRef} className="w-full h-full" />

        {/* Floating Controls Overlay: Explosion Slider when exploded is active */}
        {isExploded && (
          <div className="absolute top-3 left-3 bg-stone-900/85 backdrop-blur-xs text-white px-3 py-2 rounded-xl shadow-lg border border-stone-700/60 flex items-center gap-2.5 z-10">
            <span className="text-xs font-medium text-stone-300">Explosión:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={explosionAmount}
              onChange={(e) => setExplosionAmount(parseFloat(e.target.value))}
              className="w-28 accent-amber-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-amber-400 w-8 text-right">
              {Math.round(explosionAmount * 100)}%
            </span>
          </div>
        )}

        {/* Floating Inspector Panel for Selected Piece */}
        {selectedPieceMeta && (
          <div className="absolute bottom-3 left-3 bg-stone-900/90 backdrop-blur-xs text-white p-3 rounded-xl shadow-xl border border-stone-700 max-w-xs z-10 animate-fade-in">
            <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-white">{selectedPieceMeta.name}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 bg-stone-800 text-stone-300 rounded font-mono">
                {selectedPieceMeta.furnitureGroup}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-stone-800/80 p-1.5 rounded">
                <div className="text-[10px] text-stone-400">Largo</div>
                <div className="font-mono font-bold text-amber-300">
                  {unit === 'cm'
                    ? (selectedPieceMeta.w / 10).toFixed(1)
                    : unit === 'in'
                    ? (selectedPieceMeta.w / 25.4).toFixed(1)
                    : Math.round(selectedPieceMeta.w)}{' '}
                  {unit}
                </div>
              </div>
              <div className="bg-stone-800/80 p-1.5 rounded">
                <div className="text-[10px] text-stone-400">Ancho</div>
                <div className="font-mono font-bold text-amber-300">
                  {unit === 'cm'
                    ? (selectedPieceMeta.d / 10).toFixed(1)
                    : unit === 'in'
                    ? (selectedPieceMeta.d / 25.4).toFixed(1)
                    : Math.round(selectedPieceMeta.d)}{' '}
                  {unit}
                </div>
              </div>
              <div className="bg-stone-800/80 p-1.5 rounded">
                <div className="text-[10px] text-stone-400">Espesor</div>
                <div className="font-mono font-bold text-stone-200">
                  {unit === 'cm'
                    ? (selectedPieceMeta.h / 10).toFixed(1)
                    : unit === 'in'
                    ? (selectedPieceMeta.h / 25.4).toFixed(2)
                    : Math.round(selectedPieceMeta.h)}{' '}
                  {unit}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions Hint */}
        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs text-stone-600 px-3 py-1.5 rounded-lg border border-stone-200/80 text-[11px] shadow-xs flex items-center gap-1.5 pointer-events-none">
          <Eye className="w-3.5 h-3.5 text-stone-400" />
          <span>Arrastra para rotar • Rueda para zoom • Clic en pieza para inspeccionar</span>
        </div>
      </div>

      {/* Assembly Specs Footnote */}
      <div className="bg-stone-50 border-t border-stone-200 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-stone-700 gap-3">
        <div className="flex items-center gap-3">
          {activeModule ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-stone-900">
                {activeModule.name}:
              </span>
              <span className="font-mono text-stone-600">
                {unit === 'cm' ? (activeModule.width / 10).toFixed(0) : activeModule.width} ×{' '}
                {unit === 'cm' ? (activeModule.height / 10).toFixed(0) : activeModule.height} ×{' '}
                {unit === 'cm' ? (activeModule.depth / 10).toFixed(0) : activeModule.depth} {unit}
              </span>
              <span className="text-stone-400">•</span>
              <span className="text-stone-600 text-[11px]">
                Hueco libre entre laterales: <strong className="font-mono text-amber-800">{unit === 'cm' ? (activeModule.interiorWidth / 10).toFixed(1) : activeModule.interiorWidth} {unit}</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-stone-900">
                Proyecto Global ({assemblyResult.modules.length} muebles):
              </span>
              <span className="text-stone-600">
                {assemblyResult.allDefs.length} piezas ensambladas paramétricamente
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Auto-ensamblaje con descuento automático de espesores</span>
        </div>
      </div>
    </div>
  );
};
