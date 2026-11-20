import { createContext, useContext, useEffect, useState } from "react";
import { bootstrapProfile } from "../api/live";
import { useStaffAuth } from "./auth";

/**
 * Who may use the staff area. The server checks the role on every call (church staff, kept in the church side's own list); this only decides
 * what to show, so someone without the role who types /staff sees "no access" and no church screen.
 */
export type StaffAccess = {
  state: "loading" | "signedOut" | "error" | "ready";
  /** May make and change churches (the server's `capabilities.manageChurches`). */
  manageChurches: boolean;
  retry: () => void;
};

const none: StaffAccess = { state: "loading", manageChurches: false, retry: () => undefined };
export const StaffAccessContext = createContext<StaffAccess>(none);
export const useAdminAccess = () => useContext(StaffAccessContext);

/** Asks the server what the signed-in person may do. Without a server (a test build) a signed-in person is shown the screens that use the browser stand-in. */
export function useLoadStaffAccess(): StaffAccess {
  const { status, user } = useStaffAuth();
  const [loaded, setLoaded] = useState<{ userId: string; manageChurches: boolean } | "error" | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setLoaded(null);
    if (status !== "signedIn" || !user) return;
    const controller = new AbortController();
    bootstrapProfile(controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) setLoaded({ userId: user.id, manageChurches: Boolean((r.capabilities as Record<string, boolean>).manageChurches) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded("error");
      });
    return () => controller.abort();
  }, [status, user?.id, attempt]);
  const retry = () => setAttempt((n) => n + 1);
  if (status === "signedOut" || status === "unavailable") return { ...none, state: "signedOut", retry };
  if (loaded === "error") return { ...none, state: "error", retry };
  if (!loaded || loaded.userId !== user?.id) return { ...none, state: "loading", retry };
  return { state: "ready", manageChurches: loaded.manageChurches, retry };
}
