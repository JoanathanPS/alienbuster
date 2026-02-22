export type MemoryCues = {
  lastLocation?: { lat: number; lon: number; label?: string; at: number };
  lastReportId?: { id: number; at: number };
  lastOutbreakId?: { id: number; at: number };
};

const KEY = "ab.memoryCues.v1";

function safeParse(v: string | null): MemoryCues {
  if (!v) return {};
  try {
    return (JSON.parse(v) as MemoryCues) || {};
  } catch {
    return {};
  }
}

export function getMemoryCues(): MemoryCues {
  return safeParse(localStorage.getItem(KEY));
}

export function setMemoryCues(patch: Partial<MemoryCues>) {
  const cur = getMemoryCues();
  const next: MemoryCues = { ...cur, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("ab:memory", { detail: next }));
}

export function subscribeMemoryCues(cb: (cues: MemoryCues) => void) {
  const handler = () => cb(getMemoryCues());
  window.addEventListener("ab:memory", handler as any);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("ab:memory", handler as any);
    window.removeEventListener("storage", handler);
  };
}
