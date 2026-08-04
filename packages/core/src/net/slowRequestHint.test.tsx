import { act, create } from 'react-test-renderer';
import { useSlowRequestHint } from './slowRequestHint';

function Probe({ loading, onValue }: { loading: boolean; onValue: (v: boolean) => void }) {
  const slow = useSlowRequestHint(loading, 1000);
  onValue(slow);
  return null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('stays false before the delay elapses', () => {
  let latest = false;
  act(() => {
    create(<Probe loading={true} onValue={(v) => { latest = v; }} />);
  });
  expect(latest).toBe(false);

  act(() => {
    jest.advanceTimersByTime(500);
  });
  expect(latest).toBe(false);
});

test('flips true once loading has continued past the delay', () => {
  let latest = false;
  act(() => {
    create(<Probe loading={true} onValue={(v) => { latest = v; }} />);
  });

  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(latest).toBe(true);
});

test('resets to false as soon as loading stops', () => {
  let latest = false;
  let root: ReturnType<typeof create>;
  act(() => {
    root = create(<Probe loading={true} onValue={(v) => { latest = v; }} />);
  });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(latest).toBe(true);

  act(() => {
    root.update(<Probe loading={false} onValue={(v) => { latest = v; }} />);
  });
  expect(latest).toBe(false);
});

test('a fresh loading spell after a reset needs its own full delay', () => {
  let latest = false;
  let root: ReturnType<typeof create>;
  act(() => {
    root = create(<Probe loading={false} onValue={(v) => { latest = v; }} />);
  });

  act(() => {
    root.update(<Probe loading={true} onValue={(v) => { latest = v; }} />);
  });
  expect(latest).toBe(false);

  act(() => {
    jest.advanceTimersByTime(999);
  });
  expect(latest).toBe(false);

  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(latest).toBe(true);
});
