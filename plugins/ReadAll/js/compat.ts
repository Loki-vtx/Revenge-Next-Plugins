// Single place for everything that used to come from @vendetta/* or bunny.
// Nothing here depends on the Revenge Next JS API: it only needs the Metro
// registry (globalThis.modules), which the original plugin already relied on.
// If Revenge Next gives you a better finder/patcher/storage, swap it in here only.

export const TAG = "[ReadAll+]";
const g: any = globalThis;

/* ---------- module lookup (same registry scan as the original) ---------- */

function eachExports(cb: (exports: any) => boolean | void) {
  const mods = g.modules;
  if (!mods) return;
  for (const id in mods) {
    const def = mods[id];
    if (!def?.isInitialized) continue;
    let exports: any;
    try {
      exports = def.publicModule?.exports;
    } catch {
      continue;
    }
    if (exports && cb(exports)) return;
  }
}

const isObj = (o: any) => o && (typeof o === "object" || typeof o === "function");

export function findByProps(...props: string[]): any {
  let found: any;
  eachExports((e) => {
    for (const candidate of [e, e?.default]) {
      if (!isObj(candidate)) continue;
      try {
        if (props.every((p) => p in candidate)) {
          found = candidate;
          return true;
        }
      } catch {}
    }
  });
  return found;
}

export function findByStoreName(name: string): any {
  let found: any;
  eachExports((e) => {
    for (const candidate of [e, e?.default]) {
      if (!isObj(candidate)) continue;
      try {
        if (typeof candidate.getName === "function" && candidate.getName() === name) {
          found = candidate;
          return true;
        }
      } catch {}
    }
  });
  return found;
}

/* ---------- patcher ---------- */

export function after(
  key: string,
  obj: any,
  cb: (args: any[], ret: any) => any
): () => boolean {
  const orig = obj[key];
  const wrapper = function (this: any, ...args: any[]) {
    const ret = orig.apply(this, args);
    const out = cb.call(this, args, ret);
    return out === undefined ? ret : out;
  };
  obj[key] = wrapper;
  return () => {
    if (obj[key] === wrapper) obj[key] = orig;
    return true;
  };
}

/* ---------- React / React Native (resolved lazily, after Discord boots) ---------- */

let _React: any;
let _RN: any;
export const getReact = () => (_React ??= findByProps("createElement", "useState", "useEffect"));
export const getRN = () => (_RN ??= findByProps("View", "Pressable", "StyleSheet", "Image", "Text"));

/* ---------- storage ---------- */
// WIRE THIS if Revenge Next provides persistent plugin storage.
// Default: persists through globalThis.localStorage when present, else memory only.

type Listener = () => void;

export function createStore<T extends Record<string, any>>(key: string, defaults: T) {
  let data: T = { ...defaults };
  const listeners = new Set<Listener>();

  try {
    const raw = g.localStorage?.getItem?.(key);
    if (raw) data = { ...defaults, ...JSON.parse(raw) };
  } catch {}

  return {
    get data() {
      return data;
    },
    set<K extends keyof T>(k: K, v: T[K]) {
      data = { ...data, [k]: v };
      try {
        g.localStorage?.setItem?.(key, JSON.stringify(data));
      } catch {}
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}

export function useStore(store: ReturnType<typeof createStore>) {
  const React = getReact();
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => store.subscribe(force), [store]);
  return store.data;
}

/* ---------- UI helpers ---------- */

export function toast(message: string) {
  try {
    const t = findByProps("showToast");
    if (t?.showToast) return void t.showToast(message);
  } catch {}
  console.log(TAG, message);
}

export function choose(
  title: string,
  message: string,
  options: { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void }[]
) {
  getRN().Alert.alert(title, message, options);
}
