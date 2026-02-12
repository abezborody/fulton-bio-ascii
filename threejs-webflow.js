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

  // Single combined URL — jsdelivr merges both files into one HTTP request
  var THREE_COMBINED_URL =
    "https://cdn.jsdelivr.net/combine/" +
    "npm/three@0.147.0/build/three.min.js," +
    "npm/three@0.147.0/examples/js/loaders/GLTFLoader.js";

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("[FultonASCII] Failed to load: " + url));
      };
      document.head.appendChild(s);
    });
  }

  // Load THREE + GLTFLoader in a single request
  var _ready = (function () {
    // If both are already on the page, skip loading entirely
    if (typeof THREE !== "undefined" && THREE.GLTFLoader) {
      return Promise.resolve();
    }

    return loadScript(THREE_COMBINED_URL)
      .then(function () {
        console.log("[FultonASCII] Three.js + GLTFLoader ready");
      })
      .catch(function (err) {
        console.error(err);
      });
  })();

  // ─── LoopSubdivision (inlined from three-subdivide@1.1.5, MIT License) ──────
  // Original: https://github.com/stevinz/three-subdivide
  // Author: Stephens Nunnally <@stevinz>
  // Converted from ES module to use THREE global for Webflow compatibility.

  function _buildLoopSubdivision() {
    var POSITION_DECIMALS = 2;

    var _average = new THREE.Vector3();
    var _center = new THREE.Vector3();
    var _midpoint = new THREE.Vector3();
    var _normal = new THREE.Vector3();
    var _temp = new THREE.Vector3();

    var _vector0 = new THREE.Vector3();
    var _vector1 = new THREE.Vector3();
    var _vector2 = new THREE.Vector3();
    var _vec0to1 = new THREE.Vector3();
    var _vec1to2 = new THREE.Vector3();
    var _vec2to0 = new THREE.Vector3();

    var _position = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ];

    var _vertex = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ];

    var _triangle = new THREE.Triangle();

    var _positionShift = Math.pow(10, POSITION_DECIMALS);

    function fuzzy(a, b, tolerance) {
      if (tolerance === undefined) tolerance = 0.00001;
      return a < b + tolerance && a > b - tolerance;
    }

    function hashFromNumber(num, shift) {
      if (shift === undefined) shift = _positionShift;
      var roundedNumber = round(num * shift);
      if (roundedNumber == 0) roundedNumber = 0;
      return "" + roundedNumber;
    }

    function hashFromVector(vector, shift) {
      if (shift === undefined) shift = _positionShift;
      return (
        hashFromNumber(vector.x, shift) +
        "," +
        hashFromNumber(vector.y, shift) +
        "," +
        hashFromNumber(vector.z, shift)
      );
    }

    function lerp(x, y, t) {
      return (1 - t) * x + t * y;
    }

    function round(x) {
      return (x + (x > 0 ? 0.5 : -0.5)) << 0;
    }

    function calcNormal(target, vec1, vec2, vec3) {
      _temp.subVectors(vec1, vec2);
      target.subVectors(vec2, vec3);
      target.cross(_temp).normalize();
    }

    function gatherAttributes(geometry) {
      var desired = ["position", "normal", "uv"];
      var contains = Object.keys(geometry.attributes);
      var attributeList = Array.from(new Set(desired.concat(contains)));
      return attributeList;
    }

    function setTriangle(positions, index, step, vec0, vec1, vec2) {
      if (step >= 1) {
        positions[index + 0 + step * 0] = vec0.x;
        positions[index + 0 + step * 1] = vec1.x;
        positions[index + 0 + step * 2] = vec2.x;
      }
      if (step >= 2) {
        positions[index + 1 + step * 0] = vec0.y;
        positions[index + 1 + step * 1] = vec1.y;
        positions[index + 1 + step * 2] = vec2.y;
      }
      if (step >= 3) {
        positions[index + 2 + step * 0] = vec0.z;
        positions[index + 2 + step * 1] = vec1.z;
        positions[index + 2 + step * 2] = vec2.z;
      }
      if (step >= 4) {
        positions[index + 3 + step * 0] = vec0.w;
        positions[index + 3 + step * 1] = vec1.w;
        positions[index + 3 + step * 2] = vec2.w;
      }
    }

    function verifyGeometry(geometry) {
      if (geometry === undefined) {
        console.warn("LoopSubdivision: Geometry provided is undefined");
        return false;
      }
      if (!geometry.isBufferGeometry) {
        console.warn(
          "LoopSubdivision: Geometry provided is not 'BufferGeometry' type",
        );
        return false;
      }
      if (geometry.attributes.position === undefined) {
        console.warn(
          "LoopSubdivision: Geometry provided missing required 'position' attribute",
        );
        return false;
      }
      if (geometry.attributes.normal === undefined) {
        geometry.computeVertexNormals();
      }
      return true;
    }

    function modify(bufferGeometry, iterations, params) {
      if (iterations === undefined) iterations = 1;
      if (typeof params !== "object" || params === null) params = {};

      if (params.split === undefined) params.split = true;
      if (params.uvSmooth === undefined) params.uvSmooth = false;
      if (params.preserveEdges === undefined) params.preserveEdges = false;
      if (params.flatOnly === undefined) params.flatOnly = false;
      if (params.maxTriangles === undefined) params.maxTriangles = Infinity;
      if (params.weight === undefined) params.weight = 1;
      if (isNaN(params.weight) || !isFinite(params.weight)) params.weight = 1;
      params.weight = Math.max(0, Math.min(1, params.weight));

      if (!verifyGeometry(bufferGeometry)) return bufferGeometry;
      var modifiedGeometry = bufferGeometry.clone();

      if (params.split) {
        var splitGeometry = edgeSplit(modifiedGeometry);
        modifiedGeometry.dispose();
        modifiedGeometry = splitGeometry;
      }

      for (var i = 0; i < iterations; i++) {
        var currentTriangles = modifiedGeometry.attributes.position.count / 3;
        if (currentTriangles < params.maxTriangles) {
          var subdividedGeometry;
          if (params.flatOnly) {
            subdividedGeometry = flat(modifiedGeometry, params);
          } else {
            subdividedGeometry = smooth(modifiedGeometry, params);
          }
          modifiedGeometry.groups.forEach(function (group) {
            subdividedGeometry.addGroup(
              group.start * 4,
              group.count * 4,
              group.materialIndex,
            );
          });
          modifiedGeometry.dispose();
          modifiedGeometry = subdividedGeometry;
        }
      }

      return modifiedGeometry;
    }

    function edgeSplit(geometry) {
      if (!verifyGeometry(geometry)) return geometry;
      var existing =
        geometry.index !== null ? geometry.toNonIndexed() : geometry.clone();
      var split = new THREE.BufferGeometry();

      var attributeList = gatherAttributes(existing);
      var vertexCount = existing.attributes.position.count;
      var posAttribute = existing.getAttribute("position");
      var norAttribute = existing.getAttribute("normal");
      var edgeHashToTriangle = {};
      var triangleEdgeHashes = [];
      var edgeLength = {};
      var triangleExist = [];

      for (var i = 0; i < vertexCount; i += 3) {
        _vector0.fromBufferAttribute(posAttribute, i + 0);
        _vector1.fromBufferAttribute(posAttribute, i + 1);
        _vector2.fromBufferAttribute(posAttribute, i + 2);
        _normal.fromBufferAttribute(norAttribute, i);
        var vecHash0 = hashFromVector(_vector0);
        var vecHash1 = hashFromVector(_vector1);
        var vecHash2 = hashFromVector(_vector2);

        var triangleSize = _triangle
          .set(_vector0, _vector1, _vector2)
          .getArea();
        triangleExist.push(!fuzzy(triangleSize, 0));
        if (!triangleExist[i / 3]) {
          triangleEdgeHashes.push([]);
          continue;
        }

        calcNormal(_normal, _vector0, _vector1, _vector2);
        var normalHash = hashFromVector(_normal);

        var hashes = [
          vecHash0 + "_" + vecHash1 + "_" + normalHash,
          vecHash1 + "_" + vecHash0 + "_" + normalHash,
          vecHash1 + "_" + vecHash2 + "_" + normalHash,
          vecHash2 + "_" + vecHash1 + "_" + normalHash,
          vecHash2 + "_" + vecHash0 + "_" + normalHash,
          vecHash0 + "_" + vecHash2 + "_" + normalHash,
        ];

        var index = i / 3;
        for (var j = 0; j < hashes.length; j++) {
          if (!edgeHashToTriangle[hashes[j]])
            edgeHashToTriangle[hashes[j]] = [];
          edgeHashToTriangle[hashes[j]].push(index);
          if (!edgeLength[hashes[j]]) {
            if (j === 0 || j === 1)
              edgeLength[hashes[j]] = _vector0.distanceTo(_vector1);
            if (j === 2 || j === 3)
              edgeLength[hashes[j]] = _vector1.distanceTo(_vector2);
            if (j === 4 || j === 5)
              edgeLength[hashes[j]] = _vector2.distanceTo(_vector0);
          }
        }
        triangleEdgeHashes.push([hashes[0], hashes[2], hashes[4]]);
      }

      attributeList.forEach(function (attributeName) {
        var attribute = existing.getAttribute(attributeName);
        if (!attribute) return;
        var floatArray = splitAttribute(attribute, attributeName);
        split.setAttribute(
          attributeName,
          new THREE.BufferAttribute(floatArray, attribute.itemSize),
        );
      });

      var morphAttributes = existing.morphAttributes;
      for (var attributeName in morphAttributes) {
        var array = [];
        var morphAttribute = morphAttributes[attributeName];
        for (var mi = 0, l = morphAttribute.length; mi < l; mi++) {
          if (morphAttribute[mi].count !== vertexCount) continue;
          var floatArray = splitAttribute(
            morphAttribute[mi],
            attributeName,
            true,
          );
          array.push(
            new THREE.BufferAttribute(floatArray, morphAttribute[mi].itemSize),
          );
        }
        split.morphAttributes[attributeName] = array;
      }
      split.morphTargetsRelative = existing.morphTargetsRelative;

      existing.dispose();
      return split;

      function splitAttribute(attribute, attributeName, morph) {
        if (morph === undefined) morph = false;
        var newTriangles = 4;
        var arrayLength = vertexCount * attribute.itemSize * newTriangles;
        var floatArray = new attribute.array.constructor(arrayLength);

        var processGroups =
          attributeName === "position" && !morph && existing.groups.length > 0;
        var groupStart, groupMaterial;

        var idx = 0;
        var skipped = 0;
        var step = attribute.itemSize;
        for (var i = 0; i < vertexCount; i += 3) {
          if (!triangleExist[i / 3]) {
            skipped += 3;
            continue;
          }

          _vector0.fromBufferAttribute(attribute, i + 0);
          _vector1.fromBufferAttribute(attribute, i + 1);
          _vector2.fromBufferAttribute(attribute, i + 2);

          var existingIndex = i / 3;
          var edgeHash0to1 = triangleEdgeHashes[existingIndex][0];
          var edgeHash1to2 = triangleEdgeHashes[existingIndex][1];
          var edgeHash2to0 = triangleEdgeHashes[existingIndex][2];

          var edgeCount0to1 = edgeHashToTriangle[edgeHash0to1].length;
          var edgeCount1to2 = edgeHashToTriangle[edgeHash1to2].length;
          var edgeCount2to0 = edgeHashToTriangle[edgeHash2to0].length;
          var sharedCount = edgeCount0to1 + edgeCount1to2 + edgeCount2to0 - 3;

          var loopStartIndex = (idx * 3) / step / 3;

          if (sharedCount === 0) {
            setTriangle(floatArray, idx, step, _vector0, _vector1, _vector2);
            idx += step * 3;
          } else {
            var length0to1 = edgeLength[edgeHash0to1];
            var length1to2 = edgeLength[edgeHash1to2];
            var length2to0 = edgeLength[edgeHash2to0];

            if (
              (length0to1 > length1to2 || edgeCount1to2 <= 1) &&
              (length0to1 > length2to0 || edgeCount2to0 <= 1) &&
              edgeCount0to1 > 1
            ) {
              _center.copy(_vector0).add(_vector1).divideScalar(2.0);
              if (edgeCount2to0 > 1) {
                _midpoint.copy(_vector2).add(_vector0).divideScalar(2.0);
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _vector0,
                  _center,
                  _midpoint,
                );
                idx += step * 3;
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _center,
                  _vector2,
                  _midpoint,
                );
                idx += step * 3;
              } else {
                setTriangle(floatArray, idx, step, _vector0, _center, _vector2);
                idx += step * 3;
              }
              if (edgeCount1to2 > 1) {
                _midpoint.copy(_vector1).add(_vector2).divideScalar(2.0);
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _center,
                  _vector1,
                  _midpoint,
                );
                idx += step * 3;
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _midpoint,
                  _vector2,
                  _center,
                );
                idx += step * 3;
              } else {
                setTriangle(floatArray, idx, step, _vector1, _vector2, _center);
                idx += step * 3;
              }
            } else if (
              (length1to2 > length2to0 || edgeCount2to0 <= 1) &&
              edgeCount1to2 > 1
            ) {
              _center.copy(_vector1).add(_vector2).divideScalar(2.0);
              if (edgeCount0to1 > 1) {
                _midpoint.copy(_vector0).add(_vector1).divideScalar(2.0);
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _center,
                  _midpoint,
                  _vector1,
                );
                idx += step * 3;
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _midpoint,
                  _center,
                  _vector0,
                );
                idx += step * 3;
              } else {
                setTriangle(floatArray, idx, step, _vector1, _center, _vector0);
                idx += step * 3;
              }
              if (edgeCount2to0 > 1) {
                _midpoint.copy(_vector2).add(_vector0).divideScalar(2.0);
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _center,
                  _vector2,
                  _midpoint,
                );
                idx += step * 3;
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _midpoint,
                  _vector0,
                  _center,
                );
                idx += step * 3;
              } else {
                setTriangle(floatArray, idx, step, _vector2, _vector0, _center);
                idx += step * 3;
              }
            } else if (edgeCount2to0 > 1) {
              _center.copy(_vector2).add(_vector0).divideScalar(2.0);
              if (edgeCount1to2 > 1) {
                _midpoint.copy(_vector1).add(_vector2).divideScalar(2.0);
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _vector2,
                  _center,
                  _midpoint,
                );
                idx += step * 3;
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _center,
                  _vector1,
                  _midpoint,
                );
                idx += step * 3;
              } else {
                setTriangle(floatArray, idx, step, _vector2, _center, _vector1);
                idx += step * 3;
              }
              if (edgeCount0to1 > 1) {
                _midpoint.copy(_vector0).add(_vector1).divideScalar(2.0);
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _vector0,
                  _midpoint,
                  _center,
                );
                idx += step * 3;
                setTriangle(
                  floatArray,
                  idx,
                  step,
                  _midpoint,
                  _vector1,
                  _center,
                );
                idx += step * 3;
              } else {
                setTriangle(floatArray, idx, step, _vector0, _vector1, _center);
                idx += step * 3;
              }
            } else {
              setTriangle(floatArray, idx, step, _vector0, _vector1, _vector2);
              idx += step * 3;
            }
          }

          if (processGroups) {
            existing.groups.forEach(function (group) {
              if (group.start === i - skipped) {
                if (groupStart !== undefined && groupMaterial !== undefined) {
                  split.addGroup(
                    groupStart,
                    loopStartIndex - groupStart,
                    groupMaterial,
                  );
                }
                groupStart = loopStartIndex;
                groupMaterial = group.materialIndex;
              }
            });
          }
          skipped = 0;
        }

        var reducedCount = (idx * 3) / step;
        var reducedArray = new attribute.array.constructor(reducedCount);
        for (var ri = 0; ri < reducedCount; ri++) {
          reducedArray[ri] = floatArray[ri];
        }

        if (
          processGroups &&
          groupStart !== undefined &&
          groupMaterial !== undefined
        ) {
          split.addGroup(
            groupStart,
            (idx * 3) / step / 3 - groupStart,
            groupMaterial,
          );
        }

        return reducedArray;
      }
    }

    function flat(geometry, params) {
      if (typeof params !== "object" || params === null) params = {};
      if (!verifyGeometry(geometry)) return geometry;
      var existing =
        geometry.index !== null ? geometry.toNonIndexed() : geometry.clone();
      var loop = new THREE.BufferGeometry();

      var attributeList = gatherAttributes(existing);
      var vertexCount = existing.attributes.position.count;

      attributeList.forEach(function (attributeName) {
        var attribute = existing.getAttribute(attributeName);
        if (!attribute) return;
        loop.setAttribute(
          attributeName,
          flatAttribute(attribute, vertexCount, params),
        );
      });

      var morphAttributes = existing.morphAttributes;
      for (var attributeName in morphAttributes) {
        var array = [];
        var morphAttribute = morphAttributes[attributeName];
        for (var i = 0, l = morphAttribute.length; i < l; i++) {
          if (morphAttribute[i].count !== vertexCount) continue;
          array.push(flatAttribute(morphAttribute[i], vertexCount, params));
        }
        loop.morphAttributes[attributeName] = array;
      }
      loop.morphTargetsRelative = existing.morphTargetsRelative;

      existing.dispose();
      return loop;
    }

    function flatAttribute(attribute, vertexCount, params) {
      var newTriangles = 4;
      var arrayLength = vertexCount * attribute.itemSize * newTriangles;
      var floatArray = new attribute.array.constructor(arrayLength);

      var index = 0;
      var step = attribute.itemSize;
      for (var i = 0; i < vertexCount; i += 3) {
        _vector0.fromBufferAttribute(attribute, i + 0);
        _vector1.fromBufferAttribute(attribute, i + 1);
        _vector2.fromBufferAttribute(attribute, i + 2);

        _vec0to1.copy(_vector0).add(_vector1).divideScalar(2.0);
        _vec1to2.copy(_vector1).add(_vector2).divideScalar(2.0);
        _vec2to0.copy(_vector2).add(_vector0).divideScalar(2.0);

        setTriangle(floatArray, index, step, _vector0, _vec0to1, _vec2to0);
        index += step * 3;
        setTriangle(floatArray, index, step, _vector1, _vec1to2, _vec0to1);
        index += step * 3;
        setTriangle(floatArray, index, step, _vector2, _vec2to0, _vec1to2);
        index += step * 3;
        setTriangle(floatArray, index, step, _vec0to1, _vec1to2, _vec2to0);
        index += step * 3;
      }

      return new THREE.BufferAttribute(floatArray, attribute.itemSize);
    }

    function smooth(geometry, params) {
      if (typeof params !== "object" || params === null) params = {};
      if (params.uvSmooth === undefined) params.uvSmooth = false;
      if (params.preserveEdges === undefined) params.preserveEdges = false;

      if (!verifyGeometry(geometry)) return geometry;
      var existing =
        geometry.index !== null ? geometry.toNonIndexed() : geometry.clone();
      var flatGeo = flat(existing, params);
      var loop = new THREE.BufferGeometry();

      var attributeList = gatherAttributes(existing);
      var vertexCount = existing.attributes.position.count;
      var posAttribute = existing.getAttribute("position");
      var flatPosition = flatGeo.getAttribute("position");
      var hashToIndex = {};
      var existingNeighbors = {};
      var flatOpposites = {};
      var existingEdges = {};

      function addNeighbor(posHash, neighborHash, index) {
        if (!existingNeighbors[posHash]) existingNeighbors[posHash] = {};
        if (!existingNeighbors[posHash][neighborHash])
          existingNeighbors[posHash][neighborHash] = [];
        existingNeighbors[posHash][neighborHash].push(index);
      }

      function addOpposite(posHash, index) {
        if (!flatOpposites[posHash]) flatOpposites[posHash] = [];
        flatOpposites[posHash].push(index);
      }

      function addEdgePoint(posHash, edgeHash) {
        if (!existingEdges[posHash]) existingEdges[posHash] = new Set();
        existingEdges[posHash].add(edgeHash);
      }

      for (var i = 0; i < vertexCount; i += 3) {
        var posHash0 = hashFromVector(
          _vertex[0].fromBufferAttribute(posAttribute, i + 0),
        );
        var posHash1 = hashFromVector(
          _vertex[1].fromBufferAttribute(posAttribute, i + 1),
        );
        var posHash2 = hashFromVector(
          _vertex[2].fromBufferAttribute(posAttribute, i + 2),
        );

        addNeighbor(posHash0, posHash1, i + 1);
        addNeighbor(posHash0, posHash2, i + 2);
        addNeighbor(posHash1, posHash0, i + 0);
        addNeighbor(posHash1, posHash2, i + 2);
        addNeighbor(posHash2, posHash0, i + 0);
        addNeighbor(posHash2, posHash1, i + 1);

        _vec0to1.copy(_vertex[0]).add(_vertex[1]).divideScalar(2.0);
        _vec1to2.copy(_vertex[1]).add(_vertex[2]).divideScalar(2.0);
        _vec2to0.copy(_vertex[2]).add(_vertex[0]).divideScalar(2.0);
        var hash0to1 = hashFromVector(_vec0to1);
        var hash1to2 = hashFromVector(_vec1to2);
        var hash2to0 = hashFromVector(_vec2to0);
        addOpposite(hash0to1, i + 2);
        addOpposite(hash1to2, i + 0);
        addOpposite(hash2to0, i + 1);

        addEdgePoint(posHash0, hash0to1);
        addEdgePoint(posHash0, hash2to0);
        addEdgePoint(posHash1, hash0to1);
        addEdgePoint(posHash1, hash1to2);
        addEdgePoint(posHash2, hash1to2);
        addEdgePoint(posHash2, hash2to0);
      }

      for (var fi = 0; fi < flatGeo.attributes.position.count; fi++) {
        var posHash = hashFromVector(
          _temp.fromBufferAttribute(flatPosition, fi),
        );
        if (!hashToIndex[posHash]) hashToIndex[posHash] = [];
        hashToIndex[posHash].push(fi);
      }

      attributeList.forEach(function (attributeName) {
        var existingAttribute = existing.getAttribute(attributeName);
        var flattenedAttribute = flatGeo.getAttribute(attributeName);
        if (existingAttribute === undefined || flattenedAttribute === undefined)
          return;
        var floatArray = subdivideAttribute(
          attributeName,
          existingAttribute,
          flattenedAttribute,
        );
        loop.setAttribute(
          attributeName,
          new THREE.BufferAttribute(floatArray, flattenedAttribute.itemSize),
        );
      });

      var morphAttributes = existing.morphAttributes;
      for (var attributeName in morphAttributes) {
        var array = [];
        var morphAttribute = morphAttributes[attributeName];
        for (var mi = 0, l = morphAttribute.length; mi < l; mi++) {
          if (morphAttribute[mi].count !== vertexCount) continue;
          var existingAttribute = morphAttribute[mi];
          var flattenedAttribute = flatAttribute(
            morphAttribute[mi],
            morphAttribute[mi].count,
            params,
          );
          var floatArray = subdivideAttribute(
            attributeName,
            existingAttribute,
            flattenedAttribute,
          );
          array.push(
            new THREE.BufferAttribute(floatArray, flattenedAttribute.itemSize),
          );
        }
        loop.morphAttributes[attributeName] = array;
      }
      loop.morphTargetsRelative = existing.morphTargetsRelative;

      flatGeo.dispose();
      existing.dispose();
      return loop;

      function subdivideAttribute(
        attributeName,
        existingAttribute,
        flattenedAttribute,
      ) {
        var arrayLength =
          flatGeo.attributes.position.count * flattenedAttribute.itemSize;
        var floatArray = new existingAttribute.array.constructor(arrayLength);

        var index = 0;
        for (var i = 0; i < flatGeo.attributes.position.count; i += 3) {
          for (var v = 0; v < 3; v++) {
            if (attributeName === "uv" && !params.uvSmooth) {
              _vertex[v].fromBufferAttribute(flattenedAttribute, i + v);
            } else if (attributeName === "normal") {
              _position[v].fromBufferAttribute(flatPosition, i + v);
              var positionHash = hashFromVector(_position[v]);
              var positions = hashToIndex[positionHash];
              var k = Object.keys(positions).length;
              var beta = 0.75 / k;
              var startWeight = 1.0 - beta * k;
              _vertex[v].fromBufferAttribute(flattenedAttribute, i + v);
              _vertex[v].multiplyScalar(startWeight);
              positions.forEach(function (positionIndex) {
                _average.fromBufferAttribute(flattenedAttribute, positionIndex);
                _average.multiplyScalar(beta);
                _vertex[v].add(_average);
              });
            } else {
              _vertex[v].fromBufferAttribute(flattenedAttribute, i + v);
              _position[v].fromBufferAttribute(flatPosition, i + v);
              var positionHash = hashFromVector(_position[v]);
              var neighbors = existingNeighbors[positionHash];
              var opposites = flatOpposites[positionHash];

              if (neighbors) {
                if (params.preserveEdges) {
                  var edgeSet = existingEdges[positionHash];
                  var hasPair = true;
                  for (var edgeHash of edgeSet) {
                    if (flatOpposites[edgeHash].length % 2 !== 0)
                      hasPair = false;
                  }
                  if (!hasPair) continue;
                }
                var k = Object.keys(neighbors).length;
                var beta =
                  (1 / k) *
                  (5 / 8 -
                    Math.pow(3 / 8 + (1 / 4) * Math.cos((2 * Math.PI) / k), 2));
                var heavy = 1 / k / k;
                var weight = lerp(heavy, beta, params.weight);
                var startWeight = 1.0 - weight * k;
                _vertex[v].multiplyScalar(startWeight);
                for (var neighborHash in neighbors) {
                  var neighborIndices = neighbors[neighborHash];
                  _average.set(0, 0, 0);
                  for (var nj = 0; nj < neighborIndices.length; nj++) {
                    _average.add(
                      _temp.fromBufferAttribute(
                        existingAttribute,
                        neighborIndices[nj],
                      ),
                    );
                  }
                  _average.divideScalar(neighborIndices.length);
                  _average.multiplyScalar(weight);
                  _vertex[v].add(_average);
                }
              } else if (opposites && opposites.length === 2) {
                var ok = opposites.length;
                var obeta = 0.125;
                var ostartWeight = 1.0 - obeta * ok;
                _vertex[v].multiplyScalar(ostartWeight);
                opposites.forEach(function (oppositeIndex) {
                  _average.fromBufferAttribute(
                    existingAttribute,
                    oppositeIndex,
                  );
                  _average.multiplyScalar(obeta);
                  _vertex[v].add(_average);
                });
              }
            }
          }
          setTriangle(
            floatArray,
            index,
            flattenedAttribute.itemSize,
            _vertex[0],
            _vertex[1],
            _vertex[2],
          );
          index += flattenedAttribute.itemSize * 3;
        }
        return floatArray;
      }
    }

    return {
      modify: modify,
      edgeSplit: edgeSplit,
      flat: flat,
      smooth: smooth,
    };
  }
  // ─── End LoopSubdivision ────────────────────────────────────────────────────

  // ─── Default parameters ─────────────────────────────────────────────────────
  var DEFAULTS = {
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
    subdivisionIterations: 2,
  };

  // LoopSubdivision is built lazily after THREE is loaded
  var LoopSubdivision = null;

  // ─── Scene factory ──────────────────────────────────────────────────────────

  function initScene(selector, options) {
    if (!options) options = {};
    var container = document.querySelector(selector);
    if (!container) {
      console.error('[FultonASCII] Container not found: "' + selector + '"');
      return null;
    }

    // Build LoopSubdivision on first use (THREE must be loaded by now)
    if (!LoopSubdivision) LoopSubdivision = _buildLoopSubdivision();

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

    // Fade-in: hide canvas until model is ready, then CSS transition handles it
    var fadeInDuration = 3; // seconds
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

            if (cfg.subdivisionIterations > 0 && child.geometry) {
              child.geometry = LoopSubdivision.modify(
                child.geometry,
                cfg.subdivisionIterations,
                {
                  split: true,
                  uvSmooth: false,
                  preserveEdges: false,
                  flatOnly: false,
                  maxTriangles: Infinity,
                },
              );
            }
          }
        });

        // Trigger fade-in after model is ready
        modelReady = true;
        asciiCanvas.style.opacity = "1";
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
})();
