/**
 * terrain.constants.ts — Catatan Tetap (Constants) untuk fitur Terrain
 * Semua nilai yang tidak berubah terkait geometri dan sculpt terrain.
 */

/** Ukuran terrain dalam satuan dunia (meter) */
export const TERRAIN_SIZE = 1500;

/** Posisi Y default permukaan tanah */
export const GROUND_Y = -0.3;

/** Resolusi grid sculpt canvas (piksel) — 512 = lebih halus dari 256 */
export const SCULPT_RES = 512;

/** Kecepatan pahat per frame — terkendali, bukan lonjakan piksel absolut */
export const SCULPT_SPEED = 3.5;

/** Tinggi displacement maksimum sculpt dalam meter */
export const SCULPT_MAX_HEIGHT = 35;

/** Resolusi canvas untuk paint splat layer */
export const PAINT_RES = 1024;

/** Tekstur 1×1 kosong transparan sebagai fallback agar useTexture tidak error */
export const EMPTY_TEXTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

/** Batas radius kuas dalam satuan dunia: brushSize (px) × faktor skala × 2 */
export const BRUSH_WORLD_RADIUS_FACTOR = (TERRAIN_SIZE / 1024) * 2.0;
