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
  modelUrl: "./cell.glb.txt",
  autoRotate: true,
  rotationSpeed: 0.002,
  backgroundColor: "#ffffff",
  brightness: 0.5,
  contrast: 1.3,
  asciiEnabled: true,
  asciiResolution: 0.27,
  asciiFontSize: 22,
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

  // Camera
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 5;

  // Offscreen renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 2D ASCII canvas
  const asciiCanvas = document.createElement("canvas");
  const asciiCtx = asciiCanvas.getContext("2d");
  asciiCanvas.style.position = "absolute";
  asciiCanvas.style.top = "0";
  asciiCanvas.style.left = "0";
  asciiCanvas.style.width = "100%";
  asciiCanvas.style.height = "100%";
  const DPR = 3;
  asciiCanvas.width = width * DPR;
  asciiCanvas.height = height * DPR;
  asciiCtx.scale(DPR, DPR);
  container.appendChild(asciiCanvas);

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
          child.castShadow = true;
          child.receiveShadow = true;
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

  // ASCII rendering
  function renderASCII() {
    if (!cfg.asciiEnabled) return;

    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    const gl = renderer.getContext();
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const displayWidth = asciiCanvas.width / DPR;
    const displayHeight = asciiCanvas.height / DPR;

    asciiCtx.fillStyle = cfg.backgroundColor;
    asciiCtx.fillRect(0, 0, displayWidth, displayHeight);

    const fontSize = cfg.asciiFontSize * cfg.asciiResolution;
    asciiCtx.font = `${fontSize}px monospace`;
    asciiCtx.fillStyle = "black";
    asciiCtx.textBaseline = "top";

    const charSet = cfg.asciiCharSet;
    const stepX = Math.max(1, Math.floor(w / (displayWidth / fontSize)));
    const stepY = Math.max(1, Math.floor(h / (displayHeight / fontSize)));

    for (let y = 0; y < h; y += stepY) {
      for (let x = 0; x < w; x += stepX) {
        const i = ((h - 1 - y) * w + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

        if (brightness < 0.9) {
          const charIndex = Math.floor((1 - brightness) * (charSet.length - 1));
          const char = charSet[charIndex] || " ";

          asciiCtx.fillStyle = brightness < 0.5 ? "black" : "#808080";

          const drawX = (x / w) * displayWidth;
          const drawY = (y / h) * displayHeight;
          asciiCtx.fillText(char, drawX, drawY);
        }
      }
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

  // Resize handling
  function handleResize() {
    const { width: w, height: h } = getSize();
    if (w === 0 || h === 0) return;
    width = w;
    height = h;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    asciiCanvas.width = width * DPR;
    asciiCanvas.height = height * DPR;
    asciiCtx.setTransform(1, 0, 0, 1, 0, 0);
    asciiCtx.scale(DPR, DPR);

    renderer.setSize(width, height);
  }

  new ResizeObserver(handleResize).observe(container);
  window.addEventListener("resize", handleResize);

  // Start
  animate();

  return { scene, camera, renderer, cfg };
}

// ─── Initialize scenes (EDIT THESE) ─────────────────────────────────────────

initScene("#ascii-scene", {
  modelUrl: "./cell.glb.txt",
  autoRotate: true,
  rotationSpeed: 0.002,
  backgroundColor: "#ffffff",
  brightness: 0.5,
  contrast: 1.3,
  asciiResolution: 0.27,
  asciiFontSize: 22,
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
