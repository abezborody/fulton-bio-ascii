/* TEST
 * Fulton ASCII Image Effect — Webflow embed
 * Canvas-based renderer with looping brightness animation.
 *
 * HOW TO USE:
 * 1. In Webflow, create a div with a unique ID and set its size.
 * 2. Paste this entire file into a <script> block before </body>.
 * 3. At the bottom of this script, call initAsciiImage() for each element.
 *
 * EXAMPLE:
 *   initAsciiImage("#hero-image", {
 *     imageUrl: "https://example.com/photo.jpg",
 *     brightness: 0,
 *     contrast: 0,
 *   });
 *
 *   initAsciiImage("#about-image", {
 *     imageUrl: "./other-photo.jpg",
 *     size: 150,
 *     animationEnabled: true,
 *     brightnessMin: -0.2,
 *     brightnessMax: 0.5,
 *     animationDuration: 10000,
 *     charSet: " .:-=+*#%@",
 *     charColor: "#000000",
 *     bgColor: "#ffffff",
 *   });
 */

// ─── Color palettes ──────────────────────────────────────────────────────────
var COLOR_PALETTES = {
  grey2bit: [
    [0, 0, 0],
    [104, 104, 104],
    [184, 184, 184],
    [255, 255, 255],
  ],
  grey4bit: (function () {
    var p = [];
    for (var i = 0; i < 16; i++) p.push([i * 17, i * 17, i * 17]);
    return p;
  })(),
  grey8bit: (function () {
    var p = [];
    for (var i = 0; i < 256; i++) p.push([i, i, i]);
    return p;
  })(),
  color3bit: [
    [0, 0, 0],
    [0, 249, 45],
    [0, 252, 254],
    [255, 48, 21],
    [255, 62, 253],
    [254, 253, 52],
    [16, 37, 251],
    [255, 255, 255],
  ],
  color4bit: (function () {
    var base = [
      [0, 0, 0],
      [0, 249, 45],
      [0, 252, 254],
      [255, 48, 21],
      [255, 62, 253],
      [254, 253, 52],
      [16, 37, 251],
      [255, 255, 255],
    ];
    for (var i = 1; i < 8; i++) base.push([i * 32, i * 32, i * 32]);
    return base;
  })(),
};

// ─── Default parameters ─────────────────────────────────────────────────────
var ASCII_IMG_DEFAULTS = {
  imageUrl: "",
  // ASCII grid width in characters (height is auto from aspect ratio)
  size: 200,
  // Static brightness / contrast offsets (-1 … 1)
  brightness: 0,
  contrast: 0,
  // Character set from dark to light
  charSet: " .:-=+*#%@",
  // Colors
  charColor: "#000000",
  bgColor: "#ffffff",
  transparentBg: false,
  // Color palette: "none" (monochrome), "opacity" (single color, variable alpha),
  //   "grey2bit", "grey4bit", "grey8bit", "color3bit", "color4bit", "color" (full)
  colorPalette: "none",
  // Thickness: 100-900 (400=normal, 700=bold)
  fontWeight: 600,
  // Looping brightness animation
  animationEnabled: true,
  animationDuration: 10000, // ms for one full sine cycle
  animationPhase: Math.PI / 2, // Phase offset in radians (0 = start at min, Math.PI = start at max, Math.PI/2 = start at middle)
  brightnessMin: -0.2,
  brightnessMax: 0.5,
  // Fade-in after image loads
  fadeInDuration: 1, // seconds
};

// ─── Instance factory ────────────────────────────────────────────────────────

function initAsciiImage(selector, options) {
  if (options === undefined) options = {};

  var container = document.querySelector(selector);
  if (!container) {
    console.error(
      '[FultonASCII-Image] Container not found: "' + selector + '"',
    );
    return null;
  }

  var cfg = {};
  for (var k in ASCII_IMG_DEFAULTS) cfg[k] = ASCII_IMG_DEFAULTS[k];
  for (var k in options) cfg[k] = options[k];

  if (!cfg.imageUrl) {
    console.error("[FultonASCII-Image] No imageUrl provided for " + selector);
    return null;
  }

  // ── Container setup ──────────────────────────────────────────────────────
  var computedStyle = window.getComputedStyle(container);
  if (computedStyle.position === "static") {
    container.style.position = "relative";
  }
  container.style.overflow = "hidden";

  // ── Canvas element ───────────────────────────────────────────────────────
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.objectFit = "contain";
  container.appendChild(canvas);

  // ── Character analysis ───────────────────────────────────────────────────
  var charSet = cfg.charSet;
  var charSamples = 1;

  function analyzeChar(char) {
    var c = document.createElement("canvas");
    c.width = 12;
    c.height = 12;
    var cx = c.getContext("2d");
    if (!cx) return [0];
    cx.font = "12px monospace";
    cx.fillText(char, 2, 10);
    var data = cx.getImageData(0, 0, 12, 12).data;
    var values = [];
    var sampleSize = 12 / charSamples;
    for (var cellY = 0; cellY < charSamples; cellY++) {
      for (var cellX = 0; cellX < charSamples; cellX++) {
        var value = 0;
        for (var posY = 0; posY < sampleSize; posY++) {
          for (var posX = 0; posX < sampleSize; posX++) {
            value +=
              data[
                (cellX * sampleSize + posX + (cellY * sampleSize + posY) * 12) *
                  4 +
                  3
              ];
          }
        }
        values.push(value / (sampleSize * sampleSize) / 255);
      }
    }
    return values;
  }

  // Build & normalize character regions
  var charRegions = {};
  for (var i = 0; i < charSet.length; i++) {
    var ch = charSet[i];
    var vals = analyzeChar(ch);
    charRegions[ch] = [];
    for (var j = 0; j < vals.length; j++) {
      charRegions[ch].push([vals[j]]);
    }
  }

  // Normalize
  var rMin = 1,
    rMax = 0;
  for (var c in charRegions) {
    for (var ri = 0; ri < charRegions[c].length; ri++) {
      var v = charRegions[c][ri][0];
      if (v < rMin) rMin = v;
      if (v > rMax) rMax = v;
    }
  }
  if (rMax > 0 && rMin !== rMax) {
    var rDiff = rMax - rMin;
    for (var c in charRegions) {
      for (var ri = 0; ri < charRegions[c].length; ri++) {
        charRegions[c][ri][0] = (charRegions[c][ri][0] - rMin) * (1 / rDiff);
      }
    }
  }

  function getClosestChar(values) {
    var minDiff = Number.MAX_VALUE;
    var minChar = " ";
    for (var c in charRegions) {
      var regions = charRegions[c];
      var diff = 0;
      for (var idx = 0; idx < regions.length; idx++) {
        diff += Math.abs(regions[idx][0] - values[idx]);
      }
      if (diff < minDiff) {
        minDiff = diff;
        minChar = c;
      }
    }
    return minChar;
  }

  // ── Color helpers ─────────────────────────────────────────────────────────
  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : [0, 0, 0];
  }

  function getCharRgba(color, brightness) {
    var palette = cfg.colorPalette;
    var tint = cfg.charTint;
    var r,
      g,
      b,
      a = 1;

    if (palette === "opacity") {
      // Single charColor, alpha derived from pixel brightness
      var base = hexToRgb(cfg.charColor);
      r = base[0];
      g = base[1];
      b = base[2];
      // Minimum opacity (0.5), range (0.5) = visible variation but not too pale
      a = Math.max(0.5, Math.min(1, 1 - brightness * 0.5));
      // Apply charTint blending for opacity mode
      if (tint !== 1) {
        r = Math.min(255, Math.floor(r * tint + base[0] * (1 - tint)));
        g = Math.min(255, Math.floor(g * tint + base[1] * (1 - tint)));
        b = Math.min(255, Math.floor(b * tint + base[2] * (1 - tint)));
      }
      return [r, g, b, a];
    } else if (palette === "opacity-inverse") {
      // Single charColor, INVERTED alpha for dark backgrounds
      var base = hexToRgb(cfg.charColor);
      r = base[0];
      g = base[1];
      b = base[2];
      // Minimum opacity (0.5), range (0.5) = visible variation but not too pale
      a = Math.max(0.5, Math.min(1, 0.5 + brightness * 0.5));
      // Apply charTint blending for opacity-inverse mode
      if (tint !== 1) {
        r = Math.min(255, Math.floor(r * tint + base[0] * (1 - tint)));
        g = Math.min(255, Math.floor(g * tint + base[1] * (1 - tint)));
        b = Math.min(255, Math.floor(b * tint + base[2] * (1 - tint)));
      }
      return [r, g, b, a];
    } else if (palette === "color") {
      // Full color — use pixel color directly
      r = color[3] > 0 ? color[0] : 255;
      g = color[3] > 0 ? color[1] : 255;
      b = color[3] > 0 ? color[2] : 255;
    } else if (palette !== "none" && COLOR_PALETTES[palette]) {
      // Quantize to palette
      var pal = COLOR_PALETTES[palette];
      var minDist = Number.MAX_VALUE;
      var closest = [0, 0, 0];
      for (var pi = 0; pi < pal.length; pi++) {
        var d =
          Math.abs(color[0] - pal[pi][0]) +
          Math.abs(color[1] - pal[pi][1]) +
          Math.abs(color[2] - pal[pi][2]);
        if (d < minDist) {
          minDist = d;
          closest = pal[pi];
        }
      }
      r = closest[0];
      g = closest[1];
      b = closest[2];
    } else {
      // Monochrome — handled separately in drawFrame
      return null;
    }

    // Apply charTint blending
    if (tint !== 1) {
      var base = hexToRgb(cfg.charColor);
      r = Math.min(255, Math.floor(r * tint + base[0] * (1 - tint)));
      g = Math.min(255, Math.floor(g * tint + base[1] * (1 - tint)));
      b = Math.min(255, Math.floor(b * tint + base[2] * (1 - tint)));
    }

    return [r, g, b, a];
  }

  // ── Image loading & pixel processing ─────────────────────────────────────
  var valueMap = [];
  var colorMap = [];
  var imgWidth = 0;
  var imgHeight = 0;
  var imageReady = false;

  var img = new Image();
  img.crossOrigin = "anonymous";
  img.src = cfg.imageUrl;

  img.onload = function () {
    var width = cfg.size;
    var aspect = img.width / img.height;
    var height = Math.floor(width / aspect);

    imgWidth = width;
    imgHeight = height;

    var tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = width * charSamples;
    tmpCanvas.height = height * charSamples;
    var tmpCtx = tmpCanvas.getContext("2d");
    if (!tmpCtx) return;

    tmpCtx.drawImage(img, 0, 0, width * charSamples, height * charSamples);

    var imageData = tmpCtx.getImageData(
      0,
      0,
      width * charSamples,
      height * charSamples,
    );
    var data = imageData.data;
    var rowLength = width * charSamples * 4;

    valueMap = [];
    colorMap = [];
    for (var cellY = 0; cellY < height; cellY++) {
      for (var cellX = 0; cellX < width; cellX++) {
        var cell = [];
        var pos = cellX * charSamples * 4 + cellY * charSamples * rowLength;
        colorMap.push([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
        for (var posY = 0; posY < charSamples; posY++) {
          for (var posX = 0; posX < charSamples; posX++) {
            var pixelPos =
              (cellX * charSamples + posX) * 4 +
              (cellY * charSamples + posY) * rowLength;
            var alphaChannel = data[pixelPos + 3] / 255;
            var r = data[pixelPos];
            var g = data[pixelPos + 1];
            var b = data[pixelPos + 2];
            var val =
              1 - (((r + g + b) / 765) * alphaChannel + 1 - alphaChannel);
            cell.push(val);
          }
        }
        valueMap.push(cell);
      }
    }

    imageReady = true;
  };

  img.onerror = function () {
    console.error("[FultonASCII-Image] Failed to load image: " + cfg.imageUrl);
  };

  // ── Normalize value map with contrast + brightness ───────────────────────
  function buildNormalizedMap(brightnessOffset) {
    if (valueMap.length === 0) return [];

    var min = 1,
      max = 0;
    for (var i = 0; i < valueMap.length; i++) {
      for (var j = 0; j < valueMap[i].length; j++) {
        var v = valueMap[i][j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }

    var result = [];
    if (max > 0 && min !== max) {
      var diff = max - min;
      for (var i = 0; i < valueMap.length; i++) {
        var normals = [];
        for (var j = 0; j < valueMap[i].length; j++) {
          var n = (valueMap[i][j] - min) * (1 / diff);
          n = (cfg.contrast + 1) * (n - 0.5) + 0.5 + brightnessOffset;
          if (n < 0) n = 0;
          if (n > 1) n = 1;
          normals.push(n);
        }
        result.push(normals);
      }
    } else {
      for (var i = 0; i < valueMap.length; i++) {
        result.push(valueMap[i].slice());
      }
    }
    return result;
  }

  // ── Draw one frame to canvas ─────────────────────────────────────────────
  function drawFrame(brightnessOffset) {
    if (!imageReady) return;

    var normalizedMap = buildNormalizedMap(brightnessOffset);
    if (normalizedMap.length === 0) return;

    var rect = container.getBoundingClientRect();
    var containerW = rect.width;
    var containerH = rect.height;
    if (containerW === 0 || containerH === 0) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cellSize = (containerW / imgWidth) * dpr;
    var displayW = containerW * dpr;
    var displayH = cellSize * imgHeight;

    // Resize canvas backing store only when needed
    var neededW = Math.ceil(displayW);
    var neededH = Math.ceil(displayH);
    if (canvas.width !== neededW || canvas.height !== neededH) {
      canvas.width = neededW;
      canvas.height = neededH;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, neededW, neededH);

    // Background
    if (!cfg.transparentBg) {
      ctx.fillStyle = cfg.bgColor;
      ctx.fillRect(0, 0, neededW, neededH);
    }

    // Font
    ctx.font = cfg.fontWeight + " " + cellSize + "px 'Courier New', monospace";
    ctx.textBaseline = "top";

    var isMonochrome = cfg.colorPalette === "none";
    if (isMonochrome) ctx.fillStyle = cfg.charColor;

    // Draw characters
    for (var cellY = 0; cellY < imgHeight; cellY++) {
      for (var cellX = 0; cellX < imgWidth; cellX++) {
        var index = cellX + cellY * imgWidth;
        var values = normalizedMap[index];
        var char = getClosestChar(values);
        var color = colorMap[index];
        // Skip transparent pixels (alpha < 10)
        if (char !== " " && color[3] >= 10) {
          if (!isMonochrome) {
            // Average normalized value as brightness for opacity mode
            var br = 0;
            for (var vi = 0; vi < values.length; vi++) br += values[vi];
            br = br / values.length;
            var rgba = getCharRgba(colorMap[index], br);
            if (rgba) {
              ctx.fillStyle =
                "rgba(" +
                rgba[0] +
                "," +
                rgba[1] +
                "," +
                rgba[2] +
                "," +
                rgba[3] +
                ")";
            }
          }
          ctx.fillText(char, cellX * cellSize, cellY * cellSize);
        }
      }
    }
  }

  // ── Animation loop ───────────────────────────────────────────────────────
  var rafId = null;
  var isVisible = true;
  var animStartTime = 0;

  function animate(now) {
    rafId = requestAnimationFrame(animate);

    if (!imageReady) return;

    var brightnessOffset = cfg.brightness;

    if (cfg.animationEnabled) {
      if (!animStartTime) animStartTime = now;
      var elapsed = now - animStartTime;
      var progress = (elapsed % cfg.animationDuration) / cfg.animationDuration;
      var sineValue = Math.sin(progress * Math.PI * 2 + cfg.animationPhase);
      brightnessOffset =
        cfg.brightnessMin +
        ((sineValue + 1) / 2) * (cfg.brightnessMax - cfg.brightnessMin);
    }

    drawFrame(brightnessOffset);
  }

  // ── Visibility observer — pause when off-screen ──────────────────────────
  if (typeof IntersectionObserver !== "undefined") {
    var observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting && !isVisible) {
            isVisible = true;
            animStartTime = 0;
            rafId = requestAnimationFrame(animate);
          } else if (!entries[i].isIntersecting && isVisible) {
            isVisible = false;
            if (rafId) cancelAnimationFrame(rafId);
          }
        }
      },
      { threshold: 0.01 },
    );
    observer.observe(container);
  }

  // ── Start ────────────────────────────────────────────────────────────────
  rafId = requestAnimationFrame(animate);

  return { canvas: canvas, cfg: cfg };
}

// ─── Initialize (EDIT THESE) ─────────────────────────────────────────────────

// const images = {
//   "#product-1": "url",
//   "#product-2": "url",
//   "#product-3": "url",
// };

// Object.entries(images).forEach(([selector, imageUrl]) => {
//   initAsciiImage(selector, {
//     imageUrl: imageUrl,
//     size: 80,
//   brightness: -0.4,
//   contrast: 0,
//     charColor: "#ffffff",
//     // bgColor: "#ffffff",
//     bgColor: "#132F25",
//     colorPalette: "color",
//     charTint: 1,
//     // transparentBg: false,
//     animationEnabled: true,
//     animationDuration: 10000,
//   brightnessMin: -0.4,
//   brightnessMax: 0,
//   });
// });

// Color palette: "none" (monochrome), "opacity" (single color, variable alpha),
// "grey2bit", "grey4bit", "grey8bit", "color3bit", "color4bit", "color" (full)

// initAsciiImage("#ascii-image", {
//   imageUrl: "/product-1.png",
//   size: 120,
//   brightness: -0.4,
//   contrast: 0,
//   charColor: "#ffffff",
//   // bgColor: "#ffffff",
//   bgColor: "#132F25",
//   colorPalette: "opacity-inverse",
//   charTint: 0,
//   transparentBg: false,
//   animationEnabled: true,
//   animationDuration: 10000,
//   brightnessMin: -0.4,
//   brightnessMax: 0,
// });
