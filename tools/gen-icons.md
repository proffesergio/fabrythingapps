# Branding assets: how they were generated

This documents Task 15 (per-app branding: icons + splash from the real
Fabrything logo), replacing the default Expo placeholder artwork.

## Source assets

The brief for this task originally pointed at `logo_square_light/dark.png`,
which no longer exist in the web app's `public/` directory. The web frontend's
brand art was regenerated since the brief was written, so this task instead
uses the **current** source assets, copied from
`fabrythingweb/frontend/ecommerce_inventory/public/` into `tools/brand/`:

| File | Description | Used for |
|---|---|---|
| `logo512.png` | 512×512, opaque, black "FABRYTHING" mark + wordmark on a white square (no alpha channel) | `android-icon-foreground.png` and `icon.png`, after white-keying (see below) |
| `favicon-light.png` / `favicon-dark.png` | 256×256 transparent-background triangle-only marks (copied for reference; not used directly by the generator — the full `logo512.png` lockup was used instead so all three apps show the same mark) | reference only |
| `food-vertical-light.png` | Triangle mark + black "FOOD" wordmark, transparent background — wordmark reads on light/colored backgrounds | splash source for customer, restaurant |
| `food-vertical-dark.png` | Same mark, but the "FOOD" wordmark is rendered in white — reads on dark backgrounds; visually near-blank on a white canvas since only the red glyphs show | splash source for rider |

`tools/brand/` is checked in so the generation is reproducible; it is not
consumed at build/runtime, only by `tools/gen-icons.mjs`.

## Per-app brand colors

Taken from the web food theme, per the task instructions (note: these differ
slightly from the original task-15 brief, which is stale):

| App | `backgroundColor` | Notes |
|---|---|---|
| customer | `#E8452B` | red |
| rider | `#17110E` | near-black |
| restaurant (partner) | `#F4A62A` | amber — **changed from `#F7A81B`** in `apps/restaurant/app.config.ts` (both `android.adaptiveIcon.backgroundColor` and the `expo-splash-screen` plugin's `backgroundColor`) to match the current brand color |

## Generation approach — sharp (this is what was actually run)

`sharp` **was installed successfully** in this environment (`npm i -D sharp`
at the repo root — added as a devDependency in the root `package.json`/
`package-lock.json`; it is a build-time tool only, not shipped in the apps).
`tools/gen-icons.mjs` was written and run from the repo root:

```bash
npm i -D sharp   # already done; devDependency at repo root
node tools/gen-icons.mjs
```

For each app it produces, into `apps/<app>/assets/`, **overwriting the
existing placeholder files** (kept the existing filenames so no
`app.config.ts` path needed to change):

- `android-icon-foreground.png` (Android adaptive-icon foreground, 1024×1024,
  transparent background)
- `icon.png` (iOS main icon, 1024×1024, **no alpha channel** — background
  baked in)
- `splash-icon.png` (splash image, 1024×1024, transparent background)

### Why `logo512.png` needs to be re-keyed

`logo512.png` has **no alpha channel** — it's a flat black mark on an opaque
white square. Using it as-is for the adaptive-icon foreground would just
paint a white square over the per-app `backgroundColor`, defeating the whole
point of per-app tinting. Since the source art is pure black/white (verified
via `sharp().stats()` — R/G/B channels are identical), the generator keys the
white out using **inverse luminance as the alpha channel**: white pixels
(`lum=255`) become fully transparent, black pixels (`lum=0`) become fully
opaque, and anti-aliased gray edges get partial alpha — reproducing the
original silhouette losslessly with clean edges, no thresholding artifacts.

```js
// tools/gen-icons.mjs — keyOutWhite()
for (let i = 0; i < data.length; i += 4) {
  const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
  out[i] = color.r; out[i + 1] = color.g; out[i + 2] = color.b;
  out[i + 3] = Math.round(255 - lum); // white -> transparent, black -> opaque
}
```

### Why rider gets a WHITE mark, not black

The rider app's brand background (`#17110E`) is near-black. Compositing the
default **black** mark onto it produces an (almost) invisible icon — black on
near-black. `gen-icons.mjs` has a per-app `markColor` (`APPS` array): customer
and restaurant get the default black mark (readable on red/amber), rider gets
the mark re-keyed in **white** instead, which is clearly legible on the dark
background. This affects both `android-icon-foreground.png` and `icon.png`
for rider; the same keying function is reused with a different `color` arg.

### `icon.png` (iOS) — baked background, no alpha

The keyed mark (66%/62% of canvas for foreground/icon respectively, leaving
margin for Android's adaptive-icon safe zone and general icon padding) is
composited onto a solid 1024×1024 canvas of the app's `backgroundColor`, then
`.removeAlpha()` is called to strip the alpha channel entirely (iOS icons
must not have transparency).

Note: `sharp`'s `.flatten({ background })` did **not** reliably strip the
alpha channel after a `.composite()` call in this sharp version (`0.35.3`) —
the output PNG retained `hasAlpha: true` even with a background supplied.
`.removeAlpha()` was used instead, which worked correctly (`hasAlpha: false`,
3 channels) — verified with `sharp(file).metadata()` for all three apps'
`icon.png` files before committing.

### `splash-icon.png`

The relevant `food-vertical-*.png` source is resized to 80% of the 1024×1024
canvas (`fit: contain`, preserving aspect ratio) and centered on a transparent
background. The `expo-splash-screen` plugin composites this over its own
`backgroundColor` config at runtime with `resizeMode: 'contain'`.

## Fallback (not needed here, documented for completeness)

`sharp` installed and ran without issue in this environment, so the fallback
below was **not** used. If `sharp` cannot be installed in some other
environment, the safe fallback is:

```bash
# For each app:
cp tools/brand/logo512.png apps/<app>/assets/android-icon-foreground.png
cp tools/brand/logo512.png apps/<app>/assets/icon.png
cp tools/brand/food-vertical-light.png apps/<app>/assets/splash-icon.png  # or -dark for rider
```

This is **not equivalent** to the sharp-generated output:
- `icon.png` would keep `logo512.png`'s baked-in **white** background instead
  of the per-app brand color — acceptable for local dev, but **must be
  regenerated with the sharp script before any store submission**, since the
  iOS icon would not reflect per-app branding.
- `android-icon-foreground.png` would be a white square (no transparency),
  hiding the `adaptiveIcon.backgroundColor` entirely.
- `splash-icon.png` would work reasonably as-is (already has transparency),
  though it would not be scaled/padded to match the other apps.

## Verification

For each app, from the app directory:

```bash
npx expo config --type public
```

All three (`apps/customer`, `apps/rider`, `apps/restaurant`) resolved with no
missing-asset errors and the correct `backgroundColor` in both
`android.adaptiveIcon` and the `expo-splash-screen` plugin config.

## Regenerating

```bash
cd fabrythingapps
npm i -D sharp   # if not already a devDependency
node tools/gen-icons.mjs
```

Re-copy updated source art into `tools/brand/` first if the underlying logo
changes.
