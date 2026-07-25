import { t } from './index';
test('returns bn when present', () => { expect(t('login', 'bn')).not.toBe('login'); });
test('falls back to en when bn missing', () => { expect(t('__missing_bn__' as any, 'bn')).toBe(t('__missing_bn__' as any, 'en')); });
