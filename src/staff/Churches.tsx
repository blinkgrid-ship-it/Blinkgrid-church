import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Notice } from "../ui/Notice";
import { Page, useUI } from "../Platform";
import i18n from "../i18n";
import { useAdminAccess } from "./access";
import { churchesStore } from "./churchesStoreSelect";
import { displayName, type ChurchRecord } from "./churchEdits";
import { statusLabel } from "./ChurchEdit";

/** /staff: every church, its main address and its status. Only church staff can create or save. */
export function AdminChurches() {
  const { t } = useUI();
  const access = useAdminAccess();
  const store = churchesStore();
  const [items, setItems] = useState<ChurchRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    store
      .list()
      .then((rows) => live && setItems(rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [reload, store]);
  return (
    <Page title={t("admin:churches")} description={t("admin:churchesIntro")}>
      {store.kind === "browser" && (
        <Notice tone="info">
          <p>{t("admin:churchesPreviewNotice")}</p>
        </Notice>
      )}
      {failed && (
        <Notice tone="error">
          <p>{t("admin:churchesLoadFailed")}</p>
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            {t("admin:churchesReload")}
          </button>
        </Notice>
      )}
      {!failed && items === null && <p role="status">{t("common:loading")}</p>}
      {items && !items.length && <p>{t("admin:churchesNone")}</p>}
      {items && items.length > 0 && (
        <ul className="os-church-list">
          {items.map((c) => (
            <li key={c.id}>
              <Link to={`/staff/${c.id}`}>
                <strong>{displayName(c, i18n.language)}</strong>
              </Link>
              <span className="os-admin-code">{c.addresses[0]}</span>
              <span className={`os-church-status is-${c.status}`}>{statusLabel(t, c.status)}</span>
            </li>
          ))}
        </ul>
      )}
      {access.manageChurches && (
        <p>
          <Link className="os-primary" to="/staff/new">
            {t("admin:newChurch")}
          </Link>
        </p>
      )}
    </Page>
  );
}
