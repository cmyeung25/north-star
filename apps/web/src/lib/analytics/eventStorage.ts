const parseStoredEvents = <T>(raw: string | null): T[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export const readStoredAnalyticsEvents = <T>(storageKey: string): T[] => {
  if (typeof window === "undefined") {
    return [];
  }

  return parseStoredEvents<T>(window.localStorage.getItem(storageKey));
};

export const appendStoredAnalyticsEvent = <T>(
  storageKey: string,
  event: T,
  eventLimit: number
) => {
  if (typeof window === "undefined") {
    return;
  }

  const next = [...readStoredAnalyticsEvents<T>(storageKey), event].slice(-eventLimit);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
};

export const clearStoredAnalyticsEvents = (storageKey: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
};
