import { Link } from "react-router-dom";
import { BookOpen, Settings2 } from "lucide-react";
import { Page, Row, useUI } from "../Platform";
import { CHURCH_HOME } from "./features";
import { churchUnavailable } from "./churchStore";

/** What the site says for an address that is not one of the church's pages, or for a church address that cannot be loaded: a calm page, never a broken one. */
export function NotAvailableHere() {
  const { t } = useUI();
  return (
    <Page title={t("common:churchNotAvailableTitle")} description={t("common:churchNotAvailableBody")}>
      {!churchUnavailable && (
        <div className="os-actions">
          <Link className="os-primary" to={CHURCH_HOME}>
            {t("common:churchNotAvailableDaily")}
          </Link>
        </div>
      )}
    </Page>
  );
}

/** The More page of a church's site: only what the church site has. */
export function ChurchMore() {
  const { t } = useUI();
  return (
    <Page title={t("common:placeEverythingElse")}>
      <div className="os-more-grid">
        <section>
          <Row to={CHURCH_HOME} title={t("daily:title")} icon={<BookOpen size={22} />} />
          <Row to="/settings" title={t("common:languageReadingSettings")} icon={<Settings2 size={22} />} />
        </section>
      </div>
    </Page>
  );
}
