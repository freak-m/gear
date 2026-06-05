# Gear 360 Fisheye → Equirectangular Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PWA that converts Samsung Gear 360 SM-C200 dual-fisheye JPGs to equirectangular panoramas with live WebGL preview and adjustable rotation, lens, and image controls.

**Architecture:** Pure client-side WebGL 1.0 app. A GLSL fragment shader performs fisheye-to-equirectangular remapping on the GPU. All sliders update shader uniforms directly for live 60fps feedback. Download renders full resolution to an offscreen canvas. PWA manifest + service worker enable offline use and Android "Add to Home Screen" install.

**Tech Stack:** HTML5, CSS3, Vanilla JS (no framework), WebGL 1.0, Web App Manifest, Service Worker

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | App shell: markup, drop zone, canvas, sliders, download button |
| `style.css` | Dark theme, mobile-first layout |
| `converter.js` | WebGL init, shaders, render loop, download, UI wiring |
| `manifest.json` | PWA metadata and icons |
| `service-worker.js` | Cache-first offline strategy |
| `icons/icon-192.png` | PWA icon for Android |
| `icons/icon-512.png` | PWA icon splash / Play Store |

---

### Task 1: Project Scaffold

**Files:**
- Create: `index.html`
- Create: `manifest.json`
- Create: `style.css` (empty)
- Create: `converter.js` (empty)
- Create: `service-worker.js` (empty)

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gear 360 Converter</title>
  <link rel="stylesheet" href="style.css">
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#111111">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
</head>
<body>
  <header>
    <h1>Gear 360 Converter</h1>
  </header>

  <main>
    <div id="drop-zone" role="button" tabindex="0"
         aria-label="Drop zone for Gear 360 JPG files">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p>Drop Gear 360 JPG here</p>
      <label class="browse-btn">
        Browse
        <input type="file" id="file-input" accept="image/jpeg,image/jpg"
               aria-label="Select Gear 360 JPG file">
      </label>
    </div>

    <div id="preview-wrap" hidden>
      <canvas id="preview-canvas" aria-label="Equirectangular preview"></canvas>
    </div>

    <div id="controls" hidden>
      <section class="control-group">
        <h2>Rotation</h2>
        <label>Yaw <span id="yaw-val">0°</span>
          <input type="range" id="yaw" min="-180" max="180" value="0" step="0.5">
        </label>
        <label>Pitch <span id="pitch-val">0°</span>
          <input type="range" id="pitch" min="-90" max="90" value="0" step="0.5">
        </label>
        <label>Roll <span id="roll-val">0°</span>
          <input type="range" id="roll" min="-180" max="180" value="0" step="0.5">
        </label>
      </section>

      <section class="control-group">
        <h2>Lens</h2>
        <label>FOV <span id="fov-val">195°</span>
          <input type="range" id="fov" min="160" max="220" value="195" step="0.5">
        </label>
        <label>X Offset <span id="cx-val">0.000</span>
          <input type="range" id="cx" min="-0.1" max="0.1" value="0" step="0.001">
        </label>
        <label>Y Offset <span id="cy-val">0.000</span>
          <input type="range" id="cy" min="-0.1" max="0.1" value="0" step="0.001">
        </label>
      </section>

      <section class="control-group">
        <h2>Image</h2>
        <label>Brightness <span id="brightness-val">0.00</span>
          <input type="range" id="brightness" min="-1" max="1" value="0" step="0.01">
        </label>
        <label>Exposure <span id="exposure-val">0.0</span>
          <input type="range" id="exposure" min="-3" max="3" value="0" step="0.1">
        </label>
      </section>

      <button id="download-btn">&#8595; Download Full-Res JPG</button>
    </div>
  </main>

  <div id="toast" role="alert" aria-live="polite" hidden></div>

  <script src="converter.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create manifest.json**

```json
{
  "name": "Gear 360 Converter",
  "short_name": "Gear360",
  "description": "Convert Samsung Gear 360 fisheye photos to equirectangular panoramas",
  "start_url": "/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#111111",
  "theme_color": "#111111",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Create empty placeholder files and icons directory**

```bash
New-Item -ItemType File style.css
New-Item -ItemType File converter.js
New-Item -ItemType File service-worker.js
New-Item -ItemType Directory icons
```

- [ ] **Step 4: Verify structure**

```bash
Get-ChildItem
# Expected: index.html  manifest.json  style.css  converter.js  service-worker.js  icons/
```

- [ ] **Step 5: Commit**

```bash
git add index.html manifest.json style.css converter.js service-worker.js
git commit -m "feat: scaffold project structure"
git push origin main
```

---

### Task 2: Dark Theme CSS

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Write style.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #111;
  --surface: #1e1e1e;
  --surface2: #2a2a2a;
  --border: #333;
  --text: #e0e0e0;
  --text-muted: #888;
  --accent: #4a9eff;
  --danger: #ff5555;
}

html, body {
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

header h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--accent);
}

main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

#drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 16px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  color: var(--text-muted);
  text-align: center;
}

#drop-zone.drag-over {
  border-color: var(--accent);
  background: rgba(74, 158, 255, 0.05);
  color: var(--text);
}

#drop-zone p {
  font-size: 15px;
}

.browse-btn {
  display: inline-block;
  padding: 8px 20px;
  background: var(--accent);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: opacity 0.2s;
}

.browse-btn:hover { opacity: 0.85; }

.browse-btn input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

#preview-wrap {
  width: 100%;
  border-radius: 6px;
  overflow: hidden;
  background: #000;
}

#preview-canvas {
  display: block;
  width: 100%;
  height: auto;
  max-height: 40vh;
  object-fit: contain;
}

#controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-group {
  background: var(--surface);
  border-radius: 8px;
  padding: 12px;
}

.control-group h2 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.control-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text);
}

.control-group label:last-of-type { margin-bottom: 0; }

.control-group label span {
  min-width: 52px;
  text-align: right;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

.control-group input[type="range"] {
  flex: 1;
  appearance: none;
  height: 4px;
  background: var(--surface2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.control-group input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
}

.control-group input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

#download-btn {
  width: 100%;
  padding: 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

#download-btn:hover { opacity: 0.85; }

#download-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

#toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface2);
  color: var(--text);
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 13px;
  border: 1px solid var(--border);
  z-index: 100;
  max-width: 90vw;
  text-align: center;
}

#toast.error {
  border-color: var(--danger);
  color: var(--danger);
}

@media (min-width: 768px) {
  main {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  #drop-zone {
    width: 200px;
    flex-shrink: 0;
  }

  #preview-wrap {
    flex: 1;
    min-width: 0;
  }

  #preview-canvas { max-height: 60vh; }

  #controls {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .control-group {
    flex: 1;
    min-width: 180px;
  }

  #download-btn { width: 100%; }
}
```

- [ ] **Step 2: Open index.html in browser (double-click). Verify: dark background, drop zone visible, no layout errors.**

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: dark theme CSS, mobile-first layout"
git push origin main
```

---

### Task 3: Service Worker

**Files:**
- Modify: `service-worker.js`

- [ ] **Step 1: Write service-worker.js**

```javascript
const CACHE = 'gear360-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/converter.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add service-worker.js
git commit -m "feat: PWA service worker, cache-first offline strategy"
git push origin main
```

---

### Task 4: WebGL Engine Foundation

**Files:**
- Modify: `converter.js`

Implements WebGL init, shader compilation, fullscreen quad. Uses a passthrough fragment shader to confirm the GL pipeline works before adding fisheye math in Task 5.

- [ ] **Step 1: Write converter.js**

```javascript
'use strict';

// ─── Shader Sources ───────────────────────────────────────────────────────────

const VERT_SRC = `
attribute vec2 a_position;
varying vec2 v_texcoord;
void main() {
  v_texcoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Passthrough — replaced by fisheye shader in Task 5
const FRAG_SRC = `
precision highp float;
uniform sampler2D u_texture;
varying vec2 v_texcoord;
void main() {
  gl_FragColor = texture2D(u_texture, v_texcoord);
}
`;

// ─── State ────────────────────────────────────────────────────────────────────

let gl = null;
let program = null;
let texture = null;
let currentImage = null;
let imageLoaded = false;

const uniforms = {};

const sliderValues = {
  yaw: 0, pitch: 0, roll: 0,
  fov: 195,
  cx: 0, cy: 0,
  brightness: 0, exposure: 0,
};

// ─── WebGL Helpers ────────────────────────────────────────────────────────────

function compileShader(ctx, type, src) {
  const shader = ctx.createShader(type);
  ctx.shaderSource(shader, src);
  ctx.compileShader(shader);
  if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
    const err = ctx.getShaderInfoLog(shader);
    ctx.deleteShader(shader);
    throw new Error('Shader compile error: ' + err);
  }
  return shader;
}

function createProgramForContext(ctx) {
  const vert = compileShader(ctx, ctx.VERTEX_SHADER, VERT_SRC);
  const frag = compileShader(ctx, ctx.FRAGMENT_SHADER, FRAG_SRC);
  const prog = ctx.createProgram();
  ctx.attachShader(prog, vert);
  ctx.attachShader(prog, frag);
  ctx.linkProgram(prog);
  if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
    throw new Error('Program link error: ' + ctx.getProgramInfoLog(prog));
  }
  return prog;
}

function setupQuad(ctx, prog) {
  const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const buf = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
  ctx.bufferData(ctx.ARRAY_BUFFER, verts, ctx.STATIC_DRAW);
  const loc = ctx.getAttribLocation(prog, 'a_position');
  ctx.enableVertexAttribArray(loc);
  ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
}

function cacheUniforms(ctx, prog) {
  [
    'u_texture',
    'u_yaw', 'u_pitch', 'u_roll',
    'u_fov', 'u_cx', 'u_cy',
    'u_brightness', 'u_exposure',
  ].forEach((n) => { uniforms[n] = ctx.getUniformLocation(prog, n); });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initWebGL(canvas) {
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return false;

  program = createProgramForContext(gl);
  gl.useProgram(program);
  setupQuad(gl, program);
  cacheUniforms(gl, program);

  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return true;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  if (!gl || !imageLoaded) return;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.uniform1i(uniforms['u_texture'], 0);
  gl.uniform1f(uniforms['u_yaw'],        sliderValues.yaw        * Math.PI / 180);
  gl.uniform1f(uniforms['u_pitch'],      sliderValues.pitch      * Math.PI / 180);
  gl.uniform1f(uniforms['u_roll'],       sliderValues.roll       * Math.PI / 180);
  gl.uniform1f(uniforms['u_fov'],        sliderValues.fov        * Math.PI / 180);
  gl.uniform1f(uniforms['u_cx'],         sliderValues.cx);
  gl.uniform1f(uniforms['u_cy'],         sliderValues.cy);
  gl.uniform1f(uniforms['u_brightness'], sliderValues.brightness);
  gl.uniform1f(uniforms['u_exposure'],   sliderValues.exposure);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
```

- [ ] **Step 2: Open index.html in browser. Open DevTools console. Expected: no errors.**

- [ ] **Step 3: Commit**

```bash
git add converter.js
git commit -m "feat: WebGL engine, passthrough shader, render loop"
git push origin main
```

---

### Task 5: SM-C200 Fisheye Fragment Shader

**Files:**
- Modify: `converter.js` — replace the `FRAG_SRC` constant

The SM-C200 uses **equidistant fisheye** projection at ~195° FOV per lens. Left half of input = front hemisphere; right half = back hemisphere.

- [ ] **Step 1: Replace FRAG_SRC in converter.js**

Find and replace the entire `FRAG_SRC` constant (lines starting with `// Passthrough` through the closing backtick) with:

```javascript
const FRAG_SRC = `
precision highp float;

uniform sampler2D u_texture;
uniform float u_yaw;
uniform float u_pitch;
uniform float u_roll;
uniform float u_fov;
uniform float u_cx;
uniform float u_cy;
uniform float u_brightness;
uniform float u_exposure;

varying vec2 v_texcoord;

#define PI 3.14159265358979323846

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s,  0.0, 1.0, 0.0,  -s, 0.0, c);
}

mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0,  0.0, c, -s,  0.0, s, c);
}

mat3 rotZ(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, -s, 0.0,  s, c, 0.0,  0.0, 0.0, 1.0);
}

void main() {
  // Equirectangular output pixel -> spherical coords
  float lon = (v_texcoord.x - 0.5) * 2.0 * PI;
  float lat = (v_texcoord.y - 0.5) * PI;

  // Spherical -> 3D unit vector (+X right, +Y up, +Z forward)
  vec3 dir = vec3(
    cos(lat) * sin(lon),
    sin(lat),
    cos(lat) * cos(lon)
  );

  // Apply rotation: yaw (Y-axis) -> pitch (X-axis) -> roll (Z-axis)
  dir = rotY(u_yaw) * rotX(u_pitch) * rotZ(u_roll) * dir;

  // SM-C200: front hemisphere (z >= 0) -> left input half
  //          back  hemisphere (z <  0) -> right input half
  bool isFront = dir.z >= 0.0;
  vec3 d = isFront ? dir : vec3(-dir.x, dir.y, -dir.z);

  // Equidistant fisheye projection
  float theta = acos(clamp(d.z, -1.0, 1.0));
  float phi   = atan(d.y, d.x);

  // Normalised radius: 0 = optical center, 1 = edge at FOV/2
  float r = theta / (u_fov * 0.5);

  // Outside lens coverage -> black border
  if (r > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // UV within fisheye circle, centered at 0.5 + user offset
  float fx = r * cos(phi) * 0.5 + 0.5 + u_cx;
  float fy = r * sin(phi) * 0.5 + 0.5 + u_cy;

  // Map to left (front) or right (back) half of input texture
  float u_coord = isFront ? fx * 0.5 : fx * 0.5 + 0.5;

  vec4 color = texture2D(u_texture, vec2(u_coord, fy));

  // Image corrections: exposure (EV stops) then brightness offset
  color.rgb *= pow(2.0, u_exposure);
  color.rgb  = clamp(color.rgb + u_brightness, 0.0, 1.0);

  gl_FragColor = color;
}
`;
```

- [ ] **Step 2: Visual validation (after Task 6 is done)**

Load `360_0508.JPG`. Expected: recognisable equirectangular panorama. Horizon may need a Pitch/Yaw correction — use sliders. Black regions at poles and at the ±180° seam are normal for 195° lenses.

- [ ] **Step 3: Commit**

```bash
git add converter.js
git commit -m "feat: SM-C200 equidistant fisheye->equirectangular shader"
git push origin main
```

---

### Task 6: Image Loading + Texture Upload

**Files:**
- Modify: `converter.js` — append image loading, toast, drag-drop, and IIFE init

- [ ] **Step 1: Append the following to the end of converter.js**

```javascript
// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = isError ? 'error' : '';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// ─── Texture ─────────────────────────────────────────────────────────────────

function uploadTexture(img) {
  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (img.naturalWidth > maxSize || img.naturalHeight > maxSize) {
    showToast('Image too large for GPU. Max: ' + maxSize + 'px', true);
    return false;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  imageLoaded = true;
  return true;
}

function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Drop a JPG image file.', true);
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => showToast('Failed to read file.', true);
  reader.onload = (e) => {
    const img = new Image();
    img.onerror = () => showToast('Failed to decode image.', true);
    img.onload = () => {
      const canvas = document.getElementById('preview-canvas');
      const w = canvas.parentElement.clientWidth || window.innerWidth;
      canvas.width  = w;
      canvas.height = Math.round(w / 2);

      currentImage = img;
      if (!uploadTexture(img)) return;

      document.getElementById('preview-wrap').hidden = false;
      document.getElementById('drop-zone').hidden    = true;
      document.getElementById('controls').hidden     = false;

      render();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── UI Init ─────────────────────────────────────────────────────────────────

(function init() {
  const canvas = document.getElementById('preview-canvas');

  if (!initWebGL(canvas)) {
    document.getElementById('drop-zone').innerHTML =
      '<p style="color:var(--danger)">WebGL not supported.<br>Try Chrome or Firefox.</p>';
    return;
  }

  // Drag and drop
  const dropZone = document.getElementById('drop-zone');
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    loadImageFile(e.dataTransfer.files[0]);
  });

  // File picker
  document.getElementById('file-input').addEventListener('change', (e) => {
    loadImageFile(e.target.files[0]);
  });
})();
```

- [ ] **Step 2: Serve locally and test drag-drop**

```bash
python -m http.server 8080
# Open http://localhost:8080
```

Drag `360_0508.JPG` onto drop zone. Expected: drop zone hides, canvas appears showing the image (passthrough or equirectangular), controls panel shows.

- [ ] **Step 3: Commit**

```bash
git add converter.js
git commit -m "feat: image loading, texture upload, drag-drop UI"
git push origin main
```

---

### Task 7: Live Slider Controls

**Files:**
- Modify: `converter.js` — add slider wiring inside the `init` IIFE

- [ ] **Step 1: Insert slider wiring inside the `(function init() { ... })();` block, after the file-input event listener**

```javascript
  // Sliders — each input event updates sliderValues and re-renders
  const sliderDefs = [
    { id: 'yaw',        key: 'yaw',        valId: 'yaw-val',        fmt: (v) => v + '°' },
    { id: 'pitch',      key: 'pitch',      valId: 'pitch-val',      fmt: (v) => v + '°' },
    { id: 'roll',       key: 'roll',       valId: 'roll-val',       fmt: (v) => v + '°' },
    { id: 'fov',        key: 'fov',        valId: 'fov-val',        fmt: (v) => v + '°' },
    { id: 'cx',         key: 'cx',         valId: 'cx-val',         fmt: (v) => parseFloat(v).toFixed(3) },
    { id: 'cy',         key: 'cy',         valId: 'cy-val',         fmt: (v) => parseFloat(v).toFixed(3) },
    { id: 'brightness', key: 'brightness', valId: 'brightness-val', fmt: (v) => parseFloat(v).toFixed(2) },
    { id: 'exposure',   key: 'exposure',   valId: 'exposure-val',   fmt: (v) => parseFloat(v).toFixed(1) },
  ];

  sliderDefs.forEach(({ id, key, valId, fmt }) => {
    const input   = document.getElementById(id);
    const display = document.getElementById(valId);
    input.addEventListener('input', () => {
      sliderValues[key] = parseFloat(input.value);
      display.textContent = fmt(input.value);
      render();
    });
  });
```

- [ ] **Step 2: Load image, move Yaw slider. Expected: panorama rotates horizontally in real-time with no perceptible lag.**

- [ ] **Step 3: Commit**

```bash
git add converter.js
git commit -m "feat: live slider controls update WebGL uniforms at 60fps"
git push origin main
```

---

### Task 8: Full-Resolution Download

**Files:**
- Modify: `converter.js` — add `downloadFullRes`, wire download button

- [ ] **Step 1: Append `downloadFullRes` to converter.js before the `(function init()` IIFE**

```javascript
// ─── Full-Resolution Download ─────────────────────────────────────────────────

function downloadFullRes() {
  if (!currentImage) return;

  const btn = document.getElementById('download-btn');
  btn.disabled = true;
  btn.textContent = 'Rendering…';

  // Defer so browser repaints the button before the blocking render
  setTimeout(() => {
    const offscreen = document.createElement('canvas');
    const maxSize   = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const targetW   = Math.min(7776, maxSize);
    const targetH   = Math.round(targetW / 2);
    offscreen.width  = targetW;
    offscreen.height = targetH;

    const offGL = offscreen.getContext('webgl') ||
                  offscreen.getContext('experimental-webgl');
    if (!offGL) {
      showToast('Offscreen WebGL unavailable.', true);
      btn.disabled = false;
      btn.textContent = '↓ Download Full-Res JPG';
      return;
    }

    const offProg = createProgramForContext(offGL);
    offGL.useProgram(offProg);
    setupQuad(offGL, offProg);

    const offTex = offGL.createTexture();
    offGL.bindTexture(offGL.TEXTURE_2D, offTex);
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_WRAP_S, offGL.CLAMP_TO_EDGE);
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_WRAP_T, offGL.CLAMP_TO_EDGE);
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_MIN_FILTER, offGL.LINEAR);
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_MAG_FILTER, offGL.LINEAR);
    offGL.texImage2D(offGL.TEXTURE_2D, 0, offGL.RGB, offGL.RGB,
                     offGL.UNSIGNED_BYTE, currentImage);

    const uLoc = (name) => offGL.getUniformLocation(offProg, name);
    offGL.uniform1i(uLoc('u_texture'), 0);
    offGL.uniform1f(uLoc('u_yaw'),        sliderValues.yaw        * Math.PI / 180);
    offGL.uniform1f(uLoc('u_pitch'),      sliderValues.pitch      * Math.PI / 180);
    offGL.uniform1f(uLoc('u_roll'),       sliderValues.roll       * Math.PI / 180);
    offGL.uniform1f(uLoc('u_fov'),        sliderValues.fov        * Math.PI / 180);
    offGL.uniform1f(uLoc('u_cx'),         sliderValues.cx);
    offGL.uniform1f(uLoc('u_cy'),         sliderValues.cy);
    offGL.uniform1f(uLoc('u_brightness'), sliderValues.brightness);
    offGL.uniform1f(uLoc('u_exposure'),   sliderValues.exposure);

    offGL.viewport(0, 0, targetW, targetH);
    offGL.drawArrays(offGL.TRIANGLE_STRIP, 0, 4);

    offscreen.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'equirectangular.jpg';
      a.click();
      URL.revokeObjectURL(url);
      btn.disabled = false;
      btn.textContent = '↓ Download Full-Res JPG';
    }, 'image/jpeg', 0.95);
  }, 16);
}
```

- [ ] **Step 2: Wire download button inside the `init` IIFE, after the slider wiring**

```javascript
  document.getElementById('download-btn').addEventListener('click', downloadFullRes);
```

- [ ] **Step 3: Test download**

Load image, adjust Yaw slider, click Download. Expected: browser downloads `equirectangular.jpg`. Open file — should be same rotation as preview, full resolution (up to 7776×3888).

- [ ] **Step 4: Commit**

```bash
git add converter.js
git commit -m "feat: full-resolution JPEG download via offscreen WebGL canvas"
git push origin main
```

---

### Task 9: PWA Icons + Final Integration Test

**Files:**
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Modify: `converter.js` — add SW registration

- [ ] **Step 1: Generate icons**

Open `http://localhost:8080` in Chrome. Open DevTools console (F12). Paste and run:

```javascript
[192, 512].forEach(size => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#4a9eff';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(size * 0.2)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('360', size/2, size/2);
  const a = document.createElement('a');
  a.download = `icon-${size}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
});
```

Move the downloaded `icon-192.png` and `icon-512.png` into the `icons/` directory.

- [ ] **Step 2: Append SW registration at the very end of converter.js**

```javascript
// ─── PWA ─────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}
```

- [ ] **Step 3: Full integration checklist — open http://localhost:8080**

- [ ] Drop zone accepts a JPG
- [ ] Live preview renders recognisable equirectangular
- [ ] All 8 sliders update preview in real-time
- [ ] Yaw rotates panorama horizontally
- [ ] Pitch tilts up/down
- [ ] Roll rotates around center
- [ ] FOV slider changes lens coverage (wider/narrower black border)
- [ ] Brightness/Exposure change image brightness
- [ ] Download button produces `equirectangular.jpg`
- [ ] Non-image file → toast error, no crash
- [ ] DevTools → Application → Manifest: shows name, icons
- [ ] DevTools → Application → Service Workers: registered and active
- [ ] Disable network in DevTools → reload page → app still loads from cache

- [ ] **Step 4: Commit and push**

```bash
git add icons/icon-192.png icons/icon-512.png converter.js
git commit -m "feat: PWA icons, SW registration, integration tested"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ `index.html` as main page (Task 1)
- ✅ WebGL fragment shader, SM-C200 195° equidistant fisheye math (Task 5)
- ✅ Live preview, 60fps, no reprocessing (Tasks 4, 7)
- ✅ Yaw/Pitch/Roll, FOV, X/Y offset, Brightness/Exposure controls (Tasks 1, 7)
- ✅ Drag-drop single image (Task 6)
- ✅ Download full-res JPG (Task 8)
- ✅ Dark UI, mobile-first (Task 2)
- ✅ PWA: manifest, service worker, icons, offline (Tasks 3, 9)
- ✅ Error handling: wrong file type, no WebGL, texture too large (Task 6)
- ✅ Push to main after each task

**Placeholder scan:** None found.

**Type consistency:**
- `sliderValues.{yaw,pitch,roll,fov,cx,cy,brightness,exposure}` — consistent across Tasks 4, 7, 8
- `uniforms['u_cx']` / `sliderValues.cx` — match throughout
- `createProgramForContext(ctx)` — defined Task 4, reused Task 8 ✅
- `setupQuad(ctx, prog)` — defined Task 4, reused Task 8 ✅
- `currentImage` — declared Task 4, set Task 6, read Task 8 ✅
- `showToast(msg, isError)` — consistent Tasks 6, 8 ✅
