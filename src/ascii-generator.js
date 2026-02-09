// ASCII Art Generator with parameter controls
// Based on character density mapping with color palettes

let container = null;
let controlsContainer = null;
let isActive = false;
let imageElement = null;

// Color palettes
const ColorPalette = {
  Monochrome: "none",
  Grey2Bit: "grey2bit",
  Grey4Bit: "grey4bit",
  Grey8Bit: "grey8bit",
  Color3Bit: "color3bit",
  Color4Bit: "color4bit",
  ColorFull: "color",
};

// Default character set (printable ASCII)
const defaultCharSet = " .:-=+*#%@";

// Parameters
const params = {
  charSet: defaultCharSet,
  url: "/97110_50709.jpg",
  charSamples: 1,
  size: 80,
  contrast: 0,
  brightness: 0,
  alpha: 0,
  colorPalette: ColorPalette.Grey2Bit,
  bgColor: "#ffffff",
  charColor: "#000000",
  aspectRatio: 1, // Adjustable aspect ratio correction
};

// Cached data
let charRegions = {};
let colorMap = [];
let valueMap = [];
let normalizedMap = [];
let width = 0;
let height = 0;

// Color palettes
const colorPalettes = {};

function generatePalettes() {
  colorPalettes[ColorPalette.Grey2Bit] = [
    [0, 0, 0],
    [104, 104, 104],
    [184, 184, 184],
    [255, 255, 255],
  ];

  colorPalettes[ColorPalette.Grey4Bit] = [];
  for (let i = 0; i < 16; i += 1) {
    colorPalettes[ColorPalette.Grey4Bit].push([i * 17, i * 17, i * 17]);
  }

  colorPalettes[ColorPalette.Grey8Bit] = [];
  for (let i = 0; i < 256; i += 1) {
    colorPalettes[ColorPalette.Grey8Bit].push([i, i, i]);
  }

  colorPalettes[ColorPalette.Color3Bit] = [
    [0, 0, 0],
    [0, 249, 45],
    [0, 252, 254],
    [255, 48, 21],
    [255, 62, 253],
    [254, 253, 52],
    [16, 37, 251],
    [255, 255, 255],
  ];

  colorPalettes[ColorPalette.Color4Bit] = [
    ...colorPalettes[ColorPalette.Color3Bit],
  ];
  for (let i = 1; i < 8; i += 1) {
    colorPalettes[ColorPalette.Color4Bit].push([i * 32, i * 32, i * 32]);
  }
}

function analyzeChar(char) {
  const canvas = document.createElement("canvas");
  canvas.width = 12;
  canvas.height = 12;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.font = "12px monospace";
  ctx.fillText(char, 2, 10);
  const data = ctx.getImageData(0, 0, 12, 12).data;
  const values = [];
  const size = 12 / params.charSamples;

  for (let cellY = 0; cellY < params.charSamples; cellY += 1) {
    for (let cellX = 0; cellX < params.charSamples; cellX += 1) {
      let value = 0;
      for (let posY = 0; posY < size; posY += 1) {
        for (let posX = 0; posX < size; posX += 1) {
          value +=
            data[(cellX * size + posX + (cellY * size + posY) * 12) * 4 + 3];
        }
      }
      values.push(value / (size * size) / 255);
    }
  }
  charRegions[char] = values;
}

function normalizeCharRegions() {
  let min = 1;
  let max = 0;
  for (const char in charRegions) {
    for (const region of charRegions[char]) {
      if (min > region) min = region;
      if (max < region) max = region;
    }
  }
  if (max > 0 && min !== max) {
    const diff = max - min;
    for (const char in charRegions) {
      const regions = charRegions[char];
      for (let index = 0; index < regions.length; index += 1) {
        regions[index] = (regions[index] - min) * (1 / diff);
      }
    }
  }
}

function analyzeCharRegions() {
  charRegions = {};
  for (const char of params.charSet) {
    analyzeChar(char);
  }
  normalizeCharRegions();
}

function loadImageAndGenerate() {
  imageElement = new Image();
  imageElement.crossOrigin = "anonymous";
  imageElement.src = params.url;
  imageElement.onload = () => {
    if (isActive) onImageLoaded();
  };
}

function onImageLoaded() {
  width = params.size;
  // Calculate height maintaining aspect ratio with user-adjustable correction
  // Higher value = more rows (taller output), Lower value = fewer rows (wider output)
  height = Math.floor(
    (imageElement.height / imageElement.width) * width * params.aspectRatio,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width * params.charSamples;
  canvas.height = height * params.charSamples;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(
    imageElement,
    0,
    0,
    width * params.charSamples,
    height * params.charSamples,
  );
  generateValueMap(ctx);
}

function generateValueMap(ctx) {
  valueMap = [];
  colorMap = [];

  const imageData = ctx.getImageData(
    0,
    0,
    width * params.charSamples,
    height * params.charSamples,
  );
  const data = imageData.data;
  const rowLength = width * params.charSamples * 4;

  for (let cellY = 0; cellY < height; cellY += 1) {
    for (let cellX = 0; cellX < width; cellX += 1) {
      const cell = [];
      const pos =
        cellX * params.charSamples * 4 + cellY * params.charSamples * rowLength;
      colorMap.push([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);

      for (let posY = 0; posY < params.charSamples; posY += 1) {
        for (let posX = 0; posX < params.charSamples; posX += 1) {
          const pos =
            (cellX * params.charSamples + posX) * 4 +
            (cellY * params.charSamples + posY) * rowLength;
          const alpha = data[pos + 3] / 255;
          const r = data[pos];
          const g = data[pos + 1];
          const b = data[pos + 2];
          const value = 1 - (((r + g + b) / 765) * alpha + 1 - alpha);
          cell.push(value);
        }
      }
      valueMap.push(cell);
    }
  }

  normalizeValueMap();
  generate();
}

function normalizeValueMap() {
  let min = 1;
  let max = 0;
  for (const regions of valueMap) {
    for (const region of regions) {
      if (min > region) min = region;
      if (max < region) max = region;
    }
  }

  if (max > 0 && min !== max) {
    const diff = max - min;
    normalizedMap = [];
    for (const regions of valueMap) {
      const normals = [...regions];
      for (let index = 0; index < normals.length; index += 1) {
        normals[index] = (normals[index] - min) * (1 / diff);
        normals[index] =
          (params.contrast + 1) * (normals[index] - 0.5) +
          0.5 +
          params.brightness;
      }
      normalizedMap.push(normals);
    }
  } else {
    normalizedMap = valueMap;
  }
}

function getClosestChar(values) {
  let minDiff = Number.MAX_VALUE;
  let minChar = "";
  for (const char in charRegions) {
    const regions = charRegions[char];
    let diff = 0;
    for (let index = 0; index < regions.length; index++) {
      diff += Math.abs(regions[index] - values[index]);
    }
    if (diff < minDiff) {
      minDiff = diff;
      minChar = char;
    }
  }
  return minChar;
}

function arrayToRgba(color) {
  const r = color[3] > 0 ? Math.floor(color[0]) : 255;
  const g = color[3] > 0 ? Math.floor(color[1]) : 255;
  const b = color[3] > 0 ? Math.floor(color[2]) : 255;
  const a = Math.max(0, Math.min(1, color[3] / 255 + params.alpha));
  return `rgba(${r},${g},${b},${a})`;
}

function getCharColor(color) {
  if (params.colorPalette === ColorPalette.ColorFull) {
    return arrayToRgba(color);
  } else {
    let closestColor = [0, 0, 0];
    let minDiff = Number.MAX_VALUE;
    for (const paletteColor of colorPalettes[params.colorPalette]) {
      const diff =
        Math.abs(color[0] - paletteColor[0]) +
        Math.abs(color[1] - paletteColor[1]) +
        Math.abs(color[2] - paletteColor[2]);
      if (diff < minDiff) {
        minDiff = diff;
        closestColor = paletteColor;
      }
    }
    return arrayToRgba([...closestColor, color[3]]);
  }
}

function generate() {
  if (!container) return;

  container.innerHTML = "";

  const pre = document.createElement("pre");
  pre.style.fontFamily = "'Courier New', monospace";
  pre.style.fontSize = "8px";
  pre.style.lineHeight = "8px";
  pre.style.letterSpacing = "0";
  pre.style.whiteSpace = "pre";
  pre.style.margin = "0";
  pre.style.padding = "0";
  pre.style.color = params.charColor;

  for (let cellY = 0; cellY < height; cellY += 1) {
    for (let cellX = 0; cellX < width; cellX += 1) {
      const span = document.createElement("span");
      span.className = "ascii-char";

      if (params.colorPalette !== ColorPalette.Monochrome) {
        span.style.color = getCharColor(colorMap[cellX + cellY * width]);
      }

      const char = getClosestChar(normalizedMap[cellX + cellY * width]);
      span.textContent = char === " " ? "\u00A0" : char;
      pre.appendChild(span);
    }
    pre.appendChild(document.createTextNode("\n"));
  }

  container.appendChild(pre);
  updateBackgroundColor();
}

function updateBackgroundColor() {
  if (!container) return;
  container.style.backgroundColor = params.bgColor;
}

function createControls() {
  if (!controlsContainer) return;

  controlsContainer.innerHTML = "<h3>ASCII Generator</h3>";

  // File Upload
  const uploadGroup = document.createElement("div");
  uploadGroup.className = "control-group";
  uploadGroup.innerHTML = `
    <label>Upload Image</label>
    <input type="file" id="ctrl-upload" accept="image/*">
  `;
  controlsContainer.appendChild(uploadGroup);

  // Image URL
  const urlGroup = document.createElement("div");
  urlGroup.className = "control-group";
  urlGroup.innerHTML = `
    <label>Image URL</label>
    <input type="text" id="ctrl-url" value="${params.url}">
  `;
  controlsContainer.appendChild(urlGroup);

  // Export Scale
  const exportScaleGroup = document.createElement("div");
  exportScaleGroup.className = "control-group";
  exportScaleGroup.innerHTML = `
    <label>Export Scale <span class="value" id="val-export-scale">6</span></label>
    <input type="range" id="ctrl-export-scale" min="1" max="10" step="1" value="6">
  `;
  controlsContainer.appendChild(exportScaleGroup);

  // Download button
  const downloadGroup = document.createElement("div");
  downloadGroup.className = "control-group";
  downloadGroup.innerHTML = `
    <button id="ctrl-download" type="button">Download PNG</button>
  `;
  controlsContainer.appendChild(downloadGroup);

  // Character Set
  const charsetGroup = document.createElement("div");
  charsetGroup.className = "control-group";
  charsetGroup.innerHTML = `
    <label>Character Set</label>
    <input type="text" id="ctrl-charset" value="${params.charSet.replace(/"/g, "&quot;")}">
  `;
  controlsContainer.appendChild(charsetGroup);

  // Size
  const sizeGroup = document.createElement("div");
  sizeGroup.className = "control-group";
  sizeGroup.innerHTML = `
    <label>Width (chars) <span class="value" id="val-size">${params.size}</span></label>
    <input type="range" id="ctrl-size" min="10" max="150" value="${params.size}">
  `;
  controlsContainer.appendChild(sizeGroup);

  // Char Samples
  const samplesGroup = document.createElement("div");
  samplesGroup.className = "control-group";
  samplesGroup.innerHTML = `
    <label>Char Samples <span class="value" id="val-samples">${params.charSamples}</span></label>
    <input type="range" id="ctrl-samples" min="1" max="3" step="1" value="${params.charSamples}">
  `;
  controlsContainer.appendChild(samplesGroup);

  // Aspect Ratio
  const aspectGroup = document.createElement("div");
  aspectGroup.className = "control-group";
  aspectGroup.innerHTML = `
    <label>Aspect Ratio <span class="value" id="val-aspect">1.00</span></label>
    <input type="range" id="ctrl-aspect" min="0.5" max="3" step="0.01" value="1">
  `;
  controlsContainer.appendChild(aspectGroup);

  // Contrast
  const contrastGroup = document.createElement("div");
  contrastGroup.className = "control-group";
  contrastGroup.innerHTML = `
    <label>Contrast <span class="value" id="val-contrast">${params.contrast}</span></label>
    <input type="range" id="ctrl-contrast" min="-1" max="1" step="0.01" value="${params.contrast}">
  `;
  controlsContainer.appendChild(contrastGroup);

  // Brightness
  const brightnessGroup = document.createElement("div");
  brightnessGroup.className = "control-group";
  brightnessGroup.innerHTML = `
    <label>Brightness <span class="value" id="val-brightness">${params.brightness}</span></label>
    <input type="range" id="ctrl-brightness" min="-1" max="1" step="0.01" value="${params.brightness}">
  `;
  controlsContainer.appendChild(brightnessGroup);

  // Alpha
  const alphaGroup = document.createElement("div");
  alphaGroup.className = "control-group";
  alphaGroup.innerHTML = `
    <label>Alpha <span class="value" id="val-alpha">${params.alpha}</span></label>
    <input type="range" id="ctrl-alpha" min="-1" max="1" step="0.01" value="${params.alpha}">
  `;
  controlsContainer.appendChild(alphaGroup);

  // Color Palette
  const paletteGroup = document.createElement("div");
  paletteGroup.className = "control-group";
  const paletteOptions = Object.values(ColorPalette)
    .map(
      (p) =>
        `<option value="${p}" ${params.colorPalette === p ? "selected" : ""}>${p}</option>`,
    )
    .join("");
  paletteGroup.innerHTML = `
    <label>Color Palette</label>
    <select id="ctrl-palette">${paletteOptions}</select>
  `;
  controlsContainer.appendChild(paletteGroup);

  // Background Color
  const bgColorGroup = document.createElement("div");
  bgColorGroup.className = "control-group";
  bgColorGroup.innerHTML = `
    <label>Background Color</label>
    <input type="color" id="ctrl-bgcolor" value="${params.bgColor}">
  `;
  controlsContainer.appendChild(bgColorGroup);

  // Character Color
  const charColorGroup = document.createElement("div");
  charColorGroup.className = "control-group";
  charColorGroup.innerHTML = `
    <label>Character Color</label>
    <input type="color" id="ctrl-charcolor" value="${params.charColor}">
  `;
  controlsContainer.appendChild(charColorGroup);

  // Event listeners
  document.getElementById("ctrl-upload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        params.url = event.target.result;
        document.getElementById("ctrl-url").value = params.url;
        loadImageAndGenerate();
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById("ctrl-url").addEventListener("change", (e) => {
    params.url = e.target.value;
    loadImageAndGenerate();
  });

  document.getElementById("ctrl-charset").addEventListener("change", (e) => {
    params.charSet = e.target.value || defaultCharSet;
    analyzeCharRegions();
    generate();
  });

  document.getElementById("ctrl-size").addEventListener("input", (e) => {
    params.size = parseInt(e.target.value);
    document.getElementById("val-size").textContent = params.size;
    loadImageAndGenerate();
  });

  document.getElementById("ctrl-samples").addEventListener("input", (e) => {
    params.charSamples = parseInt(e.target.value);
    document.getElementById("val-samples").textContent = params.charSamples;
    analyzeCharRegions();
    loadImageAndGenerate();
  });

  document.getElementById("ctrl-aspect").addEventListener("input", (e) => {
    params.aspectRatio = parseFloat(e.target.value);
    document.getElementById("val-aspect").textContent =
      params.aspectRatio.toFixed(2);
    loadImageAndGenerate();
  });

  document.getElementById("ctrl-contrast").addEventListener("input", (e) => {
    params.contrast = parseFloat(e.target.value);
    document.getElementById("val-contrast").textContent =
      params.contrast.toFixed(2);
    normalizeValueMap();
    generate();
  });

  document.getElementById("ctrl-brightness").addEventListener("input", (e) => {
    params.brightness = parseFloat(e.target.value);
    document.getElementById("val-brightness").textContent =
      params.brightness.toFixed(2);
    normalizeValueMap();
    generate();
  });

  document.getElementById("ctrl-alpha").addEventListener("input", (e) => {
    params.alpha = parseFloat(e.target.value);
    document.getElementById("val-alpha").textContent = params.alpha.toFixed(2);
    generate();
  });

  document.getElementById("ctrl-palette").addEventListener("change", (e) => {
    params.colorPalette = e.target.value;
    generate();
  });

  document.getElementById("ctrl-bgcolor").addEventListener("input", (e) => {
    params.bgColor = e.target.value;
    updateBackgroundColor();
    generate();
  });

  document.getElementById("ctrl-charcolor").addEventListener("input", (e) => {
    params.charColor = e.target.value;
    generate();
  });

  document
    .getElementById("ctrl-export-scale")
    .addEventListener("input", (e) => {
      const scale = parseInt(e.target.value);
      document.getElementById("val-export-scale").textContent = scale;
    });

  document.getElementById("ctrl-download").addEventListener("click", () => {
    exportToPNG();
  });
}

// Initialize the generator
export function initGenerator(containerId, controlsId, imageUrl) {
  container = document.getElementById(containerId);
  controlsContainer = document.getElementById(controlsId);
  params.url = imageUrl;

  generatePalettes();
  analyzeCharRegions();
  createControls();
}

// Show generator
export function showGenerator() {
  if (!container) return;
  isActive = true;
  container.parentElement.classList.add("visible");
  // If image is already loaded, process it
  if (imageElement?.complete) {
    onImageLoaded();
  } else {
    loadImageAndGenerate();
  }
}

// Hide generator
export function hideGenerator() {
  isActive = false;
  if (container) {
    container.parentElement.classList.remove("visible");
  }
}

// Parse hex color to RGB array
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

// Parse RGBA string to RGB array
function rgbaToRgbArray(rgbaStr) {
  const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  return [0, 0, 0];
}

// Export ASCII art as PNG
function exportToPNG() {
  if (width === 0 || height === 0 || normalizedMap.length === 0) {
    alert("No ASCII art to export. Please generate an image first.");
    return;
  }

  const exportScale = parseInt(
    document.getElementById("ctrl-export-scale")?.value || 6,
  );
  // Courier New characters are approximately 0.6 times as tall as they are wide
  // We use the same aspect ratio as in the display
  const charWidth = 8;
  const charHeight = 8;

  const canvasWidth = width * charWidth * exportScale;
  const canvasHeight = height * charHeight * exportScale;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    alert("Failed to create canvas for export.");
    return;
  }

  // Fill background
  const bgColor = hexToRgb(params.bgColor);
  ctx.fillStyle = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Set font - use line-height equal to font size for proper spacing
  const fontSize = 8 * exportScale;
  ctx.font = `${fontSize}px 'Courier New', monospace`;
  ctx.textBaseline = "top";

  // Draw each character
  for (let cellY = 0; cellY < height; cellY += 1) {
    for (let cellX = 0; cellX < width; cellX += 1) {
      const index = cellX + cellY * width;
      const char = getClosestChar(normalizedMap[index]);

      // Set color
      if (params.colorPalette !== ColorPalette.Monochrome) {
        const colorStr = getCharColor(colorMap[index]);
        const colorRgb = rgbaToRgbArray(colorStr);
        ctx.fillStyle = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;
      } else {
        ctx.fillStyle = params.charColor;
      }

      const x = cellX * charWidth * exportScale;
      const y = cellY * charHeight * exportScale;
      ctx.fillText(char, x, y);
    }
  }

  // Download the canvas as PNG
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  link.download = `ascii-art-${timestamp}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
