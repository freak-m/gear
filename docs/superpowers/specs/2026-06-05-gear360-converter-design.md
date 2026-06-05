# Gear 360 Fisheye → Equirectangular Converter

**Date:** 2026-06-05  
**Status:** Approved  

## Overview

Web app (PWA) that converts Samsung Gear 360 SM-C200 dual-fisheye JPGs to equirectangular panoramas using a WebGL fragment shader. Runs entirely client-side — no server, no upload. Designed for web first, Android (via Capacitor) later.

## File Structure

```
gear/
├── index.html          ← main page, drag-drop UI
├── style.css
├── converter.js        ← WebGL engine + shaders
├── manifest.json       ← PWA manifest
├── service-worker.js   ← offline cache
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Architecture

### WebGL Pipeline

```
Image file (JPG)
  → FileReader → HTMLImageElement → WebGL texture (TEXTURE0)
  → Vertex shader: fullscreen quad (2 triangles)
  → Fragment shader (uniforms below)
  → Canvas (live preview at screen resolution, 60fps)
  → [Download] → offscreen framebuffer at full res → toBlob() → JPG
```

### Fragment Shader Uniforms

| Uniform | Description |
|---|---|
| `u_yaw`, `u_pitch`, `u_roll` | Rotation correction matrix |
| `u_fov` | Per-lens FOV override (default 195°) |
| `u_cx_offset`, `u_cy_offset` | Lens circle center offset (calibration) |
| `u_brightness`, `u_exposure` | Image correction |

### SM-C200 Fisheye Math

The SM-C200 uses equidistant fisheye projection, 195° FOV per lens. Left half of image = front hemisphere, right half = back hemisphere.

For each output pixel in equirectangular space:
1. Compute longitude/latitude from normalized output coords
2. Apply yaw/pitch/roll rotation matrix to get corrected spherical direction
3. Determine hemisphere (front or back) → select left or right input half
4. Apply equidistant fisheye projection: `r = θ / (FOV/2)` where θ is angle from optical axis
5. Map `(r, φ)` → UV within fisheye circle (accounting for cx/cy offset)
6. Sample input texture at computed UV

## UI/UX

### Layout (desktop)

```
┌──────────────────────────────────────────────────┐
│  Gear 360 Converter                              │
├──────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────┐  │
│  │     LIVE EQUIRECTANGULAR PREVIEW (WebGL)   │  │
│  │              60fps, GPU-driven             │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [Drop JPG / 📁]   ROTATION  Yaw  Pitch  Roll    │
│                    LENS      FOV  X-off  Y-off   │
│                    IMAGE     Brightness  Exposure │
│                                                  │
│              [⬇ Download Full-Res JPG]           │
└──────────────────────────────────────────────────┘
```

### Mobile layout
Preview on top, controls below (scrollable). Same functionality.

### Behavior
- All sliders update shader uniforms directly — no reprocessing, instant visual feedback
- Preview renders at screen resolution (fast)
- Download renders at full 7776×3888 to offscreen framebuffer, exports as JPEG
- Download button hidden until image loaded

## PWA

- `manifest.json`: app name, icons, `display: standalone`, `orientation: landscape`
- `service-worker.js`: caches all static assets on install, serves offline after first load
- Android: user installs via Chrome "Add to Home Screen"
- Future Android native: wrap with Capacitor (no code changes needed)

## Error Handling

| Scenario | Handling |
|---|---|
| Non-image file dropped | Toast warning, ignore file |
| WebGL not supported | Full-page message with browser suggestion |
| Image exceeds GPU max texture size | Warning toast, suggest resizing |
| File read error | Toast with error message |

## Out of Scope (v1)

- Batch processing
- Formats other than JPG input/output
- Server-side processing
- Nadir/zenith patching
- Multi-image stitching from separate shots
