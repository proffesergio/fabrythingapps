import { act, fireEvent, render, RenderResult } from '@testing-library/react-native';
import type { ReactElement } from 'react';

// Shared test helper closing the exact gap that produced "not wrapped in
// act(...)" console noise across the store screens: a component's initial
// effect (or an event handler) kicks off a promise chain (fetch -> .then ->
// setState) that is already resolved by the time the mock is invoked. That
// chain's state update lands on a *later* microtask than the one
// `@testing-library/react-native`'s own `render()`/`fireEvent` wrap in
// `act()`, so it fires with no active act() scope and React warns -- no
// matter how the assertions that follow are written (`waitFor`, `findBy*`,
// or a synchronous check).
//
// The fix is to keep an act() scope open across an explicit microtask flush
// (a real `setImmediate` turn drains the whole microtask queue, including
// chains several `.then()`s deep) so every update the mocked call produces
// is captured, not just the first one.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function renderFlushed(ui: ReactElement): Promise<RenderResult> {
  let result!: RenderResult;
  await act(async () => {
    result = await render(ui);
    await flushMicrotasks();
  });
  return result;
}

export async function pressFlushed(element: unknown): Promise<void> {
  await act(async () => {
    fireEvent.press(element as never);
    await flushMicrotasks();
  });
}
