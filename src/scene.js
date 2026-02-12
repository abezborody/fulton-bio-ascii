import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { LoopSubdivision } from "https://unpkg.com/three-subdivide/build/index.module.js";

// Scene setup
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// Camera setup
export const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.z = 5;

// Offscreen renderer (not added to DOM)
export const renderer = new THREE.WebGLRenderer({
  antialias: false,
  preserveDrawingBuffer: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 2D ASCII Canvas (visible)
export const asciiCanvas = document.createElement("canvas");
export const asciiCtx = asciiCanvas.getContext("2d");
asciiCanvas.style.position = "absolute";
asciiCanvas.style.top = "0";
asciiCanvas.style.left = "0";
asciiCanvas.style.width = "100%";
asciiCanvas.style.height = "100%";
const dpr = Math.min(window.devicePixelRatio, 3); // Cap at 3x for performance
asciiCanvas.width = window.innerWidth * dpr;
asciiCanvas.height = window.innerHeight * dpr;
asciiCtx.scale(dpr, dpr);
document.getElementById("threejs-view").appendChild(asciiCanvas);

// ASCII configuration
const asciiChars = " .:-=+*#%@";

// Lighting with enhanced contrast for model details
export const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Main directional light - high angle to create surface detail shadows
export const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(5, 15, 8);
mainLight.castShadow = false; // No floor shadows
scene.add(mainLight);

// Fill light from side for detail
export const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
fillLight.position.set(-8, 5, 3);
scene.add(fillLight);

// Back light for rim/silhouette
export const backLight = new THREE.DirectionalLight(0xffffff, 0.6);
backLight.position.set(0, 5, -10);
scene.add(backLight);

const loader = new GLTFLoader();
export let model = null;

// Load the model
export function loadModel(params, onLoad) {
  loader.load(
    "./cell.glb.txt",
    (gltf) => {
      console.log("Model loaded successfully:", gltf);
      model = gltf.scene;
      scene.add(model);

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const initialScale = 5 / maxDim;
      model.scale.multiplyScalar(initialScale);

      // Update initial scale in params
      params.scale = initialScale;

      // Enable mesh self-shadowing for detail and apply subdivision
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          // Apply LoopSubdivision smoothing
          if (params.subdivisionIterations > 0 && child.geometry) {
            const subdivParams = {
              split: true,
              uvSmooth: false,
              preserveEdges: false,
              flatOnly: false,
              maxTriangles: Number.POSITIVE_INFINITY,
            };
            child.geometry = LoopSubdivision.modify(
              child.geometry,
              params.subdivisionIterations,
              subdivParams,
            );
          }
        }
      });

      if (onLoad) onLoad(model);
    },
    (xhr) => {
      console.log(`${((xhr.loaded / xhr.total) * 100).toFixed(2)}% loaded`);
    },
    (error) => {
      console.error("An error happened loading the model:", error);
      loader.load(
        "/covid-19.glb",
        (gltf) => {
          console.log("Model loaded with alternative path:", gltf);
          model = gltf.scene;
          scene.add(model);

          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);

          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const initialScale = 2 / maxDim;
          model.scale.multiplyScalar(initialScale);

          // Enable mesh self-shadowing for detail (alternative path)
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          if (onLoad) onLoad(model);
        },
        (xhr) => {
          console.log(
            `${((xhr.loaded / xhr.total) * 100).toFixed(2)}% loaded (alternative path)`,
          );
        },
        (error) => {
          console.error("Alternative path also failed:", error);
        },
      );
    },
  );
}

// ASCII rendering function
export function renderASCII(params) {
  if (!params.asciiEnabled) return;

  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  const dpr = Math.min(window.devicePixelRatio, 3);

  // Get pixel data from 3D render
  const gl = renderer.getContext();
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // Use CSS display size (not internal resolution) for drawing calculations
  const displayWidth = asciiCanvas.width / dpr;
  const displayHeight = asciiCanvas.height / dpr;

  // Clear 2D canvas with white background
  asciiCtx.fillStyle = `${params.backgroundColor}`;
  asciiCtx.fillRect(0, 0, displayWidth, displayHeight);

  // Set font with black color
  const fontSize = params.asciiFontSize * params.asciiResolution;
  asciiCtx.font = `${fontSize}px monospace`;
  asciiCtx.fillStyle = "black";
  asciiCtx.textBaseline = "top";

  const charSet = params.asciiCharSet || asciiChars;

  // Calculate step size based on resolution
  const stepX = Math.max(1, Math.floor(width / (displayWidth / fontSize)));
  const stepY = Math.max(1, Math.floor(height / (displayHeight / fontSize)));

  // Draw ASCII characters
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = ((height - 1 - y) * width + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Calculate brightness
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      // Only draw if pixel is dark enough (part of model, not white background)
      if (brightness < 0.9) {
        const charIndex = Math.floor((1 - brightness) * (charSet.length - 1));
        const char = charSet[charIndex] || " ";

        // Dualton: black for dark, gray for lighter
        asciiCtx.fillStyle = brightness < 0.5 ? "black" : "#808080";

        // Draw character (using display size since ctx is scaled)
        const drawX = (x / width) * displayWidth;
        const drawY = (y / height) * displayHeight;
        asciiCtx.fillText(char, drawX, drawY);
      }
    }
  }
}

// FPS tracking
let lastTime = performance.now();
let frameCount = 0;

let circleTime = 0;

// Animation loop
export function animate(params, pane) {
  requestAnimationFrame(() => animate(params, pane));

  // Calculate FPS
  const currentTime = performance.now();
  frameCount++;

  if (currentTime - lastTime >= 1000) {
    params.fps = frameCount;
    frameCount = 0;
    lastTime = currentTime;
    pane.refresh();
  }

  // Auto-rotate if enabled
  if (params.autoRotate) {
    scene.rotation.y += params.rotationSpeed;
  }

  // Circular movement animation
  if (params.circleEnabled && model) {
    circleTime += 0.016; // ~60fps
    const angle = circleTime * params.circleSpeed;
    // Counter-clockwise circular motion
    model.position.x =
      params.positionX + (Math.cos(angle) * params.circleRadius) / 2;
    model.position.y = params.positionZ + Math.sin(angle) * params.circleRadius;
  }

  // Render 3D scene offscreen
  renderer.render(scene, camera);

  // Convert to ASCII
  renderASCII(params);
}

// Handle window resize
export function handleResize() {
  const tabBarHeight = 40;
  const width = window.innerWidth;
  const height = window.innerHeight - tabBarHeight;
  const dpr = Math.min(window.devicePixelRatio, 3); // Cap at 3x for performance

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Update 2D canvas size with DPR scaling
  asciiCanvas.width = width * dpr;
  asciiCanvas.height = height * dpr;
  asciiCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
  asciiCtx.scale(dpr, dpr); // Re-apply DPR scaling

  // Update 3D renderer to full resolution
  renderer.setSize(width, height);
}

// Update model from params
export function updateModelFromParams(key, value, params) {
  if (!model) return;

  if (key === "scale") {
    model.scale.setScalar(value);
  } else if (key === "rotationX") {
    model.rotation.x = value;
  } else if (key === "rotationY") {
    model.rotation.y = value;
  } else if (key === "rotationZ") {
    model.rotation.z = value;
  } else if (key === "positionX") {
    model.position.x = value;
  } else if (key === "positionY") {
    model.position.y = value;
  } else if (key === "positionZ") {
    model.position.z = value;
  } else if (key === "backgroundColor") {
    scene.background = new THREE.Color(value);
  } else if (key === "brightness") {
    ambientLight.intensity = value;
  } else if (key === "contrast") {
    mainLight.intensity = 1.5 * value;
    fillLight.intensity = 0.8 * value;
    backLight.intensity = 0.6 * value;
  }
}
