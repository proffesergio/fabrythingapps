import { t, strings } from './index';
test('returns bn when present', () => { expect(t('login', 'bn')).not.toBe('login'); });
test('falls back to en when bn missing', () => { expect(t('__missing_bn__' as any, 'bn')).toBe(t('__missing_bn__' as any, 'en')); });

// Audit: every key added on the `en` side across Tasks 1-7 must have a real
// `bn` translation, not just fall through to the English default -- a
// missing key here is silent (t() falls back to en) so nothing else catches
// it. Also guards against a `bn` key existing with no `en` counterpart.
test('every string key has both an en and a bn value', () => {
  const enKeys = Object.keys(strings.en).sort();
  const bnKeys = Object.keys(strings.bn).sort();
  expect(bnKeys).toEqual(enKeys);
});

test('no bn value is empty or just a copy-pasted English string', () => {
  for (const key of Object.keys(strings.en) as (keyof typeof strings.en)[]) {
    const en = strings.en[key];
    const bn = strings.bn[key];
    expect(bn.length).toBeGreaterThan(0);
    expect(bn).not.toBe(en);
  }
});
