export type ActionLogItem = {
  id: string;
  at: number; // epoch ms
  title: string;
  detail?: string;
  href?: string;
};

const KEY = "ab.recentActions.v1";
const MAX = 10;

function safeJsonParse<T>(v: string | null): T | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export function getRecentActions(): ActionLogItem[] {
  const raw = safeJsonParse<ActionLogItem[]>(localStorage.getItem(KEY));
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x.at === "number" && typeof x.title === "string")
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX);
}

export function logAction(item: Omit<ActionLogItem, "id" | "at"> & { at?: number; id?: string }) {
  const next: ActionLogItem = {
    id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: item.at ?? Date.now(),
    title: item.title,
    detail: item.detail,
    href: item.href,
  };

  const prev = getRecentActions();
  const merged = [next, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(merged));

  // notify listeners
  window.dispatchEvent(new CustomEvent("ab:actions", { detail: merged }));
}

export function subscribeRecentActions(cb: (items: ActionLogItem[]) => void) {
  const handler = () => cb(getRecentActions());

  window.addEventListener("ab:actions", handler as any);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener("ab:actions", handler as any);
    window.removeEventListener("storage", handler);
  };
}
