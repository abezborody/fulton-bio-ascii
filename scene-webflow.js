/*
 * Fulton ASCII 3D Scene — Webflow embed
 * Nothing needed in <head> — just paste this into <script type="module"> before </body>.
 *
 * HOW TO USE:
 * 1. In Webflow, create one or more divs with unique IDs and set their sizes.
 * 2. Copy this entire file into a <script type="module"> block before </body>.
 * 3. At the bottom of this script, call initScene() for each element.
 *
 * EXAMPLE:
 *   initScene("#hero-scene", {
 *     modelUrl: "./cell.glb.txt",
 *     asciiFontSize: 22,
 *   });
 *   initScene("#about-scene", {
 *     modelUrl: "./other-model.glb",
 *     backgroundColor: "#000000",
 *     asciiFontSize: 16,
 *     autoRotate: false,
 *   });
 */

// ─── Imports from CDN (bundled, no importmap needed) ────────────────────────
import * as THREE from "https://esm.sh/three@0.160.0?bundle";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js?bundle&deps=three@0.160.0";

// ─── Default parameters ─────────────────────────────────────────────────────
const DEFAULTS = {
  modelUrl:
    "https://cdn.prod.website-files.com/69823aa904992b6320d75fe8/698da57c215254412e7df2b3_cell.glb.txt",
  autoRotate: true,
  rotationSpeed: 0.002,
  backgroundColor: "#ffffff",
  brightness: 0.5,
  contrast: 1.3,
  asciiEnabled: true,
  asciiResolution: 0.27,
  asciiFontSize: 10,
  asciiCharSet: " .:-=+*#%@",
  circleEnabled: true,
  circleRadius: 0.2,
  circleSpeed: (Math.PI * 2) / 8,
};

// ─── Scene factory (no need to edit) ─────────────────────────────────────────

function initScene(selector, options = {}) {
  const container = document.querySelector(selector);
  if (!container) {
    console.error(`[FultonASCII] Container not found: "${selector}"`);
    return null;
  }

  const cfg = { ...DEFAULTS, ...options };

  const computedStyle = window.getComputedStyle(container);
  if (computedStyle.position === "static") {
    container.style.position = "relative";
  }
  container.style.overflow = "hidden";

  function getSize() {
    const rect = container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  let { width, height } = getSize();

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.backgroundColor);

  // Capture initial DPR — all sizes in physical pixels from here on
  const initDPR = window.devicePixelRatio || 1;
  const baseW = width * initDPR;
  const baseH = height * initDPR;

  // Camera
  const camera = new THREE.PerspectiveCamera(75, baseW / baseH, 0.1, 1000);
  camera.position.z = 5;

  // Offscreen renderer — sized in physical pixels
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(baseW, baseH, false);
  renderer.shadowMap.enabled = false;

  // 2D ASCII canvas — fixed resolution, immune to page zoom
  const asciiCanvas = document.createElement("canvas");
  const asciiCtx = asciiCanvas.getContext("2d");
  asciiCanvas.style.position = "absolute";
  asciiCanvas.style.top = "15%";
  asciiCanvas.style.left = "30%";
  asciiCanvas.style.width = "100%";
  asciiCanvas.style.height = "100%";
  asciiCanvas.width = baseW;
  asciiCanvas.height = baseH;
  container.appendChild(asciiCanvas);

  // Fixed ASCII grid — never changes
  const fontSize = cfg.asciiFontSize * initDPR;
  const cellW = fontSize * 0.6;
  const cellH = fontSize;
  const fixedCols = Math.floor(baseW / cellW);
  const fixedRows = Math.floor(baseH / cellH);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, cfg.brightness);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.5 * cfg.contrast);
  mainLight.position.set(5, 15, 8);
  mainLight.castShadow = false;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8 * cfg.contrast);
  fillLight.position.set(-8, 5, 3);
  scene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 0.6 * cfg.contrast);
  backLight.position.set(0, 5, -10);
  scene.add(backLight);

  // Model
  const loader = new GLTFLoader();
  let model = null;

  loader.load(
    cfg.modelUrl,
    (gltf) => {
      model = gltf.scene;
      scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const initialScale = 5 / maxDim;
      model.scale.multiplyScalar(initialScale);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
    },
    (xhr) => {
      if (xhr.total) {
        console.log(
          `[FultonASCII] ${selector}: ${((xhr.loaded / xhr.total) * 100).toFixed(1)}% loaded`,
        );
      }
    },
    (error) => {
      console.error(`[FultonASCII] ${selector}: Model load error:`, error);
    },
  );

  // ASCII rendering — reuse pixel buffer, batch by color
  let pixelBuf = null;
  let pixelBufSize = 0;

  function renderASCII() {
    if (!cfg.asciiEnabled) return;

    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    const gl = renderer.getContext();

    const needed = w * h * 4;
    if (needed !== pixelBufSize) {
      pixelBuf = new Uint8Array(needed);
      pixelBufSize = needed;
    }
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuf);

    const cw = asciiCanvas.width;
    const ch = asciiCanvas.height;

    asciiCtx.fillStyle = cfg.backgroundColor;
    asciiCtx.fillRect(0, 0, cw, ch);

    asciiCtx.font = `${fontSize}px monospace`;
    asciiCtx.textBaseline = "top";

    const charSet = cfg.asciiCharSet;
    const stepX = Math.max(1, Math.floor(w / fixedCols));
    const stepY = Math.max(1, Math.floor(h / fixedRows));
    const drawCellW = cw / fixedCols;
    const drawCellH = ch / fixedRows;

    // Collect chars into two buckets by color to minimize fillStyle switches
    const darkChars = [];
    const lightChars = [];

    let col = 0;
    for (let y = 0; y < h; y += stepY) {
      let row = 0;
      for (let x = 0; x < w; x += stepX) {
        const i = ((h - 1 - y) * w + x) * 4;
        const r = pixelBuf[i];
        const g = pixelBuf[i + 1];
        const b = pixelBuf[i + 2];

        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        if (brightness < 0.9) {
          const charIndex = Math.floor((1 - brightness) * (charSet.length - 1));
          const char = charSet[charIndex] || " ";
          const drawX = row * drawCellW;
          const drawY = col * drawCellH;

          if (brightness < 0.5) {
            darkChars.push(char, drawX, drawY);
          } else {
            lightChars.push(char, drawX, drawY);
          }
        }
        row++;
      }
      col++;
    }

    // Draw dark chars
    asciiCtx.fillStyle = "black";
    for (let i = 0; i < darkChars.length; i += 3) {
      asciiCtx.fillText(darkChars[i], darkChars[i + 1], darkChars[i + 2]);
    }

    // Draw light chars
    asciiCtx.fillStyle = "#808080";
    for (let i = 0; i < lightChars.length; i += 3) {
      asciiCtx.fillText(lightChars[i], lightChars[i + 1], lightChars[i + 2]);
    }
  }

  // Animation loop
  let circleTime = 0;

  function animate() {
    requestAnimationFrame(animate);

    if (cfg.autoRotate) {
      scene.rotation.y += cfg.rotationSpeed;
    }

    if (cfg.circleEnabled && model) {
      circleTime += 0.016;
      const angle = circleTime * cfg.circleSpeed;
      model.position.x = (Math.cos(angle) * cfg.circleRadius) / 2;
      model.position.y = Math.sin(angle) * cfg.circleRadius;
    }

    renderer.render(scene, camera);
    renderASCII();
  }

  // Resize handling — counter-scale on zoom, real resize on layout change
  let prevDPR = initDPR;

  function handleResize() {
    const { width: w, height: h } = getSize();
    if (w === 0 || h === 0) return;

    const currentDPR = window.devicePixelRatio || 1;
    const isZoom = Math.abs(currentDPR - prevDPR) > 0.001;
    prevDPR = currentDPR;

    if (isZoom) {
      // Zoom changed — counter-scale ASCII canvas, keep everything else fixed
      const zoomRatio = initDPR / currentDPR;
      asciiCanvas.style.transformOrigin = "0 0";
      asciiCanvas.style.transform = `scale(${zoomRatio})`;
      asciiCanvas.style.width = `${100 / zoomRatio}%`;
      asciiCanvas.style.height = `${100 / zoomRatio}%`;
    } else {
      // Real layout resize — update renderer + camera, keep aspect from physical pixels
      width = w;
      height = h;

      const physW = w * currentDPR;
      const physH = h * currentDPR;

      camera.aspect = physW / physH;
      camera.updateProjectionMatrix();
      renderer.setSize(physW, physH, false);

      asciiCanvas.width = physW;
      asciiCanvas.height = physH;

      // Reset zoom compensation
      asciiCanvas.style.transform = "";
      asciiCanvas.style.width = "100%";
      asciiCanvas.style.height = "100%";
    }
  }

  new ResizeObserver(handleResize).observe(container);
  window.addEventListener("resize", handleResize);

  // Start
  animate();

  return { scene, camera, renderer, cfg };
}

// ─── Initialize scenes (EDIT THESE) ─────────────────────────────────────────

initScene("#cancer-cell", {
  modelUrl:
    "https://cdn.prod.website-files.com/69823aa904992b6320d75fe8/698da57c215254412e7df2b3_cell.glb.txt",
  autoRotate: true,
  rotationSpeed: 0.002,
  backgroundColor: "#ffffff",
  brightness: 0.5,
  contrast: 1.5,
  asciiResolution: 0.27,
  asciiFontSize: 10,
  asciiCharSet: " .:-=+*#%@",
  circleEnabled: true,
  circleRadius: 0.2,
  circleSpeed: (Math.PI * 2) / 8,
});

// initScene("#second-scene", {
//   modelUrl: "./other-model.glb",
//   backgroundColor: "#000000",
//   asciiFontSize: 16,
//   autoRotate: false,
// });
