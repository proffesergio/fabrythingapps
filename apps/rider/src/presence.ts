import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { sendRiderHeartbeat } from '@fabrything/core';
import { api } from './providers';

/**
 * Presence + position ping, the thing that actually makes a rider dispatchable.
 *
 * `food/services_dispatch.py::dispatchable_riders` filters on THREE conditions:
 * `is_available` (the rider's own switch), `last_seen_at` inside
 * `Rider.PRESENCE_WINDOW_MINUTES`, and a non-null `current_lat`/`current_lng`.
 * The switch alone does nothing — without this loop a rider sits "Online"
 * forever and never gets offered a single order.
 *
 * 20s matches the web rider dashboard. Against a 3-minute presence window that
 * is ~8 pings of slack, which is the point: rural mobile data drops pings, and
 * one bad minute must not take a rider off dispatch.
 */
export const HEARTBEAT_MS = 20_000;

export type PresenceState =
  /** Switch is off. Not pinging, not dispatchable — the rider chose this. */
  | 'offline'
  /** Pinging with a position. Dispatch can reach them. */
  | 'online'
  /** Pinging, but we have no fix to send, so dispatch will skip them. */
  | 'no-location';

type Coords = { lat: number; lng: number };

export function useRiderPresence(active: boolean, intervalMs = HEARTBEAT_MS): PresenceState {
  const [state, setState] = useState<PresenceState>('offline');
  // The last fix we managed to read. A coordless heartbeat leaves the stored
  // position untouched server-side rather than clearing it, so replaying the
  // last known fix is strictly better than sending nothing when one GPS read
  // times out — which happens constantly indoors.
  const lastCoords = useRef<Coords | null>(null);

  useEffect(() => {
    if (!active) {
      setState('offline');
      return;
    }

    let cancelled = false;
    let granted = false;

    const beat = async () => {
      if (cancelled) return;

      if (granted) {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lastCoords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {
          // Keep the previous fix; see lastCoords above.
        }
      }
      if (cancelled) return;

      try {
        await sendRiderHeartbeat(api, lastCoords.current ?? undefined);
      } catch {
        // A dropped ping is expected, not exceptional. The next one is
        // intervalMs away and the presence window absorbs several misses.
      }

      // Deliberately keyed on having sent a position, not on the permission
      // flag: permission granted + every GPS read failing is still undispatchable,
      // and the rider needs to be told that rather than shown a green light.
      if (!cancelled) setState(lastCoords.current ? 'online' : 'no-location');
    };

    (async () => {
      try {
        granted = !!(await Location.requestForegroundPermissionsAsync())?.granted;
      } catch {
        granted = false;
      }
      if (cancelled) return;
      if (!granted) setState('no-location');
      // Fire at once. A rider who flips the switch expects work now, and
      // waiting a full interval to become dispatchable is a bug they would
      // experience as "the app is broken".
      await beat();
    })();

    const id = setInterval(beat, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, intervalMs]);

  return state;
}
