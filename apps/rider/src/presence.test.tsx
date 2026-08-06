import { cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

// Why this file exists: the server will not dispatch to a rider unless ALL of
// `is_available`, a fresh `last_seen_at` and a non-null `current_lat/lng` hold
// (food/services_dispatch.py `dispatchable_riders`). The app shipped setting
// only the first, so an APK rider went "Online" and silently received nothing.
// These pin the other two.

const mockHeartbeat = jest.fn().mockResolvedValue(undefined);
const mockRequestPerms = jest.fn().mockResolvedValue({ granted: true });
const mockGetPosition = jest.fn().mockResolvedValue({
  coords: { latitude: 23.9081, longitude: 90.9876 },
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...a: unknown[]) => mockRequestPerms(...a),
  getCurrentPositionAsync: (...a: unknown[]) => mockGetPosition(...a),
  Accuracy: { Balanced: 3 },
}));
jest.mock('./providers', () => ({ api: { post: jest.fn() } }));
jest.mock('@fabrything/core', () => ({
  sendRiderHeartbeat: (...a: unknown[]) => mockHeartbeat(...a),
}));

import { useRiderPresence } from './presence';

// A short interval keeps these on real timers: the hook interleaves promises
// with setInterval, and fake timers make that ordering far harder to reason
// about than it is worth here.
const FAST = 30;

// RNTL 14's `renderHook` does not give back a usable `rerender` here, so the
// hook is exercised through a host component — the same shape the rest of this
// app's tests use.
function Probe({ on }: { on: boolean }) {
  return <Text testID="state">{useRiderPresence(on, FAST)}</Text>;
}

const stateText = () => screen.getByTestId('state').props.children;

// This RNTL build returns an empty object from `render()` and hangs the whole
// result API off `screen` instead. Auto-cleanup does not fire either, and a
// leaked component keeps its heartbeat interval running into the next test.
afterEach(cleanup);

beforeEach(() => {
  mockHeartbeat.mockClear().mockResolvedValue(undefined);
  mockRequestPerms.mockClear().mockResolvedValue({ granted: true });
  mockGetPosition
    .mockClear()
    .mockResolvedValue({ coords: { latitude: 23.9081, longitude: 90.9876 } });
});

test('beats immediately with coordinates once the rider goes available', async () => {
  render(<Probe on />);

  // Immediately, not after one interval — a rider who flips the switch must be
  // dispatchable now, not 20s from now.
  await waitFor(() => expect(mockHeartbeat).toHaveBeenCalled());
  expect(mockHeartbeat.mock.calls[0][1]).toEqual({ lat: 23.9081, lng: 90.9876 });
  await waitFor(() => expect(stateText()).toBe('online'));
});

test('does not beat at all while the rider is unavailable', async () => {
  render(<Probe on={false} />);

  await new Promise((r) => setTimeout(r, FAST * 3));
  expect(mockHeartbeat).not.toHaveBeenCalled();
  expect(stateText()).toBe('offline');
});

test('reports no-location when permission is denied, and still beats', async () => {
  mockRequestPerms.mockResolvedValue({ granted: false });
  render(<Probe on />);

  // Presence still matters: a heartbeat without coords leaves any previously
  // stored position intact server-side, so it can only help.
  await waitFor(() => expect(mockHeartbeat).toHaveBeenCalled());
  expect(mockGetPosition).not.toHaveBeenCalled();
  expect(mockHeartbeat.mock.calls[0][1]).toBeUndefined();
  await waitFor(() => expect(stateText()).toBe('no-location'));
});

test('keeps beating on the interval', async () => {
  render(<Probe on />);
  await waitFor(() => expect(mockHeartbeat.mock.calls.length).toBeGreaterThanOrEqual(3));
});

test('a failed beat does not stop the next one', async () => {
  mockHeartbeat.mockRejectedValueOnce(new Error('network'));
  render(<Probe on />);

  // Rural connections drop pings; the loop has to survive that or one bad
  // moment takes the rider off dispatch for the rest of the shift.
  await waitFor(() => expect(mockHeartbeat.mock.calls.length).toBeGreaterThanOrEqual(2));
});

test('re-uses the last known fix when a position read fails', async () => {
  mockGetPosition
    .mockResolvedValueOnce({ coords: { latitude: 23.9081, longitude: 90.9876 } })
    .mockRejectedValue(new Error('gps timeout'));
  render(<Probe on />);

  await waitFor(() => expect(mockHeartbeat.mock.calls.length).toBeGreaterThanOrEqual(2));
  // Still sending a position rather than dropping to a coordless ping, which
  // would be indistinguishable from "never had a fix" for a new rider.
  expect(mockHeartbeat.mock.calls[1][1]).toEqual({ lat: 23.9081, lng: 90.9876 });
});

test('stops beating when the rider goes unavailable', async () => {
  render(<Probe on />);
  await waitFor(() => expect(mockHeartbeat).toHaveBeenCalled());

  screen.rerender(<Probe on={false} />);
  const after = mockHeartbeat.mock.calls.length;
  await new Promise((r) => setTimeout(r, FAST * 3));
  expect(mockHeartbeat.mock.calls.length).toBe(after);
});
