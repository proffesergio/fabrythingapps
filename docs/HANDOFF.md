# Handoff: push, continue elsewhere, and build test APKs

Everything you need to (1) get this repo onto GitHub, (2) pick the work back
up in a fresh Claude Code session on a different machine, and (3) produce
installable Android APKs for the Customer, Rider and Restaurant apps.

Written 2026-07-25, at the end of the Mobile Foundation milestone (SP0 + SP1).

---

## 0. Where the project stands right now

Two **separate** git repositories, side by side:

| Repo | Path | Remote | Branch | State |
| --- | --- | --- | --- | --- |
| `fabrythingweb` | `~/Music/fabrything/fabrythingweb` | `github.com/proffesergio/fabrythingweb.git` | `feature/mobile-enablers` | SP0 done — **10 commits not yet merged into `main`, not deployed** |
| `fabrythingapps` | `~/Music/fabrything/fabrythingapps` | **none yet** | `master` | SP1 done — all local, never pushed |

- **SP0** (backend enablers) = push device tokens, rider-privacy fields,
  `food/mobile/config/`, `store/auth/refresh/`. Food suite 340/340 green.
- **SP1** (mobile foundation) = npm-workspaces monorepo, `@fabrything/core`,
  three Expo apps that log in and load live data. Typecheck green,
  23/23 tests green.

> ⚠️ **Read §2 before you build an APK.** The three endpoints the apps rely
> on for push, the version gate and rider privacy only exist on the unmerged
> `feature/mobile-enablers` branch. Until that branch is merged and deployed
> to Render, those calls 404 in production. The apps degrade gracefully (they
> are all best-effort with `.catch`), so nothing crashes — but push
> notifications simply will not work.

---

## 1. Push `fabrythingapps` to a new GitHub repo

The apps repo has commits but **no remote**. Nothing is ignored that matters,
and there are no `.env` files or keystores in the tree, so it is safe to push
as-is.

### 1a. Create the empty repo

With the GitHub CLI (easiest — creates and wires the remote in one step):

```bash
cd ~/Music/fabrything/fabrythingapps
gh auth login                      # once per machine, if not already
gh repo create fabrythingapps --private --source=. --remote=origin
```

Or by hand: create an **empty** repo at <https://github.com/new> named
`fabrythingapps` (no README, no .gitignore, no licence — the repo already has
its own), then:

```bash
cd ~/Music/fabrything/fabrythingapps
git remote add origin https://github.com/<your-username>/fabrythingapps.git
```

### 1b. Push

```bash
git push -u origin master
```

If you would rather the default branch be called `main`:

```bash
git branch -M main
git push -u origin main
```

…and then update `.github/workflows/mobile-ci.yml` — it triggers on
`[main, master]`, so it already covers both. No change actually needed.

### 1c. Confirm it landed

```bash
git remote -v          # origin -> your new repo
git status             # "Your branch is up to date with 'origin/...'"
```

Then open the repo's **Actions** tab. The `mobile-ci` workflow runs on push
and should go green (typecheck + 23 tests). If it is red, that is a real
signal — do not ignore it.

### 1d. One thing git will NOT carry over

`.gitignore` excludes `.superpowers/`, which holds the task-by-task progress
ledger `.superpowers/sdd/progress.md`. The **plans and specs are committed**
(they live in `docs/superpowers/`), but the ledger is not.

If you want the ledger on the other machine — it is the most detailed record
of what was done, what was reviewed, and what carried over — either copy it
manually, or start tracking it:

```bash
git add -f .superpowers/sdd/progress.md
git commit -m "docs: track the SDD progress ledger"
```

---

## 2. Ship the backend first (SP0) — do this before trusting an APK

The mobile apps talk to `https://fabrythingweb.onrender.com/api/`. Three
things they call are only on the unmerged branch:

- `food/mobile/config/` — version gate + support links
- `food/devices/register/` + `food/devices/unregister/` — Expo push tokens
- `food/rider/privacy/` — the rider share-location toggle

```bash
cd ~/Music/fabrything/fabrythingweb
git checkout feature/mobile-enablers
git pull

# Re-run the food suite before merging (it was 340/340 green)
cd backend/EcommerceInventory
python manage.py test food

cd ~/Music/fabrything/fabrythingweb
git checkout main
git merge feature/mobile-enablers
git push origin main
```

Render deploys from `main`, so the push triggers the deploy. Two things to do
after it goes live:

1. **Run migrations.** SP0 adds the `DeviceToken` model, the rider-privacy
   fields, and a data migration that backfills existing riders to
   sharing-on. Confirm `python manage.py migrate` ran in the deploy logs.
2. **Smoke-test the public endpoint** (it needs no auth):
   ```bash
   curl https://fabrythingweb.onrender.com/api/food/mobile/config/
   ```
   You should get JSON with `min_supported_version`, not a 404.

> Note: the frontend build needs `npm install` in
> `frontend/ecommerce_inventory` first — `leaflet`/`react-leaflet` are in
> `package.json` but were missing from `node_modules`. This is pre-existing,
> not from SP0, but it will bite you at deploy time if you skip it.

---

## 3. Continue on another machine, in a new Claude session

### 3a. Prerequisites on the new machine

- **Node 20+** (`.nvmrc` says 20; the repo's `engines` requires `>=20`).
  `nvm use` in the repo root picks it up.
- **git**, and **Claude Code** (`npm i -g @anthropic-ai/claude-code`).
- For APK builds: an **Expo account** and `eas-cli` (see §4).
- Only if you take the no-account APK route: **JDK 17** + **Android SDK**.

### 3b. Clone both repos

Clone them as **siblings** in one parent folder. The mobile repo's docs and
`CLAUDE.md` refer to the backend as `../fabrythingweb`, and that only
resolves if the layout matches:

```bash
mkdir -p ~/fabrything && cd ~/fabrything
git clone https://github.com/<your-username>/fabrythingapps.git
git clone https://github.com/proffesergio/fabrythingweb.git
```

### 3c. Install and verify before changing anything

```bash
cd ~/fabrything/fabrythingapps
npm install                  # root install covers all workspaces
npm run typecheck            # expect: 4 workspaces, no errors
npm test                     # expect: 23 passed
```

If all three are clean, the environment is good. If `npm test` fails on a
timeout, you are on a machine slower than the one this was built on — raise
`testTimeout` in `apps/*/jest.config.js` (currently 30000ms; it exists
precisely because a cold jest cache blows the 5s default).

### 3d. What the new Claude session already knows — and what it doesn't

**Travels with the repo (Claude will read these automatically):**

- `CLAUDE.md` at the repo root — architecture, the "core holds the logic,
  apps stay thin" rule, the flat-login/JWT-claims gotcha, all commands.
- `docs/superpowers/specs/2026-07-24-mobile-foundation-design.md` — the design.
- `docs/superpowers/plans/2026-07-24-mobile-foundation.md` — the 17-task plan.
- `docs/RELEASE.md` — the full EAS build/submit guide.
- This file.

**Does NOT travel:** the per-project memory in
`~/.claude/projects/-home-hossain-Music-fabrything/memory/` is local to this
machine. On the new machine Claude starts without it. That is fine — the
in-repo docs above cover the same ground — but if you want it, copy that
folder to the matching path on the new machine (the folder name is derived
from the project path, so it will differ if you clone to `~/fabrything`).

### 3e. Starting the next phase

Roadmap, each phase getting its own spec → plan → implementation:

| Phase | Scope | Status |
| --- | --- | --- |
| SP0 | Backend enablers | ✅ done, **merge + deploy pending** |
| SP1 | Mobile foundation | ✅ done |
| **SP2** | **Customer ordering flow** | **next** |
| SP3 | Rider app (accept/deliver, live location) | later |
| SP4 | Restaurant app (order management) | later |
| SP5 | WhatsApp Cloud API + public store listings | later |

Open a session in `~/fabrything/fabrythingapps` and start with something like:

```
Read CLAUDE.md, docs/HANDOFF.md, and
docs/superpowers/plans/2026-07-24-mobile-foundation.md to get oriented.

SP0 and SP1 (the mobile foundation) are complete. I want to start SP2, the
customer ordering flow: browse a restaurant's menu, build a cart, place a
cash-on-delivery order, and track it.

Use the brainstorming skill first to pin down scope, then write a spec and a
plan before writing any code — same spec → plan → implement flow the earlier
phases used.
```

The backend contract for ordering already exists in `fabrythingweb/food/` —
tell Claude to read the Django views there rather than invent endpoints. That
is the single most useful instruction you can give it.

---

## 4. Build installable Android APKs

Two routes. **Route A (EAS cloud) is the supported one** — the repo's
`eas.json` files are already configured for it, and it needs no Android
toolchain on your machine. Route B exists only if you want to avoid creating
an Expo account.

### Route A — EAS Build (recommended)

#### A1. One-time setup

```bash
npm i -g eas-cli
eas login                    # create a free account at expo.dev/signup first
```

Then link **each app** to its own EAS project. Each app is a separate Expo
project with its own package ID, so this runs three times:

```bash
cd ~/fabrything/fabrythingapps/apps/customer   && eas init
cd ~/fabrything/fabrythingapps/apps/rider      && eas init
cd ~/fabrything/fabrythingapps/apps/restaurant && eas init
```

`eas init` writes an `extra.eas.projectId` into each app's Expo config.

> **This step is what makes push notifications work.** `registerForPush` in
> `packages/core` cannot obtain a real Expo push token without a
> `projectId` — that is why the call is wrapped in a try/catch that silently
> no-ops in development. Commit the resulting config changes.

#### A2. Build the APKs

The `preview` profile in each `apps/<app>/eas.json` sets
`android.buildType: apk`, so it produces a directly installable `.apk` rather
than a Play-Store-only `.aab`:

```bash
cd ~/fabrything/fabrythingapps/apps/customer
eas build --profile preview --platform android
```

```bash
cd ~/fabrything/fabrythingapps/apps/rider
eas build --profile preview --platform android
```

```bash
cd ~/fabrything/fabrythingapps/apps/restaurant
eas build --profile preview --platform android
```

Each command uploads the project, builds on Expo's servers, and prints a
download URL when it finishes (typically 10–20 minutes on the free tier,
longer if the queue is busy). The first build of each app will offer to
generate an Android keystore — say **yes** and let EAS manage it.

You can also watch progress and re-download artifacts at
<https://expo.dev> → your project → Builds.

#### A3. Install on a device

- **Easiest:** open the build URL on the Android phone itself and tap the
  APK. Android will ask you to allow installing from that browser — accept.
- **Over USB:** `adb install <file>.apk`
- All three apps have distinct package IDs
  (`com.fabrything.customer`, `com.fabrything.rider`,
  `com.fabrything.restaurant`), so they install side by side without
  conflicting.

### Route B — local build, no Expo account

Needs **JDK 17** and the **Android SDK** installed and on your PATH. The
native `android/` folder is gitignored, so it is generated on the fly:

```bash
cd ~/fabrything/fabrythingapps/apps/customer
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

The APK lands at
`apps/customer/android/app/build/outputs/apk/release/app-release.apk`.

Caveats, stated plainly: this path has **not been run or verified** on this
project — Route A is the configured and tested one. A release build also
needs a signing keystore configured in `android/gradle.properties`, or you
must use `assembleDebug` instead (which is fine for internal testing, just
larger and slower). Delete the generated `android/` folder afterwards to
keep the repo clean.

### What to actually test once installed

The apps are at *foundation* stage — login plus one live screen each. Expect:

- **Customer**: log in → list of restaurants pulled from the live API.
- **Rider**: log in → your rider profile, availability, share-location toggle.
- **Restaurant**: log in → your restaurant's profile.

All three log in with the same `store/auth/login/` endpoint; the app you can
use depends on the **role** on your account. Ordering, dispatch and order
management are SP2–SP4 and are not built yet.

If a screen sits on a spinner forever, that is a bug worth reporting — every
fetch has a `.catch` specifically so that cannot happen.

---

## 5. Quick reference

```bash
# mobile repo
npm install                 # root, all workspaces
npm run typecheck           # tsc --noEmit everywhere
npm test                    # all suites (23 tests)
npm --workspace @fabrything/customer test        # one workspace
cd apps/<app> && npx expo start                  # dev server
cd apps/<app> && npx expo export --platform android   # bundle check, no account
cd apps/<app> && eas build --profile preview --platform android   # APK

# backend repo
cd backend/EcommerceInventory && python manage.py test food
```

| Doc | What it covers |
| --- | --- |
| `CLAUDE.md` | Architecture, conventions, auth reality, commands |
| `docs/RELEASE.md` | Full EAS build + store-submission guide (iOS, Play, TestFlight) |
| `docs/HANDOFF.md` | This file |
| `docs/superpowers/specs/` | Design specs per phase |
| `docs/superpowers/plans/` | Task-by-task implementation plans |
