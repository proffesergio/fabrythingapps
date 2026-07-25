import { strings, StringKey } from './strings';
export function t(key: StringKey, lang: 'en' | 'bn' = 'en'): string {
  const table = strings[lang] as Record<string, string>;
  return table[key] ?? strings.en[key] ?? String(key);
}
export { strings };
export type { StringKey };
