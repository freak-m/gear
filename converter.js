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
