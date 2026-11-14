/**
 * One switch for every chapter's scenes (scenes/sea.ts, wood.ts, sands.ts, deep.ts, war.ts), for before-and-after pictures and speed
 * A/Bs: `?scenes=off` in the address, `VITE_NO_SCENES=1` at the dev server, or `globalThis.__noScenes = true` before a floor is built.
 * (The War also still reads its own `globalThis.__warScenes = false`.)
 */
export function scenesOff(): boolean {
  if (import.meta.env?.VITE_NO_SCENES === '1') return true;
  if ((globalThis as { __noScenes?: boolean }).__noScenes) return true;
  return typeof location !== 'undefined' && /[?&]scenes=off\b/.test(location.search);
}
