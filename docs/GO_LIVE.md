# Going live — test, build, submit

Three apps: **Customer** (`com.fabrything.customer`), **Rider**
(`com.fabrything.rider`), **Restaurant** (`com.fabrything.restaurant`).
Backend: `https://fabrythingweb.onrender.com/api/`.

---

## 1. Test locally

```bash
cd fabrythingapps
npm install                 # once, from the repo root — npm workspaces

npm run typecheck                                   # all 4 workspaces
npm test --workspaces --if-present -- --runInBand    # 166 tests
```

Run one app on your phone (Expo Go, same Wi-Fi as your machine):

```bash
cd apps/customer && npx expo start      # then scan the QR code
cd apps/rider && npx expo start
cd apps/restaurant && npx expo start
```

**Point the apps at a backend.** They default to the live Render API. To use a
local Django server instead, create `.env` in the app folder:

```
EXPO_PUBLIC_API_URL=http://192.168.1.5:8000/api/
```

Use your machine's LAN IP, not `localhost` — `localhost` on a phone means the
phone. Env is baked in when Metro starts, so restart `expo start` after changing it.

### What to test manually

| App | Flow |
| --- | --- |
| Customer | log in → browse categories → search/sort → open a product → add to cart → checkout (COD) → order list → order detail → cancel |
| Rider | log in → toggle Available → open Offers (needs a CONFIRMED order in the system) → accept → Deliveries → mark picked up → mark delivered → Earnings |
| Restaurant | log in → Incoming orders → Accept order → Start preparing → Ready for pickup |

**Rider offers need a real dispatch.** Place a customer food order, have the
restaurant accept it (status CONFIRMED), and the backend offers it to the
nearest rider who is both **available** (their switch) and **online**
(heartbeat). An offer expires in 60 seconds and cascades to the next rider.

**First request after idle takes ~30s.** Render's free tier sleeps. The apps
show a "server may be waking up" hint — that is expected, not a bug. A paid
Render instance removes it.

---

## 2. One-time accounts (blocking — nothing ships without these)

1. **Expo** — sign up at expo.dev, then `npx expo login` locally.
2. **Google Play Console** — $25 one-off. Create the developer account.
3. **Apple Developer Program** — $99/year. Needed for both TestFlight and the
   App Store. **Enrolment can take days** — start it first.

Then add the CI secret so builds run automatically:

```
GitHub repo → Settings → Secrets and variables → Actions → New secret
Name:  EXPO_TOKEN
Value: (expo.dev → Account Settings → Access tokens → Create)
```

The workflow already has an EAS build job gated on that secret existing — it is
a no-op today and starts building on the next push to `main` once you add it.
No code change needed.

---

## 3. Build installable apps

```bash
npm install -g eas-cli
eas login

cd apps/customer
eas build:configure          # first time only, per app

# Android APK you can install directly on a phone — best for testing
eas build --profile preview --platform android

# Store-ready builds
eas build --profile production --platform android   # .aab for Play
eas build --profile production --platform ios       # needs Apple account
```

Repeat for `apps/rider` and `apps/restaurant`. Each is a separate app with its
own bundle id, icon and store listing.

EAS builds in the cloud and gives you a download link. The `preview` APK can be
sent to testers over WhatsApp — no store needed.

---

## 4. Submit to the stores

```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

**Before submitting, prepare per app:** icon (1024×1024, no transparency),
screenshots (at least 2 per device size), a short and full description, a
privacy policy URL (**required by both stores**), and a support email.

**Set the store's data-safety declarations honestly.** The apps collect: phone
number and name (accounts), delivery addresses, order history, and — for the
Rider app — **location**. Both stores require you to declare location use and
justify it; the Rider app shares location only while the rider enables the
switch, which is what to state.

**Review times:** Google typically hours to a few days; Apple usually 1–3 days,
and first submissions get more scrutiny. Expect at least one rejection round —
budget for it.

**Test before submitting:** Android — upload the `.aab` to the Play Console's
**Internal testing** track. iOS — `eas submit` sends the build to **TestFlight**;
install it there and run the manual flows above.

---

## 5. Updating after launch

For JavaScript-only changes (screens, copy, logic) you can push an over-the-air
update instead of a new store review:

```bash
cd apps/customer && eas update --branch production --message "Fix cart total"
```

A **new store build is required** when you change native code, add a native
dependency, change permissions, or bump the app version.

**Version gate:** the backend serves a minimum supported version per app at
`GET /api/food/mobile/config/`, and all three apps check it on launch and show
"Please update the app" when they are too old. Raise that value from the admin
side when you ship a build that older clients must not keep using — for example
after a breaking API change.
