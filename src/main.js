import "./style.css";
import { Pane } from "tweakpane";
import {
  loadModel,
  animate,
  handleResize,
  updateModelFromParams,
} from "./scene.js";
import {
  initAsciiEffect,
  showAsciiEffect,
  hideAsciiEffect,
  updateBrightness,
  startBrightnessAnimation,
} from "./ascii-image.js";
import {
  initGenerator,
  showGenerator,
  hideGenerator,
} from "./ascii-generator.js";

// Model parameters for Tweakpane
const params = {
  scale: 4.9,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  autoRotate: true,
  rotationSpeed: 0.002,
  backgroundColor: "#ffffff",
  modelColor: "#000000",
  brightness: 0.5,
  contrast: 1.3,
  asciiEnabled: true,
  asciiResolution: 0.27,
  asciiFontSize: 22,
  asciiCharSet: " .:-=+*#%@",
  fps: 0,
  circleRadius: 0.2,
  circleSpeed: (Math.PI * 2) / 8, // 1 full rotation per second
  circleEnabled: true,
  subdivisionIterations: 1,
  asciiImageBrightness: 0,
};

// Create Tweakpane
const pane = new Pane();
const paneElement = pane.element;

// Tab switching functionality
const tabs = document.querySelectorAll(".tab");
const threejsView = document.getElementById("threejs-view");
const asciiView = document.getElementById("ascii-view");
const generatorView = document.getElementById("generator-view");

let currentView = "threejs";

// Function to update URL without reloading
function updateURL(view) {
  const url = new URL(window.location);
  url.searchParams.set("view", view);
  window.history.pushState({ view }, "", url);
}

// Function to get view from URL
function getInitialView() {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") || "threejs";
}

// Switch to a specific view
function switchView(view) {
  if (view === currentView) return;

  // Hide all views first
  threejsView.classList.remove("visible");
  asciiView.classList.remove("visible");
  generatorView.classList.remove("visible");

  // Hide all effects
  hideAsciiEffect();
  hideGenerator();

  // Find and update tab states
  for (const tab of tabs) {
    if (tab.dataset.view === view) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  }

  // Switch views
  if (view === "threejs") {
    threejsView.classList.add("visible");
    paneElement.style.display = "block";
  } else if (view === "ascii") {
    asciiView.classList.add("visible");
    showAsciiEffect(params.asciiImageBrightness);
    paneElement.style.display = "none";
    // Start brightness animation loop
    startBrightnessAnimation((brightness) => {
      params.asciiImageBrightness = brightness;
    });
  } else if (view === "generator") {
    generatorView.classList.add("visible");
    paneElement.style.display = "none";
    showGenerator();
  }

  currentView = view;
  updateURL(view);
}

// Handle browser back/forward buttons
window.addEventListener("popstate", (event) => {
  const view = event.state?.view || getInitialView();
  // Update URL without pushing new state
  const url = new URL(window.location);
  url.searchParams.set("view", view);
  window.history.replaceState({ view }, "", url);
  // Don't call switchView from popstate to avoid duplicate state changes
  currentView = "threejs"; // Reset so switchView will actually switch
  switchView(view);
});

// Initialize from URL on page load
const initialView = getInitialView();
if (initialView !== "threejs") {
  // Set initial URL without pushing state
  const url = new URL(window.location);
  url.searchParams.set("view", initialView);
  window.history.replaceState({ view: initialView }, "", url);
  // Set initial view state
  currentView = "threejs"; // Reset so switchView will actually switch
  switchView(initialView);
} else {
  window.history.replaceState({ view: "threejs" }, "", window.location);
}

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    switchView(tab.dataset.view);
  });
}

// Initialize ASCII effect
initAsciiEffect("ascii-view", "/97110_50709.jpg");

// Initialize ASCII generator (no default image - will use demo image)
initGenerator("ascii-output", "generator-controls", "");

// Add inputs directly to pane
pane.addBinding(params, "scale", {
  min: 0.1,
  max: 5,
  step: 0.1,
  label: "Scale",
});
pane.addBinding(params, "rotationX", {
  min: 0,
  max: Math.PI * 2,
  step: 0.01,
  label: "Rotation X",
});
pane.addBinding(params, "rotationY", {
  min: 0,
  max: Math.PI * 2,
  step: 0.01,
  label: "Rotation Y",
});
pane.addBinding(params, "rotationZ", {
  min: 0,
  max: Math.PI * 2,
  step: 0.01,
  label: "Rotation Z",
});
pane.addBinding(params, "positionX", {
  min: -5,
  max: 5,
  step: 0.1,
  label: "Position X",
});
pane.addBinding(params, "positionY", {
  min: -5,
  max: 5,
  step: 0.1,
  label: "Position Y",
});
pane.addBinding(params, "positionZ", {
  min: -5,
  max: 5,
  step: 0.1,
  label: "Position Z",
});
pane.addBinding(params, "autoRotate", { label: "Auto Rotate" });
pane.addBinding(params, "rotationSpeed", {
  min: 0,
  max: 0.05,
  step: 0.001,
  label: "Rotation Speed",
});
pane.addBinding(params, "backgroundColor", {
  view: "color",
  label: "Background",
});
pane.addBinding(params, "brightness", {
  min: 0,
  max: 2,
  step: 0.1,
  label: "Brightness",
});
pane.addBinding(params, "contrast", {
  min: 0.1,
  max: 3,
  step: 0.1,
  label: "Contrast",
});

// ASCII Effect controls
// pane.addBinding(params, 'asciiEnabled', { label: 'ASCII Effect' })
// pane.addBinding(params, 'asciiResolution', { min: 0.05, max: 0.5, step: 0.01, label: 'ASCII Resolution' })
pane.addBinding(params, "asciiFontSize", {
  min: 8,
  max: 30,
  step: 1,
  label: "ASCII Font Size",
});
pane.addBinding(params, "asciiCharSet", { label: "ASCII Character Set" });

// Add circular animation controls
pane.addBinding(params, "circleEnabled", { label: "Circle Animation" });
pane.addBinding(params, "circleRadius", {
  min: 0.1,
  max: 1,
  step: 0.1,
  label: "Circle Radius",
});

// Add subdivision control
pane.addBinding(params, "subdivisionIterations", {
  min: 0,
  max: 3,
  step: 1,
  label: "Subdivision",
});

// FPS Monitor
pane.addBinding(params, "fps", { label: "FPS", readonly: true });

// Listen for changes
pane.on("change", (ev) => {
  updateModelFromParams(ev.target.key, params[ev.target.key], params);
});

// Load the model
loadModel(params);

// Handle window resize
window.addEventListener("resize", handleResize);

// Start animation
animate(params, pane);
