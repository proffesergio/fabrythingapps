#!/usr/bin/env node
/**
 * Generates per-app branding assets (icon.png, android-icon-foreground.png,
 * splash-icon.png) for the Fabrything Expo apps from the shared source art in
 * tools/brand/ (copied from fabrythingweb/frontend/ecommerce_inventory/public/).
 *
 * Run from the fabrythingapps/ repo root:
 *   node tools/gen-icons.mjs
 *
 * Requires `sharp` as a devDependency (npm i -D sharp). See tools/gen-icons.md
 * for the full rationale and a documented fallback if sharp is unavailable.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BRAND = path.join(ROOT, 'tools/brand');

const CANVAS = 1024;

const APPS = [
  {
    dir: 'apps/customer',
    backgroundColor: '#E8452B',
    markColor: { r: 0, g: 0, b: 0 }, // black mark reads on the red bg
    splashSource: 'food-vertical-light.png', // dark wordmark reads on the red bg
  },
  {
    dir: 'apps/rider',
    backgroundColor: '#17110E',
    markColor: { r: 255, g: 255, b: 255 }, // near-black bg needs a WHITE mark, not black-on-black
    splashSource: 'food-vertical-dark.png', // white wordmark reads on the near-black bg
  },
  {
    dir: 'apps/restaurant',
    backgroundColor: '#F4A62A',
    markColor: { r: 0, g: 0, b: 0 }, // black mark reads on the amber bg
    splashSource: 'food-vertical-light.png', // dark wordmark reads on the amber bg
  },
];

/**
 * logo512.png is a flat, opaque, black-on-white PNG (no alpha channel). To use
 * it as an Android adaptive-icon foreground (which needs to sit on top of a
 * per-app backgroundColor) or as a mark composited onto a solid-color iOS
 * icon, we key the white out to transparency and paint the mark in a flat
 * fill color, using inverse luminance as the alpha channel. Because the
 * source art is pure black/white (no other hues, verified via
 * `sharp().stats()`), this reproduces the original silhouette losslessly,
 * including anti-aliased edges (partial alpha on gray edge pixels).
 *
 * `color` lets a near-black background (rider, #17110E) get a WHITE mark
 * instead of the default black one — a black mark on a near-black background
 * would be almost invisible.
 */
async function keyOutWhite(inputPath, color = { r: 0, g: 0, b: 0 }) {
  const img = sharp(inputPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    out[i] = color.r;
    out[i + 1] = color.g;
    out[i + 2] = color.b;
    out[i + 3] = Math.round(255 - lum); // white -> transparent, black -> opaque
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

async function markOnTransparentCanvas(markBuffer, canvasSize, markSize) {
  const mark = await sharp(markBuffer).resize(markSize, markSize, { fit: 'contain' }).toBuffer();
  const offset = Math.round((canvasSize - markSize) / 2);
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, left: offset, top: offset }])
    .png()
    .toBuffer();
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

async function main() {
  const logoSrc = path.join(BRAND, 'logo512.png');

  for (const app of APPS) {
    const assetsDir = path.join(ROOT, app.dir, 'assets');
    const keyedMark = await keyOutWhite(logoSrc, app.markColor).then((s) => s.toBuffer());

    // 1. android-icon-foreground.png: brand mark on a transparent 1024x1024
    //    canvas, sized to ~66% so it sits inside Android's adaptive-icon safe
    //    zone. Expo composites this over android.adaptiveIcon.backgroundColor.
    const foreground = await markOnTransparentCanvas(keyedMark, CANVAS, Math.round(CANVAS * 0.66));
    await sharp(foreground).toFile(path.join(assetsDir, 'android-icon-foreground.png'));

    // 2. icon.png (iOS main icon - cannot be transparent): brand mark
    //    centered on a solid brand-color 1024x1024 canvas, background baked
    //    in.
    const markForIcon = await sharp(keyedMark)
      .resize(Math.round(CANVAS * 0.62), Math.round(CANVAS * 0.62), { fit: 'contain' })
      .toBuffer();
    const offset = Math.round((CANVAS - Math.round(CANVAS * 0.62)) / 2);
    await sharp({
      create: {
        width: CANVAS,
        height: CANVAS,
        channels: 4,
        background: { ...hexToRgb(app.backgroundColor), alpha: 1 },
      },
    })
      .composite([{ input: markForIcon, left: offset, top: offset }])
      .removeAlpha() // iOS icon.png must not have an alpha channel
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));

    // 3. splash-icon.png: food-branded stacked logo, contained on a
    //    transparent 1024x1024 canvas. expo-splash-screen composites this
    //    over the plugin's backgroundColor with resizeMode: contain.
    const splashSrc = path.join(BRAND, app.splashSource);
    const meta = await sharp(splashSrc).metadata();
    const targetW = Math.round(CANVAS * 0.8);
    const targetH = Math.round((meta.height / meta.width) * targetW);
    const splashMark = await sharp(splashSrc).resize(targetW, targetH, { fit: 'contain' }).toBuffer();
    const left = Math.round((CANVAS - targetW) / 2);
    const top = Math.round((CANVAS - targetH) / 2);
    await sharp({
      create: {
        width: CANVAS,
        height: CANVAS,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: splashMark, left, top }])
      .png()
      .toFile(path.join(assetsDir, 'splash-icon.png'));

    console.log(`✓ ${app.dir}: icon.png, android-icon-foreground.png, splash-icon.png (bg ${app.backgroundColor}, splash ${app.splashSource})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
