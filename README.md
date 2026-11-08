# 🪚 CutOptimizer — Optimizador de Cortes y Simulador 3D para Melamina y Madera

**CutOptimizer** es una aplicación web avanzada para carpinteros, diseñadores de mobiliario y aficionados al bricolaje. Permite optimizar diagramas de corte en láminas (tableros de melamina, MDF, contrachapado, etc.), minimizar el desperdicio de material y visualizar el mueble ensamblado en **3D interactivo** en tiempo real.

---

## ✨ Características Principales

### 1. 📐 Algoritmo de Optimización 2D de Cortes Guillotina
- **Empaquetado inteligente (2D Bin Packing)**: Distribuye las piezas aprovechando al máximo cada lámina o tablero.
- **Configuración precisa de corte**:
  - Grosor del disco / sierra (*kerf* o sangría de corte).
  - Margen de refilado / saneado perimetral del tablero.
  - Prioridad de corte: cortes longitudinales (a lo largo) o transversales (a lo ancho).
  - Respeto del sentido de la veta de la madera o permiso de rotación 90°.
- **Métricas detalladas**:
  - Porcentaje de aprovechamiento total del material.
  - Área útil, desperdicio (*merma*) y retazos reutilizables.
  - Longitud total de cortes lineales y metros lineales de tapacantos.

### 2. 🏢 Simulador 3D de Ensamble y Despiece Paramétrico (Three.js)
- **Auto-ensamblaje en tiempo real**: Detecta la función de cada pieza (laterales, tapas, bases, fondos, entrepaños, puertas, cajones) según su nombre y dimensiones para ensamblarlas en el espacio 3D.
- **Soporte Multi-Mueble**: Organiza las piezas por muebles o proyectos independientes (ej. *Estantería*, *Mesita de Noche*) y navega entre ellos o visualízalos todos juntos.
- **Vista de Despiece / Explosión**: Control deslizante para separar gradualmente las piezas y verificar uniones y distribución interior.
- **Regla de Carpintería para Entrepaños**: Descuento automático de espesores de laterales ($Ancho_{interior} = Ancho_{exterior} - 2 \times Espesor$) con cálculo guiado.
- **Acabados y texturas**: Simulación de maderas (Roble, Nogal, Blanco Nórdico, Pino).
- **Inspección interactiva**: Haz clic en cualquier pieza 3D para consultar sus medidas exactas.

### 3. 🏷️ Gestión de Tapacantos (Cantos)
- Asignación de tapacanto independiente para cada borde de la pieza:
  - **L1 / L2**: Bordes longitudinales (superior / inferior).
  - **A1 / A2**: Bordes transversales (izquierdo / derecho).
- Cálculo automático de metros lineales totales necesarios para la compra de tapacantos.

### 4. 🎬 Secuencia de Cortes Paso a Paso
- Modal interactivo con reproducción animada de la secuencia de cortes de guillotina que debe realizar el operario en la escuadradora o seccionadora.

### 5. 📊 Importación, Exportación y Reportes
- **Importación rápida desde Excel o CSV**: Copia y pega directamente columnas con formato `Mueble, Nombre, Largo, Ancho, Cantidad`.
- **Exportación a CSV**: Descarga tu lista de piezas organizada con un solo clic.
- **Plantillas Predefinidas**: Diseños listos para usar (Estantería biblioteca, Mesita de noche, Mueble TV, Armario ropero, Mueble de cocina bajo mesada).
- **Reporte Imprimible / PDF**: Formato limpio y profesional con diagramas de corte, lista de despiece y resumen de costos y materiales.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vite.dev/)
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Gráficos 3D**: [Three.js](https://threejs.org/)
- **Iconos**: [Lucide React](https://lucide.dev/)
- **Animaciones**: [Motion](https://motion.dev/)

---

## 🚀 Instalación y Ejecución Local

### Prerrequisitos
- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
- Gestor de paquetes `npm` o `bun`

### Pasos

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/alejozd/CutOptimizer.git
   cd CutOptimizer
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abre tu navegador en `http://localhost:3000`.

4. **Compilar para producción**:
   ```bash
   npm run build
   ```

5. **Verificar tipos / Linter**:
   ```bash
   npm run lint
   ```

---

## 📁 Estructura del Proyecto

```text
├── src/
│   ├── components/
│   │   ├── CutSequenceModal.tsx     # Simulación animada de cortes
│   │   ├── Furniture3DViewer.tsx    # Visor 3D interactivo con Three.js
│   │   ├── Header.tsx               # Barra de navegación superior
│   │   ├── OptimizerControls.tsx    # Parámetros del algoritmo de corte
│   │   ├── PieceListEditor.tsx      # Tabla y formulario de piezas / CSV
│   │   ├── PiecesReportTable.tsx    # Lista detallada de piezas ubicadas
│   │   ├── PrintReportView.tsx      # Vista de impresión / exportación PDF
│   │   ├── ResultDashboard.tsx      # Métricas y estadísticas de optimización
│   │   ├── SheetCanvasView.tsx      # Renderizado 2D de las láminas de corte
│   │   └── SheetConfigPanel.tsx     # Dimensiones de tablero y hoja de sierra
│   ├── utils/
│   │   ├── furniture3DAssembler.ts  # Algoritmo de ensamble paramétrico 3D
│   │   ├── optimizer.ts             # Motor de empaquetado y corte 2D
│   │   └── presets.ts               # Plantillas de muebles y medidas estándar
│   ├── types.ts                     # Definiciones e interfaces de TypeScript
│   ├── App.tsx                      # Componente principal de la aplicación
│   └── main.tsx                     # Punto de entrada de la aplicación
├── package.json
├── vite.config.ts
└── README.md
```

---

## 📄 Licencia

Este proyecto está disponible bajo la licencia [MIT](LICENSE).
