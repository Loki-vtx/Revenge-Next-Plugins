import { TAG, after, getReact, getRN } from "./compat";
import ReadButton, { MARGIN, TILE } from "./ReadButton";
import Settings from "./settings";

let unpatchers: (() => boolean)[] = [];
const patched = new WeakSet<object>();
let retryTimer: ReturnType<typeof setInterval> | undefined;

const isUseGuildsBarProps = (exports: any): boolean =>
  typeof exports?.default === "function" && exports.default.name === "useGuildsBarProps";

function patchFooter(ret: any) {
  const ldp = ret?.listDataProps;
  if (!ldp || patched.has(ldp)) return;
  if (typeof ldp.footerSize !== "function" || typeof ldp.renderFooter !== "function") return;

  const origSize = ldp.footerSize;
  const origRender = ldp.renderFooter;
  const extra = TILE + 2 * MARGIN;

  ldp.footerSize = () => origSize.call(ldp) + extra;
  ldp.renderFooter = () =>
    getReact().createElement(
      getRN().View,
      { style: { alignSelf: "stretch" }, collapsable: false },
      origRender.call(ldp),
      getReact().createElement(ReadButton)
    );

  patched.add(ldp);
}

function scanRegistry(): number {
  const modules = (globalThis as any)?.modules;
  if (!modules) return 0;

  let count = 0;
  for (const id in modules) {
    const def = modules[id];
    if (!def?.isInitialized) continue;
    const exports = def.publicModule?.exports;
    if (!exports || !isUseGuildsBarProps(exports)) continue;
    try {
      unpatchers.push(after("default", exports, (_args, ret) => patchFooter(ret)));
      count++;
    } catch (e) {
      console.log(TAG, `Failed to patch module ${id}:`, e);
    }
  }
  return count;
}

export function start() {
  if (scanRegistry() > 0) return;
  let ticks = 0;
  retryTimer = setInterval(() => {
    ticks++;
    if (scanRegistry() > 0 || ticks >= 30) {
      clearInterval(retryTimer);
      retryTimer = undefined;
    }
  }, 1000);
}

export function stop() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = undefined;
  unpatchers.forEach((u) => u());
  unpatchers = [];
}

export const settings = Settings;

export default { start, stop, settings };
