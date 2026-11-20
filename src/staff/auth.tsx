// Sign-in for the staff area (/staff) only. The church's readers never sign in (no login for churches in November).
// Staff use an ordinary account (email and password, Supabase) that Shalom's backend has given the church staff role
// (`npm run church:staff -- grant <email>` in the backend). The server checks that role on every call; this file only keeps the session
// and hands its token to the calls (src/api/live.ts). The sign-in library is downloaded only when a staff page opens.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const staffSignInConfigured = Boolean(url && key);

let loading: Promise<SupabaseClient> | null = null;
function client(): Promise<SupabaseClient> {
  if (!staffSignInConfigured) return Promise.reject(new Error("not configured"));
  loading ??= import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(url!, key!, {
        // A separate saved session from any other site on this computer.
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storageKey: "blinkgrid-staff-auth" },
      }),
    )
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}

/** The signed-in staff member's access token, or undefined when nobody is signed in. */
export async function getAccessToken(): Promise<string | undefined> {
  try {
    return (await (await client()).auth.getSession()).data.session?.access_token;
  } catch {
    return undefined;
  }
}

type StaffAuth = {
  status: "unavailable" | "loading" | "signedOut" | "signedIn";
  user: User | null;
  /** Returns null when signed in, else the reason: "wrong" (email or password) or "failed" (could not reach the sign-in service). */
  signIn: (email: string, password: string) => Promise<null | "wrong" | "failed">;
  signOut: () => Promise<void>;
};
const Context = createContext<StaffAuth>({ status: "unavailable", user: null, signIn: async () => "failed", signOut: async () => {} });
export const useStaffAuth = () => useContext(Context);

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StaffAuth["status"]>(staffSignInConfigured ? "loading" : "unavailable");
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (!staffSignInConfigured) return;
    let active = true;
    let stop = () => {};
    client()
      .then(async (c) => {
        if (!active) return;
        const { data: { subscription } } = c.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          setUser(session?.user ?? null);
          setStatus(session?.user ? "signedIn" : "signedOut");
        });
        stop = () => subscription.unsubscribe();
        const { data } = await c.auth.getSession();
        if (!active) return;
        setUser(data.session?.user ?? null);
        setStatus(data.session?.user ? "signedIn" : "signedOut");
      })
      .catch(() => active && setStatus("signedOut"));
    return () => {
      active = false;
      stop();
    };
  }, []);
  const signIn: StaffAuth["signIn"] = async (email, password) => {
    try {
      const { error } = await (await client()).auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return null;
      return error.status && error.status >= 500 ? "failed" : "wrong";
    } catch {
      return "failed";
    }
  };
  const signOut = async () => {
    try {
      await (await client()).auth.signOut();
    } catch {
      /* the page still goes back to the sign-in form */
    }
    setUser(null);
    setStatus("signedOut");
  };
  return <Context.Provider value={{ status, user, signIn, signOut }}>{children}</Context.Provider>;
}
