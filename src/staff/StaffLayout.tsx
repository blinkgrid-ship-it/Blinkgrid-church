import { useState, type FormEvent } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Notice } from "../ui/Notice";
import { Page, useUI } from "../Platform";
import { StaffAccessContext, useLoadStaffAccess } from "./access";
import { StaffAuthProvider, staffSignInConfigured, useStaffAuth } from "./auth";
import "./admin.css";

/** The staff area at /staff: sign in, then the churches. Not part of any church's own pages. */
export function StaffLayout() {
  return (
    <StaffAuthProvider>
      <StaffGate />
    </StaffAuthProvider>
  );
}

function SignInForm() {
  const { t } = useUI();
  const { signIn } = useStaffAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<null | "wrong" | "failed">(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (result) setProblem(result);
  }
  return (
    <Page title={t("staff:signInTitle")} description={t("staff:signInIntro")}>
      <form onSubmit={submit} className="os-form" noValidate>
        <label className="os-field">
          {t("staff:email")}
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="os-field">
          {t("staff:password")}
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {problem && (
          <Notice tone="error">
            <p role="alert">{t(problem === "wrong" ? "staff:signInWrong" : "staff:signInFailed")}</p>
          </Notice>
        )}
        <button type="submit" className="os-primary" disabled={busy || !email || !password}>
          {busy ? t("staff:signingIn") : t("staff:signInButton")}
        </button>
      </form>
    </Page>
  );
}

/**
 * Test mode: only in the local dev server (`npm run dev`) with the test churches (VITE_CHURCH_RESOLVE=stub). The screens open with no sign-in, on churches kept in
 * this browser. `import.meta.env.DEV` is false in every built site, so this code is removed from a real build and cannot be switched on there.
 */
const TEST_MODE = import.meta.env.DEV && import.meta.env.VITE_CHURCH_RESOLVE === "stub";

function StaffGate() {
  const { t } = useUI();
  const { status, user, signOut } = useStaffAuth();
  const access = useLoadStaffAccess();
  if (TEST_MODE)
    return (
      <StaffAccessContext.Provider value={{ state: "ready", manageChurches: true, retry: () => undefined }}>
        <div className="os-admin">
          <nav className="os-admin-nav" aria-label={t("staff:title")}>
            <p className="os-admin-title">{t("staff:title")}</p>
          </nav>
          <div className="os-admin-body">
            <Notice tone="warning">
              <p>{t("staff:testMode")}</p>
            </Notice>
            <Outlet />
          </div>
        </div>
      </StaffAccessContext.Provider>
    );
  if (!staffSignInConfigured)
    return (
      <Page title={t("staff:title")}>
        <Notice tone="info">
          <p>{t("staff:signInUnavailable")}</p>
        </Notice>
      </Page>
    );
  if (status === "loading")
    return (
      <Page title={t("staff:title")}>
        <p role="status">{t("staff:checkingAccess")}</p>
      </Page>
    );
  if (access.state === "signedOut") return <SignInForm />;
  if (access.state === "loading")
    return (
      <Page title={t("staff:title")}>
        <p role="status">{t("staff:checkingAccess")}</p>
      </Page>
    );
  if (access.state === "error")
    return (
      <Page title={t("staff:title")}>
        <Notice tone="error">
          <p>{t("staff:accessError")}</p>
        </Notice>
        <button type="button" onClick={access.retry}>
          {t("staff:retry")}
        </button>
      </Page>
    );
  if (!access.manageChurches)
    return (
      <Page title={t("staff:title")}>
        <Notice tone="info">
          <p>{t("staff:noAccess")}</p>
        </Notice>
        <button type="button" onClick={() => void signOut()}>
          {t("staff:signOut")}
        </button>
      </Page>
    );
  return (
    <StaffAccessContext.Provider value={access}>
      <div className="os-admin">
        <nav className="os-admin-nav" aria-label={t("staff:title")}>
          <p className="os-admin-title">{t("staff:title")}</p>
          <ul>
            <li>
              <NavLink to="/staff" end>
                {t("staff:churches")}
              </NavLink>
            </li>
            <li>
              <button type="button" onClick={() => void signOut()} aria-label={t("staff:signedInAs", { email: user?.email ?? "" })}>
                {t("staff:signOut")}
              </button>
            </li>
          </ul>
        </nav>
        <div className="os-admin-body">
          <Outlet />
        </div>
      </div>
    </StaffAccessContext.Provider>
  );
}
