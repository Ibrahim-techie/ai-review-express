import { useEffect, useState } from "react";

/**
 * useState that survives a reload. Storage can be unavailable (private
 * windows, blocked site data), so every access is guarded and the app works
 * without it.
 */
export function usePersistentState(key, initial, { delay = 0 } = {}) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Ignore: persistence is a convenience.
      }
    };
    if (!delay) return save();
    const t = setTimeout(save, delay);
    return () => clearTimeout(t);
  }, [key, value, delay]);

  return [value, setValue];
}
