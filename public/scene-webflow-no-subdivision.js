/*
 * Fulton ASCII 3D Scene — Webflow embed (No Subdivision)
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
import { DRACOLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/DRACOLoader.js?bundle&deps=three@0.160.0";

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

  // Scene (no background — transparent)
  const scene = new THREE.Scene();

  // Capture initial DPR — cap at 2 to keep pixel count manageable on 4K/Retina
  const initDPR = Math.min(window.devicePixelRatio || 1, 2);
  const baseW = width * initDPR;
  const baseH = height * initDPR;

  // Camera
  const camera = new THREE.PerspectiveCamera(75, baseW / baseH, 0.1, 1000);
  camera.position.z = 5;

  // Offscreen renderer — sized to ASCII grid (no need for full resolution)
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;

  // 2D ASCII canvas — fixed resolution, immune to page zoom
  const asciiCanvas = document.createElement("canvas");
  const asciiCtx = asciiCanvas.getContext("2d");
  asciiCanvas.style.position = "absolute";
  asciiCanvas.style.top = "8%";
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

  // Offscreen renderer sized to ASCII grid — readPixels reads only what we need
  const renderW = fixedCols;
  const renderH = fixedRows;
  renderer.setSize(renderW, renderH, false);

  // Fade-in: hide canvas until model is ready, then CSS transition handles it
  const fadeInDuration = 3; // seconds
  let modelReady = false;
  asciiCanvas.style.opacity = "0";
  asciiCanvas.style.transition = `opacity ${fadeInDuration}s cubic-bezier(0.33, 1, 0.68, 1)`;

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
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
  loader.setDRACOLoader(dracoLoader);
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

      // Trigger fade-in after model is ready
      modelReady = true;
      asciiCanvas.style.opacity = "1";
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

  // ASCII rendering — renderer is already sized to grid, 1 pixel = 1 cell
  let pixelBuf = null;
  let pixelBufSize = 0;

  function renderASCII() {
    if (!cfg.asciiEnabled) return;

    const w = renderW;
    const h = renderH;
    const gl = renderer.getContext();

    const needed = w * h * 4;
    if (needed !== pixelBufSize) {
      pixelBuf = new Uint8Array(needed);
      pixelBufSize = needed;
    }
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuf);

    const cw = asciiCanvas.width;
    const ch = asciiCanvas.height;

    asciiCtx.clearRect(0, 0, cw, ch);

    asciiCtx.font = `${fontSize}px monospace`;
    asciiCtx.textBaseline = "top";

    const charSet = cfg.asciiCharSet;
    const drawCellW = cw / fixedCols;
    const drawCellH = ch / fixedRows;

    // Build full row strings per color bucket, then draw row-by-row
    // This reduces fillText calls from (cols*rows) to (rows*2)
    const darkRows = new Array(fixedRows);
    const lightRows = new Array(fixedRows);
    for (let r = 0; r < fixedRows; r++) {
      darkRows[r] = "";
      lightRows[r] = "";
    }

    for (let row = 0; row < h && row < fixedRows; row++) {
      const flippedRow = h - 1 - row;
      let darkStr = "";
      let lightStr = "";
      for (let col = 0; col < w && col < fixedCols; col++) {
        const i = (flippedRow * w + col) * 4;
        const r = pixelBuf[i];
        const g = pixelBuf[i + 1];
        const b = pixelBuf[i + 2];
        const a = pixelBuf[i + 3];

        if (a < 10) {
          darkStr += " ";
          lightStr += " ";
          continue;
        }

        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        if (brightness >= 0.9) {
          darkStr += " ";
          lightStr += " ";
        } else {
          const charIndex = Math.floor((1 - brightness) * (charSet.length - 1));
          const char = charSet[charIndex] || " ";
          if (brightness < 0.5) {
            darkStr += char;
            lightStr += " ";
          } else {
            darkStr += " ";
            lightStr += char;
          }
        }
      }
      darkRows[row] = darkStr;
      lightRows[row] = lightStr;
    }

    // Draw dark rows
    asciiCtx.fillStyle = "black";
    for (let r = 0; r < fixedRows; r++) {
      if (darkRows[r].trim()) {
        asciiCtx.fillText(darkRows[r], 0, r * drawCellH);
      }
    }

    // Draw light rows
    asciiCtx.fillStyle = "#808080";
    for (let r = 0; r < fixedRows; r++) {
      if (lightRows[r].trim()) {
        asciiCtx.fillText(lightRows[r], 0, r * drawCellH);
      }
    }
  }

  // Animation loop with visibility-aware scheduling
  let circleTime = 0;
  let lastFrameTime = 0;
  let rafId = null;
  let isVisible = true;

  function animate(now) {
    rafId = requestAnimationFrame(animate);

    // Delta time in seconds for frame-rate-independent animation
    const dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0.016;
    lastFrameTime = now;

    if (cfg.autoRotate) {
      scene.rotation.y += cfg.rotationSpeed;
    }

    if (cfg.circleEnabled && model) {
      circleTime += dt;
      const angle = circleTime * cfg.circleSpeed;
      model.position.x = (Math.cos(angle) * cfg.circleRadius) / 2;
      model.position.y = Math.sin(angle) * cfg.circleRadius;
    }

    renderer.render(scene, camera);
    if (modelReady) renderASCII();
  }

  // Pause when off-screen to save GPU/CPU
  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            isVisible = true;
            lastFrameTime = 0;
            rafId = requestAnimationFrame(animate);
          } else if (!entry.isIntersecting && isVisible) {
            isVisible = false;
            if (rafId) cancelAnimationFrame(rafId);
          }
        });
      },
      { threshold: 0.01 },
    );
    observer.observe(container);
  }

  // Canvas and renderer are fixed — CSS stretches to fill container.
  // No resize handling needed.

  // Start
  rafId = requestAnimationFrame(animate);

  return { scene, camera, renderer, cfg };
}

// ─── Initialize scenes (EXAMPLE) ─────────────────────────────────────────

// initScene("#cancer-cell", {
//   modelUrl:
//     "https://cdn.prod.website-files.com/69823aa904992b6320d75fe8/698da57c215254412e7df2b3_cell.glb.txt",
//   autoRotate: true,
//   rotationSpeed: 0.002,
//   backgroundColor: "#ffffff",
//   brightness: 0.5,
//   contrast: 2,
//   asciiResolution: 0.27,
//   asciiFontSize: 10,
//   asciiCharSet: " .:-=+*#%@",
//   circleEnabled: true,
//   circleRadius: 0.2,
//   circleSpeed: (Math.PI * 2) / 8,
// });

// initScene("#second-scene", {
//   modelUrl: "./other-model.glb",
//   backgroundColor: "#000000",
//   asciiFontSize: 16,
//   autoRotate: false,
// });
