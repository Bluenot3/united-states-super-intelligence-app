/** Public files follow Vite's deployment base, including nested static releases. */
export function publicAsset(path: string): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}${path.replace(/^\/+/, '')}`;
}
