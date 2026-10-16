import { TAG, registerCommand } from "./compat";
import { Mode, executeClear } from "./clear";
import Settings from "./settings";

let unregister: (() => boolean) | undefined;
let retryTimer: ReturnType<typeof setInterval> | undefined;

function register(): boolean {
  try {
    unregister = registerCommand({
      name: "readall",
      description: "Mark unread servers and DMs as read (respects your exclusion lists)",
      options: [
        {
          name: "scope",
          description: "What to mark as read (default: everything)",
          type: 3, // STRING
          required: false,
          choices: [
            { name: "all", displayName: "Everything", value: "all" },
            { name: "servers", displayName: "Servers only", value: "servers" },
            { name: "dms", displayName: "DMs only", value: "dms" },
          ],
        },
      ],
      execute: (args) => {
        const value = args?.find((a: any) => a.name === "scope")?.value;
        const mode: Mode = value === "servers" || value === "dms" ? value : "all";
        executeClear(mode);
      },
    });
    return true;
  } catch (e) {
    return false;
  }
}

export function start() {
  if (register()) return;
  let ticks = 0;
  retryTimer = setInterval(() => {
    ticks++;
    if (register() || ticks >= 30) {
      if (ticks >= 30) console.log(TAG, "Could not find the command registry");
      clearInterval(retryTimer);
      retryTimer = undefined;
    }
  }, 1000);
}

export function stop() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = undefined;
  unregister?.();
  unregister = undefined;
}

export const settings = Settings;

export default { start, stop, settings };
