# Release / build guide

This monorepo contains three independent Expo apps — `apps/customer`,
`apps/rider`, `apps/restaurant` — each with its own `eas.json`, `app.config.ts`,
package name, and bundle/package identifiers. Builds are produced with
[EAS Build](https://docs.expo.dev/build/introduction/); store submission uses
[EAS Submit](https://docs.expo.dev/submit/introduction/).

**Status as of this doc:** no Expo or Apple/Google developer account exists
yet for this project. The steps below are what the account owner runs once
those accounts are created. CI (`.github/workflows/mobile-ci.yml`) intentionally
does **not** call `eas build` — it only runs typecheck + tests, so nothing here
is required for CI to stay green.

## 1. One-time account setup

1. Create a free Expo account: https://expo.dev/signup
2. Install the EAS CLI globally:
   ```bash
   npm i -g eas-cli
   ```
3. Log in:
   ```bash
   eas login
   ```
4. From inside each app directory, link the app to an EAS project (first run only;
   this writes an `extra.eas.projectId` into that app's Expo config):
   ```bash
   cd apps/customer && eas init   # repeat for apps/rider, apps/restaurant
   ```

## 2. Build profiles

Each app ships an `eas.json` (`apps/<app>/eas.json`) with three profiles:

| Profile       | Purpose                                   | Notes |
| ------------- | ------------------------------------------ | ----- |
| `development` | Dev-client build for local iteration        | `developmentClient: true`, `distribution: internal` |
| `preview`     | Ad-hoc/internal QA build                    | `distribution: internal`; Android produces an installable **APK** (`android.buildType: apk`) instead of an AAB |
| `production`  | Store-bound build                           | `autoIncrement: true` bumps the build number/version code automatically |

## 3. Producing an installable Android APK (preview)

Run per app, from that app's own directory (each app is its own Expo/EAS
project):

```bash
cd apps/customer
eas build --profile preview --platform android
```

```bash
cd apps/rider
eas build --profile preview --platform android
```

```bash
cd apps/restaurant
eas build --profile preview --platform android
```

Each command uploads the project to EAS, builds remotely, and prints a URL to
the finished artifact once the build completes. Because the `preview` profile
sets `android.buildType: apk`, the artifact is a directly installable `.apk`
file (side-load it or share the URL) rather than a Play-Store-only `.aab`.

## 4. iOS preview

```bash
cd apps/<app>
eas build --profile preview --platform ios
```

iOS builds require an active Apple Developer Program membership (paid,
$99/yr) on the same account used with `eas login` — EAS uses it to manage
signing credentials. Once built, the iOS `preview` artifact is distributed
via **TestFlight** (internal testing) rather than a direct file install, since
Apple does not allow ad-hoc `.ipa` sideloading outside of registered
developer devices. This step is blocked until the owner has an Apple
Developer account; do not attempt it before then.

## 5. Production builds

```bash
cd apps/<app>
eas build --profile production --platform android
eas build --profile production --platform ios
```

`autoIncrement: true` means EAS bumps `android.versionCode` / `ios.buildNumber`
for you on each production build — no manual version bump needed before
building.

## 6. Submitting to the stores (`eas submit`)

Each app's `eas.json` includes a `submit.production` block. Once the owner has
created the destination listings, submission is:

```bash
cd apps/<app>
eas submit --profile production --platform android   # → Google Play internal testing track
eas submit --profile production --platform ios        # → TestFlight
```

Prerequisites (set up once accounts/listings exist, tracked separately — not
part of this task):

- **Google Play**: a Play Console developer account ($25 one-time), an app
  entry created per package name (`com.fabrything.customer`,
  `com.fabrything.rider`, `com.fabrything.restaurant`), and a service-account
  JSON key referenced from `eas.json`'s `submit.production.android` block.
- **Apple / TestFlight**: an App Store Connect entry per bundle identifier,
  and the Apple ID / app-specific password or API key EAS needs to upload
  builds — `eas submit` will prompt for these interactively the first time,
  or they can be scripted via `eas.json`'s `submit.production.ios` block.

Until those are configured, `eas submit` is not expected to succeed — building
(`eas build`) and manually distributing preview APK links / TestFlight is the
interim release path.

## 7. API URL configuration

All three apps read their API base URL from `process.env.EXPO_PUBLIC_API_URL`
(see `packages/core/src/env.ts`), with a built-in fallback of:

```
https://fabrythingweb.onrender.com/api/
```

Every `eas build` run in this doc uses that default — no extra environment
variable needs to be set for builds against the current backend. To point a
build at a different backend (e.g. a staging API), set
`EXPO_PUBLIC_API_URL` as an EAS secret or in the relevant `eas.json` build
profile's `env` block before building.

## 8. CI scope (what does and doesn't run automatically)

`.github/workflows/mobile-ci.yml` has two jobs.

**`test`** runs on every pull request and on pushes to `main`/`master`:

1. checkout
2. `actions/setup-node@v4` (Node 20, npm cache)
3. `npm ci`
4. `npm run typecheck` — runs `tsc --noEmit` in `packages/core` and all three
   apps
5. `npm test --workspaces --if-present -- --runInBand` — runs each
   workspace's Jest suite sequentially, and forces Jest itself to a single
   worker, to avoid a known jest-expo/testing-library flake under concurrent
   test execution

**`build`** runs `eas build --profile preview --platform android
--non-interactive --no-wait` for each app (a matrix job — customer, rider,
restaurant), producing the same installable APK described in §3. It only
runs on a push to `main`/`master` (not on pull requests, to avoid burning EAS
build minutes on every PR) **and** only when the `EXPO_TOKEN` repository
secret is set. Until step 1 above is done and that secret is added
(Settings → Secrets and variables → Actions → New repository secret, value
from an Expo access token — Account settings → Access tokens on expo.dev),
the job's `if:` evaluates false and it is skipped for every run, so the
workflow stays green with no code change required. Once the secret exists it
starts building automatically on every push to main. It does **not** run
`eas submit` — store submission stays a manual step (§6) that needs
Apple/Google listings CI has no business gating.
