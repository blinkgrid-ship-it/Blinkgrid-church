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
        <label>
          {t("staff:email")}
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
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

function StaffGate() {
  const { t } = useUI();
  const { status, user, signOut } = useStaffAuth();
  const access = useLoadStaffAccess();
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
