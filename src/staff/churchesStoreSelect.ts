import { liveRequest, writeLive } from "../api/live";
import { browserStorage, createApiChurchesStore, createLocalChurchesStore, type ChurchesStore, type Request } from "./churchesStore.ts";

// Which store the Churches screens use. Until Shalom's calls exist it is the browser stand-in. The server store is switched on by
// VITE_CHURCH_ADMIN_API=1 at build time, or by localStorage "blinkgrid-church.church-admin-api" = "1" (to try it in one browser against a
// server that has the calls). Only the admin screens ask for it, and the server checks the role on every call.

const SWITCH = "blinkgrid-church.church-admin-api";

function serverWanted() {
  if (import.meta.env.VITE_CHURCH_ADMIN_API === "1" || import.meta.env.VITE_CHURCH_RESOLVE === "api") return true;
  try {
    return window.localStorage.getItem(SWITCH) === "1";
  } catch {
    return false;
  }
}

const request: Request = (method, path, body) => (method === "GET" ? liveRequest(path, { method: "GET" }, true) : writeLive(path, method, body ?? {}));

let store: ChurchesStore | null = null;
export const churchesStore = (): ChurchesStore => (store ??= serverWanted() ? createApiChurchesStore(request) : createLocalChurchesStore(browserStorage()));
