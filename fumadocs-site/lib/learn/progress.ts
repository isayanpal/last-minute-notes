'use client';

import { useMemo, useSyncExternalStore } from 'react';

const KEY = 'lmn-learn-completed-v1';
const listeners = new Set<() => void>();

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** Slugs of lessons the reader has finished, saved in this browser only. */
export function useCompleted(): Set<string> {
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  return useMemo(() => {
    try {
      const list: unknown = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);
}

export function markComplete(slug: string) {
  try {
    const list: string[] = JSON.parse(read());
    if (list.includes(slug)) return;
    window.localStorage.setItem(KEY, JSON.stringify([...list, slug]));
    listeners.forEach((l) => l());
  } catch {
    /* storage blocked: progress just is not saved */
  }
}
