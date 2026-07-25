# Fabrything Mobile Foundation (SP0 + SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend/web enablers (SP0) and the Expo mobile foundation (SP1) so the three Fabrything apps (Customer, Rider, Restaurant) can log into the live API, receive push notifications, respect rider location privacy, and produce an installable Android APK — the base every feature sub-project builds on.

**Architecture:** SP0 adds device-token registration, an Expo-push send path wired into the existing `food.services.notify()` helper, rider privacy flags, and a public mobile-config endpoint to the Django `food` app in `fabrythingweb/`; plus a Facebook/Messenger link on the web. SP1 creates a new Expo (React Native) **npm-workspaces monorepo** in `fabrythingapps/` with a shared `packages/core` (api, auth, i18n, theme, push, config, ui) and three thin apps that prove the full chain against the live API. Realtime = existing polling/heartbeat; maps = OSM tiles; CI = EAS + GitHub Actions.

**Tech Stack:** Backend — Django 5 + DRF + SimpleJWT, Postgres (Neon), stdlib `urllib.request` (no new dep). Web — React 18 + MUI. Mobile — Expo SDK (latest stable) + Expo Router + TypeScript + TanStack Query + expo-secure-store + expo-notifications + jest + @testing-library/react-native.

## Global Constraints

- **Backend tests / makemigrations / check** run with `DJANGO_SETTINGS_MODULE=config.settings.test` (in-memory SQLite, isolated from Neon). **NEVER** run `manage.py test` under `dev`/`prod`.
- **No new backend dependency.** Expo push uses stdlib `urllib.request` only (`requests` is not installed).
- Money = `DecimalField(max_digits=10, decimal_places=2)`, BDT. Lat/lng = `DecimalField(max_digits=9, decimal_places=6)`. No PostGIS.
- Every backend model: `AutoField` PK + `created_at`/`updated_at` (inherit `food.models.TimeStamped`).
- Response envelope: `core.helpers.renderResponse(data, message, status=200)`.
- `/api/food/` is already in `core.middleware.PUBLIC_API_PREFIXES`; authenticated food endpoints enforce auth **per-view** via `authentication_classes=[JWTAuthentication]` + `permission_classes=[IsAuthenticated, ...]`. New endpoints must follow that pattern.
- Backend tests live in `food/tests/`, run with `python manage.py test food`.
- Do **NOT** auto-commit at plan level for `fabrythingweb` beyond each task's own commit; the product owner deploys. In `fabrythingapps` (fresh repo) commit each task.
- Mobile: TypeScript strict; every shared unit in `packages/core` has a unit test; each app has a login + home smoke test.
- Localization: user-facing strings via `core/i18n` with English fallback when Bangla missing.
- App IDs: `com.fabrything.customer`, `com.fabrything.rider`, `com.fabrything.restaurant`.
- Brand assets copied from `fabrythingweb/frontend/ecommerce_inventory/public/logo_square_light.png` and `logo_square_dark.png`.
- Support links: Facebook `https://www.facebook.com/fabrything`, Messenger `https://m.me/fabrything`.

---

# Part A — SP0 (in `fabrythingweb/`, Django `food` app + web)

All Part A paths are relative to `fabrythingweb/backend/EcommerceInventory/` unless noted. Run backend commands from that directory.

### Task 1: `DeviceToken` model

**Files:**
- Modify: `food/models.py` (append model)
- Test: `food/tests/test_devices.py`

**Interfaces:**
- Produces: `DeviceToken` fields `user, expo_token(unique), app, platform, enabled, last_seen_at` + `TimeStamped`; `DeviceToken.App` / `.Platform` text choices.

- [ ] **Step 1: Write the failing test**

`food/tests/test_devices.py`:
```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from food.models import DeviceToken

User = get_user_model()


class DeviceTokenModelTests(TestCase):
    def test_create_and_str(self):
        u = User.objects.create(username="c1", role="Customer")
        d = DeviceToken.objects.create(
            user=u, expo_token="ExponentPushToken[abc]",
            app=DeviceToken.App.CUSTOMER, platform=DeviceToken.Platform.ANDROID,
        )
        self.assertTrue(d.enabled)
        self.assertIn("abc", str(d))

    def test_expo_token_unique(self):
        u = User.objects.create(username="c2", role="Customer")
        DeviceToken.objects.create(user=u, expo_token="ExponentPushToken[dup]",
                                   app=DeviceToken.App.CUSTOMER, platform=DeviceToken.Platform.IOS)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            DeviceToken.objects.create(user=u, expo_token="ExponentPushToken[dup]",
                                       app=DeviceToken.App.RIDER, platform=DeviceToken.Platform.IOS)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_devices -v 2`
Expected: FAIL — `cannot import name 'DeviceToken'`.

- [ ] **Step 3: Implement the model**

Append to `food/models.py` (uses existing `TimeStamped` and `settings`):
```python
class DeviceToken(TimeStamped):
    class App(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        RIDER = "rider", "Rider"
        RESTAURANT = "restaurant", "Restaurant"

    class Platform(models.TextChoices):
        IOS = "ios", "iOS"
        ANDROID = "android", "Android"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="device_tokens")
    expo_token = models.CharField(max_length=255, unique=True)
    app = models.CharField(max_length=12, choices=App.choices)
    platform = models.CharField(max_length=8, choices=Platform.choices)
    enabled = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "enabled"])]

    def __str__(self):
        return f"{self.app}:{self.expo_token[-8:]}"
```

- [ ] **Step 4: Migrate and run tests**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py makemigrations food && DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_devices -v 2`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add food/models.py food/migrations food/tests/test_devices.py
git commit -m "feat(food): DeviceToken model for Expo push registration"
```

---

### Task 2: Device register / unregister endpoints

**Files:**
- Create: `food/views_devices.py`
- Modify: `food/urls.py` (import + 2 paths)
- Test: `food/tests/test_devices_api.py`

**Interfaces:**
- Consumes: `DeviceToken` (Task 1).
- Produces: `POST /api/food/devices/register/` (auth; upsert by `expo_token`), `POST /api/food/devices/unregister/` (auth; disable). Uses `IsAuthenticated` + `JWTAuthentication`.

- [ ] **Step 1: Write the failing test**

`food/tests/test_devices_api.py`:
```python
from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from food.models import DeviceToken

User = get_user_model()


def auth(client, user):
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")


class DeviceApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.u = User.objects.create(username="c1", role="Customer")

    def test_register_requires_auth(self):
        res = self.client.post("/api/food/devices/register/",
                               {"expo_token": "ExponentPushToken[x]", "app": "customer",
                                "platform": "android"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_register_is_idempotent_upsert(self):
        auth(self.client, self.u)
        body = {"expo_token": "ExponentPushToken[x]", "app": "customer", "platform": "android"}
        self.client.post("/api/food/devices/register/", body, format="json")
        self.client.post("/api/food/devices/register/", body, format="json")
        self.assertEqual(DeviceToken.objects.filter(expo_token="ExponentPushToken[x]").count(), 1)
        d = DeviceToken.objects.get(expo_token="ExponentPushToken[x]")
        self.assertEqual(d.user, self.u)
        self.assertTrue(d.enabled)

    def test_unregister_disables(self):
        auth(self.client, self.u)
        DeviceToken.objects.create(user=self.u, expo_token="ExponentPushToken[y]",
                                   app="customer", platform="android")
        res = self.client.post("/api/food/devices/unregister/",
                               {"expo_token": "ExponentPushToken[y]"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(DeviceToken.objects.get(expo_token="ExponentPushToken[y]").enabled)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_devices_api -v 2`
Expected: FAIL — 404 (routes missing).

- [ ] **Step 3: Implement views**

`food/views_devices.py`:
```python
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from core.helpers import renderResponse
from food.models import DeviceToken


class DeviceRegisterView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        expo_token = request.data.get("expo_token")
        app = request.data.get("app")
        platform = request.data.get("platform")
        if not expo_token or app not in DeviceToken.App.values or platform not in DeviceToken.Platform.values:
            return renderResponse(data={}, message="Invalid device payload", status=400)
        DeviceToken.objects.update_or_create(
            expo_token=expo_token,
            defaults={"user": request.user, "app": app, "platform": platform,
                      "enabled": True, "last_seen_at": timezone.now()},
        )
        return renderResponse(data={}, message="Device registered")


class DeviceUnregisterView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        expo_token = request.data.get("expo_token", "")
        DeviceToken.objects.filter(user=request.user, expo_token=expo_token).update(enabled=False)
        return renderResponse(data={}, message="Device unregistered")
```

In `food/urls.py`, add the import near the other view imports:
```python
from food.views_devices import DeviceRegisterView, DeviceUnregisterView
```
and add inside `urlpatterns` (with the other `path(...)` entries):
```python
    path("devices/register/", DeviceRegisterView.as_view(), name="food_device_register"),
    path("devices/unregister/", DeviceUnregisterView.as_view(), name="food_device_unregister"),
```

- [ ] **Step 4: Run tests**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_devices_api -v 2`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add food/views_devices.py food/urls.py food/tests/test_devices_api.py
git commit -m "feat(food): device register/unregister endpoints"
```

---

### Task 3: Expo push send path wired into `notify()`

**Files:**
- Create: `food/services_push.py`
- Modify: `food/services.py` (extend existing `notify()` — around line 60)
- Test: `food/tests/test_push.py`

**Interfaces:**
- Consumes: `DeviceToken` (Task 1).
- Produces: `food.services_push.send_expo_push(tokens: list[str], title, body, data=None) -> None` (POSTs to Expo via stdlib urllib; disables tokens reported `DeviceNotRegistered`). `food.services.notify(user, title, body="", order_code="")` now also pushes to the user's enabled tokens.

- [ ] **Step 1: Write the failing test**

`food/tests/test_push.py`:
```python
from unittest import mock
from django.test import TestCase
from django.contrib.auth import get_user_model
from food.models import DeviceToken, Notification
from food.services import notify
from food import services_push

User = get_user_model()


class PushTests(TestCase):
    def setUp(self):
        self.u = User.objects.create(username="c1", role="Customer")
        DeviceToken.objects.create(user=self.u, expo_token="ExponentPushToken[a]",
                                   app="customer", platform="android", enabled=True)
        DeviceToken.objects.create(user=self.u, expo_token="ExponentPushToken[off]",
                                   app="customer", platform="android", enabled=False)

    @mock.patch("food.services_push._post_to_expo")
    def test_send_expo_push_posts_only_given_tokens(self, post):
        post.return_value = [{"status": "ok"}]
        services_push.send_expo_push(["ExponentPushToken[a]"], "Hi", "Body", {"k": "v"})
        self.assertEqual(post.call_count, 1)
        messages = post.call_args[0][0]
        self.assertEqual(messages[0]["to"], "ExponentPushToken[a]")
        self.assertEqual(messages[0]["title"], "Hi")

    @mock.patch("food.services_push._post_to_expo")
    def test_device_not_registered_disables_token(self, post):
        post.return_value = [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]
        services_push.send_expo_push(["ExponentPushToken[a]"], "Hi", "Body")
        self.assertFalse(DeviceToken.objects.get(expo_token="ExponentPushToken[a]").enabled)

    @mock.patch("food.services_push.send_expo_push")
    def test_notify_creates_notification_and_pushes_enabled_only(self, send):
        notify(self.u, "Order update", "On the way", "ORD123")
        self.assertTrue(Notification.objects.filter(user=self.u, title="Order update").exists())
        send.assert_called_once()
        tokens = send.call_args[0][0]
        self.assertEqual(tokens, ["ExponentPushToken[a]"])  # disabled token excluded
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_push -v 2`
Expected: FAIL — `services_push` missing / `notify` doesn't push.

- [ ] **Step 3: Implement the push service**

`food/services_push.py`:
```python
import json
import urllib.request
from food.models import DeviceToken

EXPO_URL = "https://exp.host/--/api/v2/push/send"
_CHUNK = 100


def _post_to_expo(messages):
    """POST a batch of Expo message dicts; return the list of per-message receipts.

    Network/HTTP errors are swallowed (best-effort delivery) and reported as an
    empty receipt list so a push failure never breaks the request that triggered it.
    """
    payload = json.dumps(messages).encode("utf-8")
    req = urllib.request.Request(
        EXPO_URL, data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("data", [])
    except Exception:
        return []


def send_expo_push(tokens, title, body, data=None):
    tokens = [t for t in tokens if t]
    for i in range(0, len(tokens), _CHUNK):
        batch = tokens[i:i + _CHUNK]
        messages = [{"to": t, "title": title, "body": body, "data": data or {},
                     "sound": "default"} for t in batch]
        receipts = _post_to_expo(messages)
        for token, receipt in zip(batch, receipts):
            details = (receipt or {}).get("details") or {}
            if details.get("error") == "DeviceNotRegistered":
                DeviceToken.objects.filter(expo_token=token).update(enabled=False)
```

- [ ] **Step 4: Extend `notify()` in `food/services.py`**

Locate the existing `def notify(user, title, body="", order_code=""):` (~line 60). Keep its current body (which creates the `Notification`) and append a push dispatch so it becomes:
```python
def notify(user, title, body="", order_code=""):
    Notification.objects.create(user=user, title=title, body=body, order_code=order_code)
    from food.services_push import send_expo_push
    tokens = list(
        user.device_tokens.filter(enabled=True).values_list("expo_token", flat=True)
    )
    if tokens:
        send_expo_push(tokens, title, body, {"order_code": order_code})
```
(Import `send_expo_push` lazily inside the function to avoid a circular import at module load.)

- [ ] **Step 5: Run tests**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_push -v 2`
Expected: PASS (3 tests).

- [ ] **Step 6: Regression — full food suite**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food -v 1`
Expected: all pass (confirms extending `notify` broke nothing).

- [ ] **Step 7: Commit**

```bash
git add food/services_push.py food/services.py food/tests/test_push.py
git commit -m "feat(food): Expo push send wired into notify() (stdlib urllib, no new dep)"
```

---

### Task 4: Rider location-privacy fields + heartbeat/track behavior

**Files:**
- Modify: `food/models.py` (`Rider`: add 2 fields)
- Modify: `food/views_food_ext.py` (`RiderHeartbeatView`)
- Modify: `food/views_orders.py` (`FoodOrderTrackView` — hide coords unless sharing)
- Create: `food/views_rider_privacy.py` (toggle endpoint)
- Modify: `food/urls.py` (1 path)
- Test: `food/tests/test_rider_privacy.py`

**Interfaces:**
- Produces: `Rider.is_sharing_location` (default False), `Rider.nav_display_enabled` (default True); `POST /api/food/rider/privacy/` (auth, rider) sets these; heartbeat stores coords only when sharing; track endpoint omits rider `lat/lng` unless the order is active and its rider is sharing.

- [ ] **Step 1: Write the failing test**

`food/tests/test_rider_privacy.py`:
```python
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from food.models import Rider

User = get_user_model()


def auth(client, user):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(RefreshToken.for_user(user).access_token)}")


class RiderPrivacyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.u = User.objects.create(username="r1", role="Rider")
        self.rider = Rider.objects.create(user=self.u, name="R1")

    def test_default_not_sharing(self):
        self.assertFalse(self.rider.is_sharing_location)
        self.assertTrue(self.rider.nav_display_enabled)

    def test_privacy_toggle(self):
        auth(self.client, self.u)
        res = self.client.post("/api/food/rider/privacy/",
                               {"is_sharing_location": True, "nav_display_enabled": False},
                               format="json")
        self.assertEqual(res.status_code, 200)
        self.rider.refresh_from_db()
        self.assertTrue(self.rider.is_sharing_location)
        self.assertFalse(self.rider.nav_display_enabled)

    def test_heartbeat_ignores_coords_when_not_sharing(self):
        auth(self.client, self.u)
        self.client.post("/api/food/rider/heartbeat/", {"lat": "23.81", "lng": "90.41"}, format="json")
        self.rider.refresh_from_db()
        self.assertIsNone(self.rider.current_lat)
        self.assertIsNotNone(self.rider.last_seen_at)

    def test_heartbeat_stores_coords_when_sharing(self):
        self.rider.is_sharing_location = True
        self.rider.save(update_fields=["is_sharing_location"])
        auth(self.client, self.u)
        self.client.post("/api/food/rider/heartbeat/", {"lat": "23.81", "lng": "90.41"}, format="json")
        self.rider.refresh_from_db()
        self.assertEqual(self.rider.current_lat, Decimal("23.810000"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_rider_privacy -v 2`
Expected: FAIL — fields/route missing.

- [ ] **Step 3: Add the model fields**

In `food/models.py`, inside `class Rider`, add after `last_seen_at`:
```python
    is_sharing_location = models.BooleanField(default=False)
    nav_display_enabled = models.BooleanField(default=True)
```

- [ ] **Step 4: Gate the heartbeat on consent**

In `food/views_food_ext.py` `RiderHeartbeatView.post`, change the coordinate-storing block so coords are only saved when sharing. Replace the `if lat is not None and lng is not None:` block body's tail so it reads:
```python
        lat, lng = request.data.get("lat"), request.data.get("lng")
        if rider.is_sharing_location and lat is not None and lng is not None:
            try:
                rider.current_lat = Decimal(str(lat))
                rider.current_lng = Decimal(str(lng))
            except (InvalidOperation, TypeError):
                return renderResponse(data={"lat": ["Invalid coordinate."]},
                                      message="Validation error", status=400)
            fields += ["current_lat", "current_lng"]
```
(Everything else in the method stays; `last_seen_at` still always updates.)

- [ ] **Step 5: Add the privacy toggle view**

`food/views_rider_privacy.py`:
```python
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from core.helpers import renderResponse
from food.views_food_ext import IsRider


class RiderPrivacyView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsRider]

    def post(self, request):
        rider = request.user.rider
        fields = []
        if "is_sharing_location" in request.data:
            rider.is_sharing_location = bool(request.data["is_sharing_location"])
            fields.append("is_sharing_location")
            if not rider.is_sharing_location:
                rider.current_lat = None
                rider.current_lng = None
                fields += ["current_lat", "current_lng"]
        if "nav_display_enabled" in request.data:
            rider.nav_display_enabled = bool(request.data["nav_display_enabled"])
            fields.append("nav_display_enabled")
        if fields:
            rider.save(update_fields=fields + ["updated_at"])
        return renderResponse(
            data={"is_sharing_location": rider.is_sharing_location,
                  "nav_display_enabled": rider.nav_display_enabled},
            message="Privacy updated")
```
> Confirm `IsRider` is importable from `food/views_food_ext.py` (the rider views use it). If it lives elsewhere, import it from its actual module.

In `food/urls.py` add the import and path:
```python
from food.views_rider_privacy import RiderPrivacyView
```
```python
    path("rider/privacy/", RiderPrivacyView.as_view(), name="food_rider_privacy"),
```

- [ ] **Step 6: Hide rider coords in the track endpoint unless sharing**

Open `food/views_orders.py` `FoodOrderTrackView`. Find where it serializes the assigned rider's `current_lat`/`current_lng` into the response. Wrap that so coordinates are included only when the order is active and the rider is sharing. Concretely, wherever rider position is added, guard it:
```python
        rider = order.rider
        share = bool(
            rider and rider.is_sharing_location
            and order.status not in [FoodOrder.Status.DELIVERED, FoodOrder.Status.CANCELLED]
        )
        rider_lat = str(rider.current_lat) if share and rider.current_lat is not None else None
        rider_lng = str(rider.current_lng) if share and rider.current_lng is not None else None
```
and use `rider_lat`/`rider_lng` in the payload instead of reading the rider fields directly. (Inspect the current payload keys and keep them identical — only their values become `None` when not sharing.)

- [ ] **Step 7: Migrate and run tests**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py makemigrations food && DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_rider_privacy food.tests.test_orders -v 1`
Expected: PASS (privacy tests + existing order tests still green).

- [ ] **Step 8: Commit**

```bash
git add food/models.py food/migrations food/views_food_ext.py food/views_orders.py food/views_rider_privacy.py food/urls.py food/tests/test_rider_privacy.py
git commit -m "feat(food): rider location-privacy (consent + nav toggle), gate heartbeat/track"
```

---

### Task 5: Public `mobile/config` endpoint

**Files:**
- Create: `food/views_mobile_config.py`
- Modify: `food/urls.py` (1 path)
- Test: `food/tests/test_mobile_config.py`

**Interfaces:**
- Produces: `GET /api/food/mobile/config/` (AllowAny) → `{min_supported_version:{customer,rider,restaurant}, feature_flags:{}, support:{facebook_url, messenger_url}, tile_url}`.

- [ ] **Step 1: Write the failing test**

`food/tests/test_mobile_config.py`:
```python
from django.test import TestCase
from rest_framework.test import APIClient


class MobileConfigTests(TestCase):
    def test_public_and_shape(self):
        res = APIClient().get("/api/food/mobile/config/")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertIn("customer", data["min_supported_version"])
        self.assertEqual(data["support"]["facebook_url"], "https://www.facebook.com/fabrything")
        self.assertIn("tile_url", data)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_mobile_config -v 2`
Expected: FAIL — 404.

- [ ] **Step 3: Implement the view**

`food/views_mobile_config.py`:
```python
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from core.helpers import renderResponse

MOBILE_CONFIG = {
    "min_supported_version": {"customer": "1.0.0", "rider": "1.0.0", "restaurant": "1.0.0"},
    "feature_flags": {"whatsapp_offers": False, "online_payment": False},
    "support": {
        "facebook_url": "https://www.facebook.com/fabrything",
        "messenger_url": "https://m.me/fabrything",
    },
    "tile_url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
}


class MobileConfigView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return renderResponse(data=MOBILE_CONFIG, message="Mobile config")
```

In `food/urls.py`:
```python
from food.views_mobile_config import MobileConfigView
```
```python
    path("mobile/config/", MobileConfigView.as_view(), name="food_mobile_config"),
```

- [ ] **Step 4: Run tests**

Run: `DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test food.tests.test_mobile_config -v 2`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add food/views_mobile_config.py food/urls.py food/tests/test_mobile_config.py
git commit -m "feat(food): public mobile/config endpoint (version gate + support links)"
```

---

### Task 6: Web — Facebook + Messenger link

**Files:**
- Modify: `frontend/ecommerce_inventory/src/storefront/layout/StorefrontLayout.js`
- Modify: `frontend/ecommerce_inventory/src/food/layout/FoodLayout.js`
- Test: `frontend/ecommerce_inventory/src/storefront/layout/StorefrontLayout.social.test.js`

**Interfaces:**
- Produces: a Facebook icon-link (`https://www.facebook.com/fabrything`) and a Messenger link (`https://m.me/fabrything`) visible in the storefront layout; a Facebook link in the food layout footer strip. Opens in a new tab with `rel="noopener noreferrer"`.

- [ ] **Step 1: Inspect the layout** — `StorefrontLayout.js` already imports the MUI `Facebook` icon (line 12). Find where social/contact icons render (search for `<Facebook` or the footer/contact `Box`). If a `Facebook` icon is already placed with a placeholder/`#` href, this task just sets the real href + adds Messenger; if it's imported but unused, add both into the existing contact area.

- [ ] **Step 2: Write the failing test**

`frontend/ecommerce_inventory/src/storefront/layout/StorefrontLayout.social.test.js`:
```javascript
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StorefrontLayout from './StorefrontLayout';

jest.mock('../../hooks/APIHandler', () => () => ({ callApi: jest.fn().mockResolvedValue({ data: {} }), loading: false }));

test('renders Facebook link to the fabrything page', async () => {
  render(<MemoryRouter><StorefrontLayout /></MemoryRouter>);
  const fb = await screen.findByRole('link', { name: /facebook/i });
  expect(fb).toHaveAttribute('href', 'https://www.facebook.com/fabrything');
  expect(fb).toHaveAttribute('target', '_blank');
});
```
> If `StorefrontLayout` requires context/providers to render, mirror the existing sibling test's wrapper setup (inspect an existing `*.test.js` under `storefront/` and copy its providers).

- [ ] **Step 3: Run test to verify it fails**

Run (from `frontend/ecommerce_inventory`): `CI=true npx react-scripts test --watchAll=false src/storefront/layout/StorefrontLayout.social.test.js`
Expected: FAIL — no Facebook link / wrong href.

- [ ] **Step 4: Add the links**

In `StorefrontLayout.js`, in the contact/social area, render (using the already-imported `Facebook` icon and MUI `IconButton`):
```jsx
<IconButton
  component="a"
  href="https://www.facebook.com/fabrything"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Facebook"
  color="inherit"
  size="small"
>
  <Facebook fontSize="small" />
</IconButton>
<IconButton
  component="a"
  href="https://m.me/fabrything"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Messenger"
  color="inherit"
  size="small"
>
  <Email fontSize="small" />
</IconButton>
```
> `Email` is already imported as a fallback Messenger glyph; if you prefer, import `Chat` from `@mui/icons-material` for Messenger and use it instead. Keep `aria-label="Messenger"` so the link is discoverable.

In `FoodLayout.js`, inside the partner footer strip (around the `Button component={Link} to="/food/partner"` block, line ~161), add a Facebook link:
```jsx
<Button component="a" href="https://www.facebook.com/fabrything" target="_blank"
        rel="noopener noreferrer" size="small" sx={{ ml: 1 }}>
  Facebook
</Button>
```

- [ ] **Step 5: Run test + build**

Run: `CI=true npx react-scripts test --watchAll=false src/storefront/layout/StorefrontLayout.social.test.js` → PASS.
Run: `CI=false npm run build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/ecommerce_inventory/src/storefront/layout/StorefrontLayout.js frontend/ecommerce_inventory/src/food/layout/FoodLayout.js frontend/ecommerce_inventory/src/storefront/layout/StorefrontLayout.social.test.js
git commit -m "feat(web): Facebook + Messenger links in storefront and food layouts"
```

---

# Part B — SP1 (in `fabrythingapps/`, Expo monorepo)

All Part B paths are relative to `fabrythingapps/`. This is a fresh git repo (already `git init`-ed); commit each task here.

### Task 7: Monorepo scaffold + `packages/core` skeleton

**Files:**
- Create: `package.json` (root, workspaces), `tsconfig.base.json`, `.nvmrc`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/jest.config.js`, `packages/core/src/env.ts`
- Modify: `.gitignore` (already present)

**Interfaces:**
- Produces: npm workspaces rooted at `fabrythingapps/` with `packages/*` and `apps/*`; `@fabrything/core` package importable by apps; `core` env accessor `getApiBaseUrl()`.

- [ ] **Step 1: Root workspace manifest**

`package.json`:
```json
{
  "name": "fabrything-apps",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "tsc -b"
  }
}
```
`.nvmrc`: `20`
`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-native",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 2: `packages/core` manifest + config**

`packages/core/package.json`:
```json
{
  "name": "@fabrything/core",
  "version": "0.1.0",
  "main": "src/index.ts",
  "scripts": { "test": "jest" },
  "dependencies": {
    "axios": "^1.7.0",
    "@tanstack/react-query": "^5.0.0"
  },
  "peerDependencies": { "react": "*", "react-native": "*" },
  "devDependencies": {
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "@types/jest": "^29.5.0",
    "typescript": "^5.5.0"
  }
}
```
`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```
`packages/core/jest.config.js`:
```js
module.exports = { preset: 'ts-jest', testEnvironment: 'node' };
```
`packages/core/src/env.ts`:
```ts
export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'https://fabrythingweb.onrender.com/api/';
}
```
> Real Render API base is `https://fabrythingweb.onrender.com/api/`. Apps override via `EXPO_PUBLIC_API_URL`.
`packages/core/src/index.ts`:
```ts
export { getApiBaseUrl } from './env';
```

- [ ] **Step 3: Install**

Run: `cd fabrythingapps && npm install`
Expected: workspaces link; `node_modules/@fabrything/core` symlinked.

- [ ] **Step 4: Smoke test the workspace**

`packages/core/src/env.test.ts`:
```ts
import { getApiBaseUrl } from './env';
test('defaults when env unset', () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  expect(getApiBaseUrl()).toMatch(/\/api\/$/);
});
```
Run: `npm --workspace @fabrything/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(mobile): npm-workspaces monorepo + @fabrything/core skeleton"
```

---

### Task 8: `core/api` — axios client with JWT + refresh

**Files:**
- Create: `packages/core/src/api/client.ts`, `packages/core/src/api/tokenStore.ts`, `packages/core/src/api/endpoints.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/api/client.test.ts`

**Interfaces:**
- Consumes: `getApiBaseUrl` (Task 7).
- Produces: `TokenStore` interface `{ getAccess, getRefresh, setTokens, clear }`; `createApiClient(store: TokenStore): AxiosInstance` — attaches `Authorization: Bearer <access>`, and on a 401 calls `/auth/refresh` once, stores new tokens, retries; `endpoints` (string constants for the DRF routes used by apps).

- [ ] **Step 1: Write the failing test**

`packages/core/src/api/client.test.ts`:
```ts
import MockAdapter from 'axios-mock-adapter';
import { createApiClient } from './client';

const memStore = () => {
  let a = 'A', r = 'R';
  return { getAccess: async () => a, getRefresh: async () => r,
    setTokens: async (na: string, nr: string) => { a = na; r = nr; },
    clear: async () => { a = ''; r = ''; } };
};

test('attaches bearer token', async () => {
  const store = memStore();
  const api = createApiClient(store);
  const mock = new MockAdapter(api);
  mock.onGet('/food/restaurants/').reply((cfg) => {
    expect(cfg.headers?.Authorization).toBe('Bearer A');
    return [200, { data: [] }];
  });
  await api.get('/food/restaurants/');
});

test('refreshes once on 401 then retries', async () => {
  const store = memStore();
  const api = createApiClient(store);
  const mock = new MockAdapter(api);
  let calls = 0;
  mock.onGet('/food/rider/me/').reply(() => (++calls === 1 ? [401, {}] : [200, { ok: true }]));
  mock.onPost('/store/auth/refresh/').reply(200, { access: 'A2', refresh: 'R2' });
  const res = await api.get('/food/rider/me/');
  expect(res.data).toEqual({ ok: true });
  expect(await store.getAccess()).toBe('A2');
});
```
Add dev dep: `npm --workspace @fabrything/core i -D axios-mock-adapter`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @fabrything/core test -- client`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`packages/core/src/api/tokenStore.ts`:
```ts
export interface TokenStore {
  getAccess(): Promise<string | null>;
  getRefresh(): Promise<string | null>;
  setTokens(access: string, refresh: string): Promise<void>;
  clear(): Promise<void>;
}
```
`packages/core/src/api/client.ts`:
```ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiBaseUrl } from '../env';
import { TokenStore } from './tokenStore';

export function createApiClient(store: TokenStore): AxiosInstance {
  const api = axios.create({ baseURL: getApiBaseUrl(), timeout: 15000 });

  api.interceptors.request.use(async (config) => {
    const access = await store.getAccess();
    if (access) config.headers.Authorization = `Bearer ${access}`;
    return config;
  });

  let refreshing: Promise<string | null> | null = null;
  api.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const original: any = error.config;
      if (error.response?.status === 401 && original && !original._retried) {
        original._retried = true;
        if (!refreshing) {
          refreshing = (async () => {
            const refresh = await store.getRefresh();
            if (!refresh) return null;
            try {
              const res = await axios.post(`${getApiBaseUrl()}store/auth/refresh/`, { refresh });
              await store.setTokens(res.data.access, res.data.refresh ?? refresh);
              return res.data.access as string;
            } catch {
              await store.clear();
              return null;
            }
          })();
        }
        const newAccess = await refreshing;
        refreshing = null;
        if (newAccess) {
          original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        }
      }
      return Promise.reject(error);
    },
  );
  return api;
}
```
> Resolved: the backend refresh route is `store/auth/refresh/` (storefront is mounted at `/api/store/`). It returns a **flat** `{access, refresh, message}` and re-issues tokens via the same `issue_tokens` helper as login, so the refreshed access keeps its `role`/`username` claims.
`packages/core/src/api/endpoints.ts`:
```ts
export const endpoints = {
  login: 'store/auth/login/',
  refresh: 'store/auth/refresh/',
  restaurants: 'food/restaurants/',
  riderMe: 'food/rider/me/',
  vendorRestaurant: 'food/vendor/restaurant/',
  deviceRegister: 'food/devices/register/',
  deviceUnregister: 'food/devices/unregister/',
  riderPrivacy: 'food/rider/privacy/',
  mobileConfig: 'food/mobile/config/',
  notifications: 'food/notifications/',
} as const;
```
Export from `index.ts`: `export * from './api/client'; export * from './api/tokenStore'; export * from './api/endpoints';`

- [ ] **Step 4: Run tests**

Run: `npm --workspace @fabrything/core test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): axios client with JWT attach + single-flight refresh"
```

---

### Task 9: `core/auth` — secure token store + login

**Files:**
- Create: `packages/core/src/auth/secureTokenStore.ts`, `packages/core/src/auth/login.ts`, `packages/core/src/auth/useAuth.tsx`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/auth/login.test.ts`

**Interfaces:**
- Consumes: `createApiClient`, `endpoints`, `TokenStore` (Task 8).
- Produces: `makeSecureTokenStore()` (expo-secure-store backed, implements `TokenStore`); `login(api, identifier, password) -> {access, refresh, role, username}` (role/username decoded from the JWT access claim); `AuthProvider` + `useAuth()` (`{role, username, signIn, signOut, loading}`).

- [ ] **Step 1: Write the failing test**

`packages/core/src/auth/login.test.ts`:
```ts
import MockAdapter from 'axios-mock-adapter';
import { createApiClient } from '../api/client';
import { login } from './login';

const store = () => ({ getAccess: async () => null, getRefresh: async () => null,
  setTokens: async () => {}, clear: async () => {} });

function makeJwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

test('login decodes role and username from the JWT access claim', async () => {
  const api = createApiClient(store());
  const mock = new MockAdapter(api);
  const access = makeJwt({ role: 'Rider', username: 'r1' });
  mock.onPost('/store/auth/login/').reply(200, { access, refresh: 'R', message: 'Login successful' });
  const res = await login(api, '01700000000', 'pw');
  expect(res.access).toBe(access);
  expect(res.role).toBe('Rider');
  expect(res.username).toBe('r1');
});
```
> The real backend login (`/api/store/auth/login/`, used by customer, rider, AND restaurant — the web rider login does the same) returns a **flat** `{access, refresh, message}` with **no user object**; `role`/`username` are claims embedded on the access token. `login()` therefore decodes them with `jwt-decode`.

- [ ] **Step 2: Run test → FAIL** (`npm --workspace @fabrything/core test -- login`).

- [ ] **Step 3: Implement**

`packages/core/src/auth/secureTokenStore.ts`:
```ts
import * as SecureStore from 'expo-secure-store';
import { TokenStore } from '../api/tokenStore';

const A = 'fabrything.access';
const R = 'fabrything.refresh';

export function makeSecureTokenStore(): TokenStore {
  return {
    getAccess: () => SecureStore.getItemAsync(A),
    getRefresh: () => SecureStore.getItemAsync(R),
    setTokens: async (access, refresh) => {
      await SecureStore.setItemAsync(A, access);
      await SecureStore.setItemAsync(R, refresh);
    },
    clear: async () => { await SecureStore.deleteItemAsync(A); await SecureStore.deleteItemAsync(R); },
  };
}
```
`packages/core/src/auth/login.ts`:
```ts
import { AxiosInstance } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { endpoints } from '../api/endpoints';

export interface LoginResult { access: string; refresh: string; role: string; username: string; }

interface AccessClaims { role?: string; username?: string; }

export async function login(api: AxiosInstance, identifier: string, password: string): Promise<LoginResult> {
  // Backend login returns a flat {access, refresh, message}; role/username are
  // claims on the access token, not in the body.
  const res = await api.post(endpoints.login, { username: identifier, password });
  const { access, refresh } = res.data;
  const claims = jwtDecode<AccessClaims>(access);
  return { access, refresh, role: claims.role ?? '', username: claims.username ?? '' };
}
```
> Add the dep first: `npm i jwt-decode -w @fabrything/core` (small, RN-safe, handles base64url).
`packages/core/src/auth/useAuth.tsx`:
```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AxiosInstance } from 'axios';
import { TokenStore } from '../api/tokenStore';
import { login as doLogin } from './login';

type Session = { role: string; username: string };
type AuthState = { role: string | null; username: string | null; loading: boolean;
  signIn: (id: string, pw: string) => Promise<void>; signOut: () => Promise<void>; };

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ api, store, children }:
  { api: AxiosInstance; store: TokenStore; children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { store.getAccess().then(() => setLoading(false)); }, [store]);
  const signIn = async (id: string, pw: string) => {
    const res = await doLogin(api, id, pw);
    await store.setTokens(res.access, res.refresh);
    setSession({ role: res.role, username: res.username });
  };
  const signOut = async () => { await store.clear(); setSession(null); };
  return <Ctx.Provider value={{ role: session?.role ?? null, username: session?.username ?? null, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
```
Export the three from `index.ts`.

- [ ] **Step 4: Run tests → PASS.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): secure token store + login + AuthProvider/useAuth"
```

---

### Task 10: `core/i18n`, `core/theme`, `core/config` + version gate

**Files:**
- Create: `packages/core/src/i18n/index.ts`, `packages/core/src/i18n/strings.ts`, `packages/core/src/theme/tokens.ts`, `packages/core/src/config/mobileConfig.ts`, `packages/core/src/config/version.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/i18n/i18n.test.ts`, `packages/core/src/config/version.test.ts`

**Interfaces:**
- Produces: `t(key, lang)` with en/bn dictionaries + English fallback; `theme` tokens (colors incl. brand, spacing, radius) for light/dark; `fetchMobileConfig(api)`; `isVersionSupported(current, min) -> boolean`.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/i18n/i18n.test.ts`:
```ts
import { t } from './index';
test('returns bn when present', () => { expect(t('login', 'bn')).not.toBe('login'); });
test('falls back to en when bn missing', () => { expect(t('__missing_bn__' as any, 'bn')).toBe(t('__missing_bn__' as any, 'en')); });
```
`packages/core/src/config/version.test.ts`:
```ts
import { isVersionSupported } from './version';
test('equal is supported', () => expect(isVersionSupported('1.0.0', '1.0.0')).toBe(true));
test('older is unsupported', () => expect(isVersionSupported('1.0.0', '1.1.0')).toBe(false));
test('newer is supported', () => expect(isVersionSupported('2.0.0', '1.5.0')).toBe(true));
```

- [ ] **Step 2: Run tests → FAIL.**

- [ ] **Step 3: Implement**

`packages/core/src/i18n/strings.ts`:
```ts
export const strings = {
  en: { login: 'Log in', phone: 'Phone number', password: 'Password', available: 'Available',
        offline: 'You are offline', retry: 'Retry', restaurants: 'Restaurants' },
  bn: { login: 'লগ ইন', phone: 'ফোন নম্বর', password: 'পাসওয়ার্ড', available: 'উপলব্ধ',
        offline: 'আপনি অফলাইন', retry: 'আবার চেষ্টা', restaurants: 'রেস্তোরাঁ' },
} as const;
export type StringKey = keyof typeof strings['en'];
```
`packages/core/src/i18n/index.ts`:
```ts
import { strings, StringKey } from './strings';
export function t(key: StringKey, lang: 'en' | 'bn' = 'en'): string {
  const table = strings[lang] as Record<string, string>;
  return table[key] ?? strings.en[key] ?? String(key);
}
export { strings };
```
`packages/core/src/config/version.ts`:
```ts
export function isVersionSupported(current: string, min: string): boolean {
  const c = current.split('.').map(Number), m = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((c[i] ?? 0) > (m[i] ?? 0)) return true; if ((c[i] ?? 0) < (m[i] ?? 0)) return false; }
  return true;
}
```
`packages/core/src/config/mobileConfig.ts`:
```ts
import { AxiosInstance } from 'axios';
import { endpoints } from '../api/endpoints';
export interface MobileConfig {
  min_supported_version: Record<'customer' | 'rider' | 'restaurant', string>;
  feature_flags: Record<string, boolean>;
  support: { facebook_url: string; messenger_url: string };
  tile_url: string;
}
export async function fetchMobileConfig(api: AxiosInstance): Promise<MobileConfig> {
  const res = await api.get(endpoints.mobileConfig);
  return res.data.data as MobileConfig;
}
```
`packages/core/src/theme/tokens.ts`:
```ts
export const brand = { primary: '#E8542F', secondary: '#F7A81B', dark: '#1B1B1B' };
export const theme = {
  light: { bg: '#FFFFFF', text: '#1B1B1B', card: '#F6F6F6', ...brand },
  dark: { bg: '#121212', text: '#F5F5F5', card: '#1E1E1E', ...brand },
  space: (n: number) => n * 8,
  radius: 12,
};
```
> Replace `brand.primary/secondary` with the exact hex values from the web MUI theme (inspect `fabrythingweb` `src/food/theme.js`).
Export all from `index.ts`.

- [ ] **Step 4: Run tests → PASS.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): i18n (en/bn fallback), theme tokens, mobile-config + version gate"
```

---

### Task 11: `core/push` — Expo push registration

**Files:**
- Create: `packages/core/src/push/register.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/push/register.test.ts`

**Interfaces:**
- Consumes: `endpoints`, an `AxiosInstance`.
- Produces: `registerForPush(api, app, deps) -> string | null` where `deps` injects the expo-notifications + platform functions (so it is unit-testable without the native module). On success it POSTs the token to `devices/register/` and returns it; on denied permission returns `null`.

- [ ] **Step 1: Write the failing test**

`packages/core/src/push/register.test.ts`:
```ts
import MockAdapter from 'axios-mock-adapter';
import { createApiClient } from '../api/client';
import { registerForPush } from './register';

const store = () => ({ getAccess: async () => 'A', getRefresh: async () => 'R', setTokens: async () => {}, clear: async () => {} });

test('registers token when permission granted', async () => {
  const api = createApiClient(store());
  const mock = new MockAdapter(api);
  let posted: any = null;
  mock.onPost('/food/devices/register/').reply((cfg) => { posted = JSON.parse(cfg.data); return [200, { data: {} }]; });
  const deps = {
    getPermissions: async () => ({ granted: true }),
    requestPermissions: async () => ({ granted: true }),
    getExpoPushToken: async () => 'ExponentPushToken[zzz]',
    platform: 'android' as const,
  };
  const token = await registerForPush(api, 'rider', deps);
  expect(token).toBe('ExponentPushToken[zzz]');
  expect(posted).toEqual({ expo_token: 'ExponentPushToken[zzz]', app: 'rider', platform: 'android' });
});

test('returns null when permission denied', async () => {
  const api = createApiClient(store());
  new MockAdapter(api);
  const deps = { getPermissions: async () => ({ granted: false }), requestPermissions: async () => ({ granted: false }),
    getExpoPushToken: async () => 'x', platform: 'android' as const };
  expect(await registerForPush(api, 'customer', deps)).toBeNull();
});
```

- [ ] **Step 2: Run test → FAIL.**

- [ ] **Step 3: Implement**

`packages/core/src/push/register.ts`:
```ts
import { AxiosInstance } from 'axios';
import { endpoints } from '../api/endpoints';

export interface PushDeps {
  getPermissions(): Promise<{ granted: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  getExpoPushToken(): Promise<string>;
  platform: 'ios' | 'android';
}

export async function registerForPush(
  api: AxiosInstance, app: 'customer' | 'rider' | 'restaurant', deps: PushDeps,
): Promise<string | null> {
  let perm = await deps.getPermissions();
  if (!perm.granted) perm = await deps.requestPermissions();
  if (!perm.granted) return null;
  const token = await deps.getExpoPushToken();
  await api.post(endpoints.deviceRegister, { expo_token: token, app, platform: deps.platform });
  return token;
}
```
Export from `index.ts`. (Apps supply `deps` from `expo-notifications` + `react-native` `Platform`.)

- [ ] **Step 4: Run tests → PASS.** Then full core suite: `npm --workspace @fabrything/core test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): dependency-injected Expo push registration"
```

---

### Task 12: Customer app — scaffold, login, home (restaurant list)

**Files:**
- Create (via generator, then edit): `apps/customer/*` — `app.config.ts`, `app/_layout.tsx`, `app/login.tsx`, `app/index.tsx`, `src/providers.tsx`, `jest.config.js`, `app/index.test.tsx`
- Modify: root `package.json` is unaffected (workspaces autodiscover)

**Interfaces:**
- Consumes: `@fabrything/core` (api, auth, i18n, theme, config, push).
- Produces: an Expo Router app that logs in and renders the live ACTIVE restaurant list; `providers.tsx` wires QueryClient + AuthProvider + api client + secure store.

- [ ] **Step 1: Generate the Expo app**

Run from `fabrythingapps/`:
```bash
npx create-expo-app@latest apps/customer --template expo-template-blank-typescript
cd apps/customer && npx expo install expo-router expo-secure-store expo-notifications react-native-safe-area-context react-native-screens
npm i @fabrything/core @tanstack/react-query axios
```
Set `apps/customer/package.json` `"name": "@fabrything/customer"`. Configure Expo Router entry per Expo docs (`"main": "expo-router/entry"`).

- [ ] **Step 2: `app.config.ts` (identity + API URL)**

`apps/customer/app.config.ts`:
```ts
import { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Fabrything', slug: 'fabrything-customer', scheme: 'fabrythingcustomer',
  version: '1.0.0', orientation: 'portrait', icon: './assets/icon.png',
  splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#E8542F' },
  ios: { bundleIdentifier: 'com.fabrything.customer', supportsTablet: false },
  android: { package: 'com.fabrything.customer', adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#E8542F' } },
  plugins: ['expo-router', 'expo-secure-store', 'expo-notifications'],
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL },
};
export default config;
```

- [ ] **Step 3: Providers**

`apps/customer/src/providers.tsx`:
```tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, createApiClient, makeSecureTokenStore } from '@fabrything/core';

const store = makeSecureTokenStore();
export const api = createApiClient(store);
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api} store={store}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Write the failing home smoke test**

`apps/customer/app/index.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import Home from './index';

jest.mock('../src/providers', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: { data: [{ id: 1, name: 'Rahim Hotel', slug: 'rahim' }] } }) },
}));
jest.mock('@fabrything/core', () => ({ useAuth: () => ({ role: 'Customer' }), t: (k: string) => k }));

test('renders a restaurant from the API', async () => {
  render(<Home />);
  await waitFor(() => expect(screen.getByText('Rahim Hotel')).toBeTruthy());
});
```
Add jest + RN testing deps and `jest.config.js` (`preset: 'jest-expo'`), plus `@testing-library/react-native`, `jest-expo` as dev deps.

- [ ] **Step 5: Run test → FAIL** (`npm --workspace @fabrything/customer test`).

- [ ] **Step 6: Implement login + home**

`apps/customer/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
import { Providers } from '../src/providers';
export default function Root() {
  return <Providers><Stack screenOptions={{ headerTitle: 'Fabrything' }} /></Providers>;
}
```
`apps/customer/app/login.tsx`:
```tsx
import { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, t } from '@fabrything/core';

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [id, setId] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  const onSubmit = async () => {
    try { await signIn(id, pw); router.replace('/'); } catch { setErr('Login failed'); }
  };
  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text>{t('phone', 'en')}</Text>
      <TextInput value={id} onChangeText={setId} autoCapitalize="none" keyboardType="phone-pad"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      <Text>{t('password', 'en')}</Text>
      <TextInput value={pw} onChangeText={setPw} secureTextEntry style={{ borderWidth: 1, padding: 10, borderRadius: 8 }} />
      {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}
      <Button title={t('login', 'en')} onPress={onSubmit} />
    </View>
  );
}
```
`apps/customer/app/index.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { api } from '../src/providers';

export default function Home() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    api.get('food/restaurants/').then((r) => setRows(r.data.data ?? r.data)).catch(() => setRows([]));
  }, []);
  if (rows === null) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <FlatList data={rows} keyExtractor={(x) => String(x.id)}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontSize: 16 }}>{item.name}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={{ padding: 24 }}>No restaurants yet.</Text>} />
  );
}
```

- [ ] **Step 7: Run test → PASS.** Then typecheck: `npx tsc --noEmit` in `apps/customer`.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(customer): Expo Router app — login + live restaurant list"
```

---

### Task 13: Rider app — scaffold, login, home (availability + privacy)

**Files:**
- Create: `apps/rider/*` mirroring Task 12 structure — `app.config.ts` (id `com.fabrything.rider`, name `Fabrything Rider`, background color `#1B1B1B`), `app/_layout.tsx`, `app/login.tsx`, `app/index.tsx` (availability + a **Share location** switch calling `food/rider/privacy/`), `src/providers.tsx`, `app/index.test.tsx`
- Add rider location plugin: `npx expo install expo-location`

**Interfaces:**
- Consumes: `@fabrything/core`; `endpoints.riderMe`, `endpoints.riderPrivacy`.
- Produces: rider home that shows `rider/me` and toggles `is_sharing_location` (default off, per privacy model). Full offer/countdown/nav UI is SP3 — foundation proves auth + the privacy toggle round-trips.

- [ ] **Step 1: Generate + wire** (repeat Task 12 Steps 1–3 with rider identity; add `expo-location`).

- [ ] **Step 2: Failing test** `apps/rider/app/index.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import Home from './index';
jest.mock('../src/providers', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: { data: { name: 'R1', is_available: true, is_sharing_location: false } } }),
         post: jest.fn().mockResolvedValue({ data: { data: { is_sharing_location: true } } }) },
}));
jest.mock('@fabrything/core', () => ({ useAuth: () => ({ role: 'Rider' }), t: (k: string) => k }));
test('shows rider name and a share-location control', async () => {
  render(<Home />);
  await waitFor(() => expect(screen.getByText('R1')).toBeTruthy());
  expect(screen.getByText(/share location/i)).toBeTruthy();
});
```

- [ ] **Step 3: Run test → FAIL.**

- [ ] **Step 4: Implement** `apps/rider/app/index.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { api } from '../src/providers';

export default function Home() {
  const [rider, setRider] = useState<any | null>(null);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    api.get('food/rider/me/').then((r) => { const d = r.data.data ?? r.data; setRider(d); setSharing(!!d.is_sharing_location); });
  }, []);
  const toggle = async (v: boolean) => {
    setSharing(v);
    await api.post('food/rider/privacy/', { is_sharing_location: v });
  };
  if (!rider) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 20 }}>{rider.name}</Text>
      <Text>Available: {String(rider.is_available)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>Share location</Text>
        <Switch value={sharing} onValueChange={toggle} />
      </View>
    </View>
  );
}
```
(Login screen identical to Task 12; reuse the same code.)

- [ ] **Step 5: Run test → PASS; typecheck.**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(rider): Expo app — login + availability + share-location toggle"
```

---

### Task 14: Restaurant app — scaffold, login, home (profile)

**Files:**
- Create: `apps/restaurant/*` mirroring Task 12 — identity `com.fabrything.restaurant`, name `Fabrything Partner`, background `#F7A81B`; `app/index.tsx` shows `vendor/restaurant`; `app/index.test.tsx`.

**Interfaces:**
- Consumes: `@fabrything/core`; `endpoints.vendorRestaurant`.
- Produces: restaurant home rendering the vendor's own restaurant name + open/closed state (read-only in foundation; order management is SP4).

- [ ] **Step 1: Generate + wire** (repeat Task 12 Steps 1–3 with restaurant identity).

- [ ] **Step 2: Failing test** `apps/restaurant/app/index.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import Home from './index';
jest.mock('../src/providers', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: { data: { name: 'Rahim Hotel', is_open: true } } }) },
}));
jest.mock('@fabrything/core', () => ({ useAuth: () => ({ role: 'Restaurant' }), t: (k: string) => k }));
test('shows the vendor restaurant name', async () => {
  render(<Home />);
  await waitFor(() => expect(screen.getByText('Rahim Hotel')).toBeTruthy());
});
```

- [ ] **Step 3: Run test → FAIL.**

- [ ] **Step 4: Implement** `apps/restaurant/app/index.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { api } from '../src/providers';
export default function Home() {
  const [r, setR] = useState<any | null>(null);
  useEffect(() => { api.get('food/vendor/restaurant/').then((res) => setR(res.data.data ?? res.data)); }, []);
  if (!r) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <View style={{ padding: 24, gap: 8 }}>
      <Text style={{ fontSize: 20 }}>{r.name}</Text>
      <Text>{r.is_open ? 'Open' : 'Closed'}</Text>
    </View>
  );
}
```
(Login screen identical to Task 12.)

- [ ] **Step 5: Run test → PASS; typecheck.**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(restaurant): Expo app — login + vendor restaurant profile"
```

---

### Task 15: Branding — icons + splash from Fabrything logos

**Files:**
- Create: `apps/customer/assets/{icon.png,adaptive-icon.png,splash.png}` and same for `apps/rider`, `apps/restaurant`
- Create: `tools/gen-icons.md` (documented steps)

**Interfaces:**
- Produces: per-app 1024×1024 `icon.png`, 1024×1024 `adaptive-icon.png` (foreground), and a `splash.png`, derived from the web square logos, tinted per module (Customer red `#E8542F`, Rider dark `#1B1B1B`, Partner amber `#F7A81B`).

- [ ] **Step 1: Copy source logos**

Run from `fabrythingapps/`:
```bash
mkdir -p tools/brand
cp ../fabrythingweb/frontend/ecommerce_inventory/public/logo_square_light.png tools/brand/
cp ../fabrythingweb/frontend/ecommerce_inventory/public/logo_square_dark.png tools/brand/
```

- [ ] **Step 2: Generate per-app assets**

Use the Expo asset conventions: each `icon.png` = 1024×1024, `adaptive-icon.png` foreground = 1024×1024 on a transparent field, splash = the logo centered. Produce them with any image tool (document the exact commands in `tools/gen-icons.md`). Customer uses `logo_square_light` on `#E8542F`; Rider uses `logo_square_light` on `#1B1B1B`; Partner uses `logo_square_dark` on `#F7A81B`. Place each into the matching `apps/<app>/assets/`.

- [ ] **Step 3: Verify config references resolve**

For each app run `npx expo config --type public` (from the app dir) and confirm no missing-asset errors for icon/splash/adaptive-icon.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(mobile): per-app branding (icons + splash from Fabrything logos)"
```

---

### Task 16: EAS build profiles + GitHub Actions CI + APK verification

**Files:**
- Create: `eas.json`, `.github/workflows/mobile-ci.yml`
- Create: `docs/RELEASE.md` (how to build/submit each app)

**Interfaces:**
- Produces: EAS `development`/`preview`(APK)/`production` profiles; a CI workflow running typecheck + tests on PRs; documented commands to produce an installable Android APK.

- [ ] **Step 1: `eas.json`**
```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 2: CI workflow** `.github/workflows/mobile-ci.yml`:
```yaml
name: mobile-ci
on: { pull_request: {}, push: { branches: [main] } }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test --workspaces --if-present
```

- [ ] **Step 3: `docs/RELEASE.md`**

Document: create a free Expo account; `npm i -g eas-cli`; `eas login`; per app `cd apps/<app> && eas build --profile preview --platform android` → produces an installable **APK** URL; `eas build --profile preview --platform ios` needs the Apple account (SP2); `eas submit` targets (Play internal / TestFlight) are configured in SP2. Record the `EXPO_PUBLIC_API_URL` value each app is built with.

- [ ] **Step 4: Verify CI config locally**

Run from `fabrythingapps/`: `npm run typecheck && npm test --workspaces --if-present`
Expected: typecheck clean; all workspace tests pass.
> Producing the actual signed APK requires the owner's Expo account (documented dependency). Do not block this task on it; the `eas build` command is verified by `eas.json` validity (`eas build --profile preview --platform android --dry-run` if the account exists).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(mobile): EAS profiles + GitHub Actions CI + release docs"
```

---

### Task 17: `fabrythingapps/CLAUDE.md` + memory updates (token efficiency)

**Files:**
- Create: `fabrythingapps/CLAUDE.md`
- Create/Update (in the user's memory dir): `mobile-overview.md`, `mobile-foundation-decisions.md`, and `MEMORY.md` index lines

**Interfaces:**
- Produces: a project guide so future sessions skip re-derivation; memory entries capturing the locked decisions.

- [ ] **Step 1: Write `fabrythingapps/CLAUDE.md`**

Include: monorepo layout; the rule "**shared logic lives in `packages/core`; apps stay thin**"; per-app commands (`npm --workspace @fabrything/<app> test`, `npx tsc --noEmit`, `eas build --profile preview --platform android`); API base + `EXPO_PUBLIC_API_URL`; the three app IDs; "how to add a screen" (Expo Router file under `app/`, consume `api` from `src/providers`, strings via `core/i18n`); pointer to the spec + this plan; the note that the backend lives in the sibling `fabrythingweb/` repo and its food API is the contract.

- [ ] **Step 2: Write memory files** (dir: `/home/hossain/.claude/projects/-home-hossain-Music-fabrything/memory/`)

`mobile-overview.md` (type project): the three Expo apps, repo location, `core` package, maps=OSM, push=Expo, realtime=polling, links to `[[fabrything-overview]]`.
`mobile-foundation-decisions.md` (type project): the locked decisions table (separate apps, Android-first, Expo push now/WhatsApp later, no dev accounts yet), and the SP0–SP5 decomposition with build order.
Add two lines to `MEMORY.md` index.

- [ ] **Step 3: Commit (mobile repo)**

```bash
git add fabrythingapps/CLAUDE.md 2>/dev/null; cd fabrythingapps && git add CLAUDE.md && git commit -m "docs(mobile): CLAUDE.md project guide for cheap future sessions"
```
(Memory files live outside the repo and are not committed.)

---

## Self-Review Notes (author)

- **Spec coverage:** DeviceToken (T1) ✓; register/unregister (T2) ✓; Expo push wired into existing `notify()` (T3) ✓; rider privacy consent + nav toggle + heartbeat/track gating (T4) ✓; public mobile-config (T5) ✓; web Facebook/Messenger (T6) ✓; monorepo + core skeleton (T7) ✓; api client + refresh (T8) ✓; secure auth + login (T9) ✓; i18n/theme/config/version (T10) ✓; push registration (T11) ✓; three apps login+home proving the live-API chain (T12–T14) ✓; branding (T15) ✓; EAS + CI + APK path (T16) ✓; CLAUDE.md + memory (T17) ✓.
- **No new backend dependency:** T3 uses stdlib `urllib.request`. ✓
- **Privacy default:** `is_sharing_location` defaults False; heartbeat/track gated on it. ✓
- **Integration point discipline:** push added at the single `notify()` helper, not scattered. ✓
- **Type consistency:** `TokenStore`, `createApiClient`, `endpoints`, `registerForPush(api, app, deps)`, `fetchMobileConfig`, `isVersionSupported` names match across tasks. ✓
- **External dependency (documented, non-blocking):** the actual signed APK/iOS builds need the owner's Expo/Apple/Google accounts; sequenced in `docs/RELEASE.md` and Task 16.
- **Verify-before-assert points:** refresh route path (T8), login response shape (T9), brand hex + track payload keys (T4/T10) each carry an explicit "inspect the real code and match" instruction.
