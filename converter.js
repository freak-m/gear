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
  return mat3(c, 0.0, -s,  0.0, 1.0, 0.0,  s, 0.0, c);
}

mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0,  0.0, c, s,  0.0, -s, c);
}

mat3 rotZ(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, s, 0.0,  -s, c, 0.0,  0.0, 0.0, 1.0);
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
  float u_coord = isFront
    ? clamp(fx * 0.5, 0.0, 0.5)
    : clamp(fx * 0.5 + 0.5, 0.5, 1.0);

  vec4 color = texture2D(u_texture, vec2(u_coord, fy));

  // Image corrections: exposure (EV stops) then brightness offset
  color.rgb *= pow(2.0, u_exposure);
  color.rgb  = clamp(color.rgb + u_brightness, 0.0, 1.0);

  gl_FragColor = color;
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
  ctx.detachShader(prog, vert);
  ctx.deleteShader(vert);
  ctx.detachShader(prog, frag);
  ctx.deleteShader(frag);
  return prog;
}

function setupQuad(ctx, prog) {
  const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const buf = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
  ctx.bufferData(ctx.ARRAY_BUFFER, verts, ctx.STATIC_DRAW);
  const loc = ctx.getAttribLocation(prog, 'a_position');
  if (loc < 0) throw new Error('a_position attribute not found in shader');
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
  gl.clearColor(0, 0, 0, 1);
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
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  imageLoaded = true;
  return true;
}

function loadImageFile(file) {
  if (!file || file.type !== 'image/jpeg') {
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

// ─── Full-Resolution Download ─────────────────────────────────────────────────

function downloadFullRes() {
  if (!currentImage) return;

  const btn = document.getElementById('download-btn');
  btn.disabled = true;
  btn.textContent = 'Rendering…';

  // Defer so browser repaints the button before the blocking render
  setTimeout(() => {
    const offscreen = document.createElement('canvas');

    const offGL = offscreen.getContext('webgl', { preserveDrawingBuffer: true }) ||
                  offscreen.getContext('experimental-webgl', { preserveDrawingBuffer: true });
    if (!offGL) {
      showToast('Offscreen WebGL unavailable.', true);
      btn.disabled = false;
      btn.textContent = '↓ Download Full-Res JPG';
      return;
    }

    const maxSize   = offGL.getParameter(offGL.MAX_TEXTURE_SIZE);
    const targetW   = Math.min(7776, maxSize);
    const targetH   = Math.round(targetW / 2);
    offscreen.width  = targetW;
    offscreen.height = targetH;

    const offProg = createProgramForContext(offGL);
    offGL.useProgram(offProg);
    setupQuad(offGL, offProg);
    offGL.clearColor(0, 0, 0, 1);

    const offTex = offGL.createTexture();
    offGL.bindTexture(offGL.TEXTURE_2D, offTex);
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_WRAP_S, offGL.CLAMP_TO_EDGE);
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_WRAP_T, offGL.CLAMP_TO_EDGE);
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_MIN_FILTER, offGL.LINEAR);
    offGL.texParameteri(offGL.TEXTURE_2D, offGL.TEXTURE_MAG_FILTER, offGL.LINEAR);
    offGL.pixelStorei(offGL.UNPACK_FLIP_Y_WEBGL, true);
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
    offGL.clear(offGL.COLOR_BUFFER_BIT);
    offGL.drawArrays(offGL.TRIANGLE_STRIP, 0, 4);

    offscreen.toBlob((blob) => {
      if (!blob) {
        showToast('Failed to encode image.', true);
        btn.disabled = false;
        btn.textContent = '↓ Download Full-Res JPG';
        offGL.getExtension('WEBGL_lose_context')?.loseContext();
        return;
      }
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'equirectangular.jpg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      btn.disabled = false;
      btn.textContent = '↓ Download Full-Res JPG';
      offGL.getExtension('WEBGL_lose_context')?.loseContext();
    }, 'image/jpeg', 0.95);
  }, 16);
}

// ─── UI Init ─────────────────────────────────────────────────────────────────

(function init() {
  const canvas = document.getElementById('preview-canvas');

  let webglOk;
  try {
    webglOk = initWebGL(canvas);
  } catch (err) {
    webglOk = false;
  }
  if (!webglOk) {
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
  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drag-over');
    }
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    loadImageFile(e.dataTransfer.files[0]);
  });

  // Keyboard: Enter/Space on drop zone opens file picker (accessibility)
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.getElementById('file-input').click();
    }
  });

  // File picker
  document.getElementById('file-input').addEventListener('change', (e) => {
    loadImageFile(e.target.files[0]);
    e.target.value = '';
  });

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

  document.getElementById('download-btn').addEventListener('click', downloadFullRes);
})();

// ─── PWA ─────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}
