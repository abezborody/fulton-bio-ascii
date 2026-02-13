/*
 * Fulton ASCII 3D Scene — Webflow-ready, self-contained
 *
 * NOTHING needed in <head>. This file loads Three.js + GLTFLoader automatically.
 * Host this file anywhere (Webflow Assets, CDN, etc.) and reference it once.
 *
 * WEBFLOW USAGE:
 * 1. Upload this .js file to Webflow Assets (or host on any CDN).
 * 2. In Webflow Project Settings → Custom Code → Footer Code, add:
 *      <script src="https://your-cdn.com/scene-webflow.js"></script>
 * 3. On the page, add an Embed element where you want the scene, containing:
 *      <div id="cancer-cell" style="width:100%;height:100vh"></div>
 *      <script>
 *        FultonASCII.ready.then(function() {
 *          FultonASCII.initScene("#cancer-cell", { asciiFontSize: 10 });
 *        });
 *      </script>
 *
 * OPTIONS (all optional — sensible defaults provided):
 *   modelUrl, autoRotate, rotationSpeed, backgroundColor,
 *   brightness, contrast, asciiEnabled, asciiResolution,
 *   asciiFontSize, asciiCharSet, circleEnabled, circleRadius,
 *   circleSpeed, subdivisionIterations
 */

(function () {
  "use strict";

  // ─── Dynamic script loader ──────────────────────────────────────────────────

  // Single combined URL — jsdelivr merges files into one HTTP request
  var THREE_COMBINED_URL =
    "https://cdn.jsdelivr.net/combine/" +
    "npm/three@0.147.0/build/three.min.js," +
    "npm/three@0.147.0/examples/js/loaders/GLTFLoader.js," +
    "npm/three@0.147.0/examples/js/loaders/DRACOLoader.js";

  // Preload removed — it competes for bandwidth and doesn't help with cross-origin
  // THREE.js will be fetched only when THREEJSASCII.load() is called

  // Lazy loader — only loads when container is near viewport
  function lazyLoadThree() {
    return new Promise(function (resolve, reject) {
      if (typeof THREE !== "undefined" && THREE.GLTFLoader) {
        return resolve();
      }
      var s = document.createElement("script");
      s.src = THREE_COMBINED_URL;
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = function () {
        reject(
          new Error("[THREEJSASCII] Failed to load: " + THREE_COMBINED_URL),
        );
      };
      document.head.appendChild(s);
    });
  }

  // Load THREE + GLTFLoader immediately when ready is accessed (hero section use case)
  var _ready = new Promise(function (resolve) {
    // Load during idle time to not block main thread
    var loadTask = function () {
      lazyLoadThree()
        .then(function () {
          console.log("[THREEJSASCII] Three.js + GLTFLoader ready");
          resolve();
        })
        .catch(function (err) {
          console.error(err);
          resolve(); // Resolve anyway to prevent hanging
        });
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(loadTask, { timeout: 2000 });
    } else {
      setTimeout(loadTask, 0);
    }
  });

  // ─── Default parameters ─────────────────────────────────────────────────────
  var DEFAULTS = {
    modelUrl:
      "https://cdn.prod.website-files.com/69823aa904992b6320d75fe8/698da57c215254412e7df2b3_cell.glb.txt",
    autoRotate: true,
    rotationSpeed: 0.002,
    backgroundColor: "#ffffff",
    brightness: 0.5,
    contrast: 2,
    asciiEnabled: true,
    asciiResolution: 0.27,
    asciiFontSize: 10,
    asciiCharSet: " .:-=+*#%@",
    circleEnabled: true,
    circleRadius: 0.2,
    circleSpeed: (Math.PI * 2) / 8,
    // Fade-in duration in seconds
    fadeInDuration: 1.2,
  };

  // ─── Scene factory ──────────────────────────────────────────────────────────

  function initScene(selector, options) {
    if (!options) options = {};
    var container = document.querySelector(selector);
    if (!container) {
      console.error('[FultonASCII] Container not found: "' + selector + '"');
      return null;
    }

    var cfg = {};
    var key;
    for (key in DEFAULTS) cfg[key] = DEFAULTS[key];
    for (key in options) cfg[key] = options[key];

    var computedStyle = window.getComputedStyle(container);
    if (computedStyle.position === "static") {
      container.style.position = "relative";
    }
    container.style.overflow = "hidden";

    function getSize() {
      var rect = container.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }

    var sz = getSize();
    var width = sz.width;
    var height = sz.height;

    // Scene (no background — transparent)
    var scene = new THREE.Scene();

    // Capture initial DPR — cap at 2 to keep pixel count manageable on 4K/Retina
    var initDPR = Math.min(window.devicePixelRatio || 1, 2);
    var baseW = width * initDPR;
    var baseH = height * initDPR;

    // Camera
    var camera = new THREE.PerspectiveCamera(75, baseW / baseH, 0.1, 1000);
    camera.position.z = 5;

    // Offscreen renderer — sized to ASCII grid (no need for full resolution)
    var renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;

    // 2D ASCII canvas — fixed resolution, immune to page zoom
    var asciiCanvas = document.createElement("canvas");
    var asciiCtx = asciiCanvas.getContext("2d");
    asciiCanvas.style.position = "absolute";
    asciiCanvas.style.top = "15%";
    asciiCanvas.style.left = "30%";
    asciiCanvas.style.width = "100%";
    asciiCanvas.style.height = "100%";
    asciiCanvas.width = baseW;
    asciiCanvas.height = baseH;
    container.appendChild(asciiCanvas);

    // Fixed ASCII grid — never changes
    var fontSize = cfg.asciiFontSize * initDPR;
    var cellW = fontSize * 0.6;
    var cellH = fontSize;
    var fixedCols = Math.floor(baseW / cellW);
    var fixedRows = Math.floor(baseH / cellH);

    // Offscreen renderer sized to ASCII grid — readPixels reads only what we need
    var renderW = fixedCols;
    var renderH = fixedRows;
    renderer.setSize(renderW, renderH, false);

    // Fade-in duration from options (default 1.2s)
    var fadeInDuration = cfg.fadeInDuration;
    var modelReady = false;
    asciiCanvas.style.opacity = "0";
    asciiCanvas.style.transition =
      "opacity " + fadeInDuration + "s cubic-bezier(0.33, 1, 0.68, 1)";

    // Lighting
    var ambientLight = new THREE.AmbientLight(0xffffff, cfg.brightness);
    scene.add(ambientLight);

    var mainLight = new THREE.DirectionalLight(0xffffff, 1.5 * cfg.contrast);
    mainLight.position.set(5, 15, 8);
    mainLight.castShadow = false;
    scene.add(mainLight);

    var fillLight = new THREE.DirectionalLight(0xffffff, 0.8 * cfg.contrast);
    fillLight.position.set(-8, 5, 3);
    scene.add(fillLight);

    var backLight = new THREE.DirectionalLight(0xffffff, 0.6 * cfg.contrast);
    backLight.position.set(0, 5, -10);
    scene.add(backLight);

    // Model
    var loader = new THREE.GLTFLoader();
    var dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    loader.setDRACOLoader(dracoLoader);
    var model = null;

    loader.load(
      cfg.modelUrl,
      function (gltf) {
        model = gltf.scene;
        scene.add(model);

        var box = new THREE.Box3().setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var initialScale = 5 / maxDim;
        model.scale.multiplyScalar(initialScale);

        model.traverse(function (child) {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        // Trigger fade-in after model is ready
        modelReady = true;
        asciiCanvas.style.opacity = "1";

        // Hide placeholder if exists
        var placeholder = document.getElementById("three-placeholder");
        if (placeholder) placeholder.style.display = "none";
      },
      function (xhr) {
        if (xhr.total) {
          console.log(
            "[FultonASCII] " +
              selector +
              ": " +
              ((xhr.loaded / xhr.total) * 100).toFixed(1) +
              "% loaded",
          );
        }
      },
      function (error) {
        console.error(
          "[FultonASCII] " + selector + ": Model load error:",
          error,
        );
      },
    );

    // ASCII rendering — renderer is already sized to grid, 1 pixel = 1 cell
    var pixelBuf = null;
    var pixelBufSize = 0;

    function renderASCII() {
      if (!cfg.asciiEnabled) return;

      var w = renderW;
      var h = renderH;
      var gl = renderer.getContext();

      var needed = w * h * 4;
      if (needed !== pixelBufSize) {
        pixelBuf = new Uint8Array(needed);
        pixelBufSize = needed;
      }
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuf);

      var cw = asciiCanvas.width;
      var ch = asciiCanvas.height;

      asciiCtx.clearRect(0, 0, cw, ch);

      asciiCtx.font = fontSize + "px monospace";
      asciiCtx.textBaseline = "top";

      var charSet = cfg.asciiCharSet;
      var drawCellW = cw / fixedCols;
      var drawCellH = ch / fixedRows;

      // Build full row strings per color bucket, then draw row-by-row
      // This reduces fillText calls from (cols*rows) to (rows*2)
      var darkRows = new Array(fixedRows);
      var lightRows = new Array(fixedRows);
      for (var r = 0; r < fixedRows; r++) {
        darkRows[r] = "";
        lightRows[r] = "";
      }

      for (var row = 0; row < h && row < fixedRows; row++) {
        var flippedRow = h - 1 - row;
        var darkStr = "";
        var lightStr = "";
        for (var col = 0; col < w && col < fixedCols; col++) {
          var i = (flippedRow * w + col) * 4;
          var rv = pixelBuf[i];
          var gv = pixelBuf[i + 1];
          var bv = pixelBuf[i + 2];
          var av = pixelBuf[i + 3];

          if (av < 10) {
            darkStr += " ";
            lightStr += " ";
            continue;
          }

          var brightness = (rv * 0.299 + gv * 0.587 + bv * 0.114) / 255;

          if (brightness >= 0.9) {
            darkStr += " ";
            lightStr += " ";
          } else {
            var charIndex = Math.floor((1 - brightness) * (charSet.length - 1));
            var ch2 = charSet[charIndex] || " ";
            if (brightness < 0.5) {
              darkStr += ch2;
              lightStr += " ";
            } else {
              darkStr += " ";
              lightStr += ch2;
            }
          }
        }
        darkRows[row] = darkStr;
        lightRows[row] = lightStr;
      }

      // Draw dark rows
      asciiCtx.fillStyle = "black";
      for (var r = 0; r < fixedRows; r++) {
        if (darkRows[r].trim()) {
          asciiCtx.fillText(darkRows[r], 0, r * drawCellH);
        }
      }

      // Draw light rows
      asciiCtx.fillStyle = "#808080";
      for (var r = 0; r < fixedRows; r++) {
        if (lightRows[r].trim()) {
          asciiCtx.fillText(lightRows[r], 0, r * drawCellH);
        }
      }
    }

    // Animation loop with visibility-aware scheduling
    var circleTime = 0;
    var lastFrameTime = 0;
    var rafId = null;
    var isVisible = true;

    function animate(now) {
      rafId = requestAnimationFrame(animate);

      // Delta time in seconds for frame-rate-independent animation
      var dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0.016;
      lastFrameTime = now;

      if (cfg.autoRotate) {
        scene.rotation.y += cfg.rotationSpeed;
      }

      if (cfg.circleEnabled && model) {
        circleTime += dt;
        var angle = circleTime * cfg.circleSpeed;
        model.position.x = (Math.cos(angle) * cfg.circleRadius) / 2;
        model.position.y = Math.sin(angle) * cfg.circleRadius;
      }

      renderer.render(scene, camera);
      if (modelReady) renderASCII();
    }

    // Pause when off-screen to save GPU/CPU
    if (typeof IntersectionObserver !== "undefined") {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
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

    return { scene: scene, camera: camera, renderer: renderer, cfg: cfg };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  window.THREEJSASCII = {
    ready: _ready,
    initScene: initScene,
    DEFAULTS: DEFAULTS,
  };

  // Auto-init removed - use THREEJSASCII.ready.then() to initialize
})();
