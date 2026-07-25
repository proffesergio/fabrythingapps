import { isVersionSupported } from './version';
test('equal is supported', () => expect(isVersionSupported('1.0.0', '1.0.0')).toBe(true));
test('older is unsupported', () => expect(isVersionSupported('1.0.0', '1.1.0')).toBe(false));
test('newer is supported', () => expect(isVersionSupported('2.0.0', '1.5.0')).toBe(true));
