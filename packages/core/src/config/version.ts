export function isVersionSupported(current: string, min: string): boolean {
  const c = current.split('.').map(Number), m = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((c[i] ?? 0) > (m[i] ?? 0)) return true; if ((c[i] ?? 0) < (m[i] ?? 0)) return false; }
  return true;
}
