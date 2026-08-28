import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { 
  Box, 
  Layers, 
  RotateCcw, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  Eye,
  Info,
  Maximize2
} from 'lucide-react';
import { FurniturePreset, PieceInput, Unit } from '../types';

interface Furniture3DViewerProps {
  preset: FurniturePreset | null;
  pieces: PieceInput[];
  unit: Unit;
}

interface PieceMeshMeta {
  name: string;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  dimensions: { w: number; h: number; d: number };
  mesh: THREE.Mesh;
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
  const [explosionAmount, setExplosionAmount] = useState<number>(0);
  const [selectedPieceName, setSelectedPieceName] = useState<string | null>(null);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [woodTheme, setWoodTheme] = useState<'oak' | 'walnut' | 'white' | 'pine'>('oak');

  // Mouse drag / rotation controls
  const isDraggingRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0.35, y: -0.6 });
  const targetRotationRef = useRef({ x: 0.35, y: -0.6 });
  const zoomDistRef = useRef(1600);
  const targetZoomRef = useRef(1600);

  // Palette color definitions
  const themeColors = useMemo(() => {
    switch (woodTheme) {
      case 'walnut':
        return { base: 0x4a2e18, accent: 0x5c3a21, door: 0x3d2413, shelf: 0x6e472b, edge: 0x2b180a };
      case 'white':
        return { base: 0xf3f4f6, accent: 0xe5e7eb, door: 0xffffff, shelf: 0xd1d5db, edge: 0x9ca3af };
      case 'pine':
        return { base: 0xd4a373, accent: 0xfaedcd, door: 0xe9edc9, shelf: 0xccd5ae, edge: 0xbc6c25 };
      case 'oak':
      default:
        return { base: 0xc89666, accent: 0xdfb182, door: 0xb57c48, shelf: 0xd4a574, edge: 0x8c532b };
    }
  }, [woodTheme]);

  // Generate 3D piece layout depending on selected furniture preset or generic pieces
  const pieceDefinitions = useMemo(() => {
    const t = 18; // Standard 18mm board thickness
    const pId = preset?.id || 'kitchen_cabinet';

    if (pId === 'kitchen_cabinet') {
      const W = 600;
      const H = 700;
      const D = 300;
      const inW = W - 2 * t;

      return [
        { name: 'Lateral Izquierdo', w: t, h: H, d: D, x: -W / 2 + t / 2, y: H / 2, z: 0, ex: new THREE.Vector3(-180, 0, 0), type: 'lateral' },
        { name: 'Lateral Derecho', w: t, h: H, d: D, x: W / 2 - t / 2, y: H / 2, z: 0, ex: new THREE.Vector3(180, 0, 0), type: 'lateral' },
        { name: 'Base / Piso', w: inW, h: t, d: D, x: 0, y: t / 2, z: 0, ex: new THREE.Vector3(0, -120, 0), type: 'horizontal' },
        { name: 'Techo', w: inW, h: t, d: D, x: 0, y: H - t / 2, z: 0, ex: new THREE.Vector3(0, 120, 0), type: 'horizontal' },
        { name: 'Repisa Intermedia', w: inW, h: t, d: D - 15, x: 0, y: H / 2, z: -7.5, ex: new THREE.Vector3(0, 0, 150), type: 'shelf' },
        { name: 'Puerta Izquierda', w: inW / 2 - 2, h: H - 4, d: t, x: -inW / 4, y: H / 2, z: D / 2 + t / 2, ex: new THREE.Vector3(-80, 0, 200), type: 'door' },
        { name: 'Puerta Derecha', w: inW / 2 - 2, h: H - 4, d: t, x: inW / 4, y: H / 2, z: D / 2 + t / 2, ex: new THREE.Vector3(80, 0, 200), type: 'door' },
        { name: 'Fondo (MDF 3mm)', w: W - 10, h: H - 10, d: 4, x: 0, y: H / 2, z: -D / 2 - 2, ex: new THREE.Vector3(0, 0, -160), type: 'back' },
      ];
    }

    if (pId === 'shelf_unit') {
      const W = 800;
      const H = 1800;
      const D = 300;
      const inW = W - 2 * t;

      return [
        { name: 'Lateral Izquierdo', w: t, h: H, d: D, x: -W / 2 + t / 2, y: H / 2, z: 0, ex: new THREE.Vector3(-200, 0, 0), type: 'lateral' },
        { name: 'Lateral Derecho', w: t, h: H, d: D, x: W / 2 - t / 2, y: H / 2, z: 0, ex: new THREE.Vector3(200, 0, 0), type: 'lateral' },
        { name: 'Base Inferior', w: inW, h: t, d: D, x: 0, y: 70 + t / 2, z: 0, ex: new THREE.Vector3(0, -100, 0), type: 'horizontal' },
        { name: 'Zócalo Frontal', w: inW, h: 70, d: t, x: 0, y: 35, z: D / 2 - 20, ex: new THREE.Vector3(0, -120, 100), type: 'lateral' },
        { name: 'Techo Superior', w: inW, h: t, d: D, x: 0, y: H - t / 2, z: 0, ex: new THREE.Vector3(0, 160, 0), type: 'horizontal' },
        { name: 'Repisa Fija 1', w: inW, h: t, d: D, x: 0, y: H * 0.28, z: 0, ex: new THREE.Vector3(0, 0, 120), type: 'shelf' },
        { name: 'Repisa Fija 2', w: inW, h: t, d: D, x: 0, y: H * 0.52, z: 0, ex: new THREE.Vector3(0, 0, 150), type: 'shelf' },
        { name: 'Repisa Fija 3', w: inW, h: t, d: D, x: 0, y: H * 0.76, z: 0, ex: new THREE.Vector3(0, 0, 180), type: 'shelf' },
        { name: 'Fondo Trasero', w: W - 10, h: H - 10, d: 4, x: 0, y: H / 2, z: -D / 2 - 2, ex: new THREE.Vector3(0, 0, -180), type: 'back' },
      ];
    }

    if (pId === 'tv_stand') {
      const W = 1500;
      const H = 500;
      const D = 400;
      const inW = W - 2 * t;

      return [
        { name: 'Cubierta Superior', w: W, h: t, d: D, x: 0, y: H - t / 2, z: 0, ex: new THREE.Vector3(0, 150, 0), type: 'horizontal' },
        { name: 'Base Inferior', w: inW, h: t, d: D, x: 0, y: 60 + t / 2, z: 0, ex: new THREE.Vector3(0, -100, 0), type: 'horizontal' },
        { name: 'Lateral Izquierdo', w: t, h: H - t - 60, d: D, x: -W / 2 + t / 2, y: (H - t + 60) / 2, z: 0, ex: new THREE.Vector3(-180, 0, 0), type: 'lateral' },
        { name: 'Lateral Derecho', w: t, h: H - t - 60, d: D, x: W / 2 - t / 2, y: (H - t + 60) / 2, z: 0, ex: new THREE.Vector3(180, 0, 0), type: 'lateral' },
        { name: 'Divisor Central', w: t, h: H - t - 60, d: D - 20, x: 0, y: (H - t + 60) / 2, z: -10, ex: new THREE.Vector3(0, 0, 120), type: 'lateral' },
        { name: 'Repisa Derecha', w: inW / 2 - t / 2, h: t, d: D - 20, x: inW / 4, y: (H - t + 60) / 2, z: -10, ex: new THREE.Vector3(100, 0, 100), type: 'shelf' },
        { name: 'Puerta Izquierda', w: inW / 2 - 4, h: H - t - 64, d: t, x: -inW / 4, y: (H - t + 60) / 2, z: D / 2 + t / 2, ex: new THREE.Vector3(-100, 0, 160), type: 'door' },
        { name: 'Fondo', w: W - 10, h: H - 70, d: 4, x: 0, y: (H + 60) / 2, z: -D / 2 - 2, ex: new THREE.Vector3(0, 0, -150), type: 'back' },
      ];
    }

    // Default: desk preset or generic pieces
    const W = 1200;
    const H = 750;
    const D = 600;

    return [
      { name: 'Cubierta de Escritorio', w: W, h: 25, d: D, x: 0, y: H - 12.5, z: 0, ex: new THREE.Vector3(0, 160, 0), type: 'horizontal' },
      { name: 'Lateral Izquierdo', w: t, h: H - 25, d: D - 30, x: -W / 2 + 20, y: (H - 25) / 2, z: 0, ex: new THREE.Vector3(-160, 0, 0), type: 'lateral' },
      { name: 'Lateral Cajonera Ext.', w: t, h: H - 25, d: D - 30, x: W / 2 - 20, y: (H - 25) / 2, z: 0, ex: new THREE.Vector3(160, 0, 0), type: 'lateral' },
      { name: 'Lateral Cajonera Int.', w: t, h: H - 25, d: D - 30, x: W / 2 - 380, y: (H - 25) / 2, z: 0, ex: new THREE.Vector3(80, 0, 0), type: 'lateral' },
      { name: 'Faldón / Trasera', w: W - 420, h: 300, d: t, x: -180, y: H - 175, z: -D / 2 + 30, ex: new THREE.Vector3(0, 0, -150), type: 'back' },
      { name: 'Piso Cajonera', w: 342, h: t, d: D - 30, x: W / 2 - 200, y: 50, z: 0, ex: new THREE.Vector3(100, -80, 0), type: 'shelf' },
      { name: 'Frente Cajón 1', w: 338, h: 180, d: t, x: W / 2 - 200, y: H - 130, z: D / 2 - 10, ex: new THREE.Vector3(100, 0, 160), type: 'door' },
      { name: 'Frente Cajón 2', w: 338, h: 180, d: t, x: W / 2 - 200, y: H - 320, z: D / 2 - 10, ex: new THREE.Vector3(100, 0, 180), type: 'door' },
    ];
  }, [preset]);

  // Setup Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 420;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 8000);
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

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfffaed, 0.9);
    dirLight1.position.set(1200, 1800, 1400);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.4);
    dirLight2.position.set(-1200, 1000, -1000);
    scene.add(dirLight2);

    // Subtle Ground Grid
    const grid = new THREE.GridHelper(2400, 24, 0xd1d5db, 0xe5e7eb);
    grid.position.y = 0;
    scene.add(grid);

    // Ground Shadow Plane
    const planeGeo = new THREE.PlaneGeometry(3000, 3000);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1;
    plane.receiveShadow = true;
    scene.add(plane);

    // Group for furniture pieces
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      // Smooth camera interpolation
      rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * 0.1;
      rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * 0.1;
      zoomDistRef.current += (targetZoomRef.current - zoomDistRef.current) * 0.1;

      if (autoRotate) {
        targetRotationRef.current.y += 0.005;
      }

      const rotX = rotationRef.current.x;
      const rotY = rotationRef.current.y;
      const dist = zoomDistRef.current;

      camera.position.x = dist * Math.cos(rotX) * Math.sin(rotY);
      camera.position.y = dist * Math.sin(rotX) + 350;
      camera.position.z = dist * Math.cos(rotX) * Math.cos(rotY);
      camera.lookAt(0, 350, 0);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
    };
  }, [autoRotate]);

  // Update piece meshes when definitions or material theme changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clear old meshes
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
    piecesMetaRef.current = [];

    pieceDefinitions.forEach((def) => {
      const geo = new THREE.BoxGeometry(def.w, def.h, def.d);
      
      let baseHex = themeColors.base;
      if (def.type === 'door') baseHex = themeColors.door;
      else if (def.type === 'shelf') baseHex = themeColors.shelf;
      else if (def.type === 'horizontal') baseHex = themeColors.accent;
      else if (def.type === 'back') baseHex = 0xf5f0eb;

      const isSelected = selectedPieceName === def.name;

      const mat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xef4444 : baseHex,
        roughness: 0.55,
        metalness: 0.05,
        wireframe: showWireframe,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(def.x, def.y, def.z);

      // Add subtle edge outlines
      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: isSelected ? 0xb91c1c : themeColors.edge, linewidth: 1 });
      const line = new THREE.LineSegments(edges, lineMat);
      mesh.add(line);

      group.add(mesh);

      piecesMetaRef.current.push({
        name: def.name,
        originalPos: new THREE.Vector3(def.x, def.y, def.z),
        explodedOffset: def.ex,
        dimensions: { w: def.w, h: def.h, d: def.d },
        mesh,
      });
    });
  }, [pieceDefinitions, themeColors, showWireframe, selectedPieceName]);

  // Smoothly update exploded positions
  useEffect(() => {
    const factor = isExploded ? 1 : explosionAmount;
    piecesMetaRef.current.forEach((item) => {
      const targetX = item.originalPos.x + item.explodedOffset.x * factor;
      const targetY = item.originalPos.y + item.explodedOffset.y * factor;
      const targetZ = item.originalPos.z + item.explodedOffset.z * factor;

      item.mesh.position.set(targetX, targetY, targetZ);
    });
  }, [isExploded, explosionAmount]);

  // Mouse / Touch Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    mousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - mousePosRef.current.x;
    const deltaY = e.clientY - mousePosRef.current.y;

    targetRotationRef.current.y += deltaX * 0.008;
    targetRotationRef.current.x = Math.max(
      0.05,
      Math.min(Math.PI / 2 - 0.05, targetRotationRef.current.x + deltaY * 0.008)
    );

    mousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    targetZoomRef.current = Math.max(600, Math.min(3000, targetZoomRef.current + e.deltaY * 1.2));
  };

  const resetCamera = () => {
    targetRotationRef.current = { x: 0.35, y: -0.6 };
    targetZoomRef.current = 1600;
  };

  return (
    <div id="furniture-3d-viewer-section" className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
      {/* Header Bar */}
      <div className="bg-stone-50/80 px-4 py-3 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>Vista 3D del Mueble Armado</span>
              <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-sans normal-case">
                Interactivo
              </span>
            </h3>
            <p className="text-[11px] text-stone-500">
              {preset ? preset.name : 'Modelo 3D con despiece interactivo'}
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5">
          {/* Wood Finishes */}
          <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            <button
              onClick={() => setWoodTheme('oak')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                woodTheme === 'oak' ? 'bg-amber-600 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Roble Natural"
            >
              Roble
            </button>
            <button
              onClick={() => setWoodTheme('walnut')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                woodTheme === 'walnut' ? 'bg-stone-800 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Nogal Oscuro"
            >
              Nogal
            </button>
            <button
              onClick={() => setWoodTheme('white')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                woodTheme === 'white' ? 'bg-stone-300 text-stone-900 shadow-2xs font-bold' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Melamina Blanca"
            >
              Blanco
            </button>
          </div>

          {/* Explode View Toggle */}
          <button
            onClick={() => setIsExploded(!isExploded)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              isExploded
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
            }`}
            title="Separar piezas para ver el ensamblaje"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isExploded ? 'Ensamblado' : 'Despiece (Explosión)'}</span>
          </button>

          {/* Auto rotate */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg border transition-all ${
              autoRotate
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-100'
            }`}
            title={autoRotate ? 'Detener rotación automática' : 'Rotar automáticamente'}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>

          {/* Reset Camera */}
          <button
            onClick={resetCamera}
            className="p-1.5 rounded-lg bg-white border border-stone-300 text-stone-600 hover:bg-stone-100 transition-all"
            title="Restablecer vista"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div className="relative">
        <div
          ref={mountRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-[380px] sm:h-[430px] cursor-grab active:cursor-grabbing bg-radial from-stone-50 to-stone-100 select-none"
        />

        {/* Overlay Instructions & Legend */}
        <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1">
          <div className="bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-stone-200 text-[11px] text-stone-600 shadow-2xs flex items-center gap-1.5">
            <Info className="w-3 h-3 text-amber-600" />
            <span>Arrastra con el mouse para rotar • Rueda para zoom</span>
          </div>
        </div>

        {/* Floating Zoom & Controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-stone-200 shadow-xs">
          <button
            onClick={() => {
              targetZoomRef.current = Math.max(600, targetZoomRef.current - 250);
            }}
            className="p-1.5 rounded hover:bg-stone-100 text-stone-700 transition-colors"
            title="Acercar"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              targetZoomRef.current = Math.min(3000, targetZoomRef.current + 250);
            }}
            className="p-1.5 rounded hover:bg-stone-100 text-stone-700 transition-colors"
            title="Alejar"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Piece Quick Inspection List */}
      <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200">
        <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
          <span className="font-semibold text-stone-700">Partes del Modelo 3D:</span>
          <span>{pieceDefinitions.length} elementos estructurados</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pieceDefinitions.map((def) => {
            const isSelected = selectedPieceName === def.name;
            return (
              <button
                key={def.name}
                onClick={() => setSelectedPieceName(isSelected ? null : def.name)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all border ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-amber-400 hover:bg-amber-50/50'
                }`}
              >
                {def.name} ({def.w}×{def.h} mm)
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
