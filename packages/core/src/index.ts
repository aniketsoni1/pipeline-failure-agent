export * from './categories.js';
export * from './model.js';
export * from './result.js';
export * from './connector.js';
export * from './schemas.js';

/** Deterministic id helper — stable across runs given the same seed. */
export function shortId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}
