import { useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Page, useUI } from "../Platform";
import { Notice } from "../ui/Notice";
import { BANK_FIELDS, churchName, type BankField } from "./parse";
import { churchSettings } from "./settings";
import "./giving.css";

const LABEL: Record<BankField, string> = {
  accountName: "common:giveAccountName",
  bankName: "common:giveBankName",
  branch: "common:giveBranch",
  accountNumber: "common:giveAccountNumber",
  ifsc: "common:giveIfsc",
  swift: "common:giveSwift",
  upi: "common:giveUpi",
};

/** One bank detail with a button that copies it. Nothing is sent anywhere. */
function Detail({ label, value }: { label: string; value: string }) {
  const { t } = useUI();
  const [copied, setCopied] = useState(false);
  const text = useRef<HTMLElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard in this browser: select the text so the reader can copy it by hand.
      const range = document.createRange();
      if (text.current) range.selectNodeContents(text.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }
  return (
    <div className="give-row">
      <dt>{label}</dt>
      <dd>
        <strong ref={text} className="give-value">
          {value}
        </strong>
        <button type="button" className="give-copy" onClick={() => void copy()} aria-label={t("common:giveCopyWhat", { what: label })}>
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          <span aria-live="polite">{copied ? t("common:giveCopied") : t("common:giveCopy")}</span>
        </button>
      </dd>
    </div>
  );
}

/**
 * The church's Giving page (Paul, 26 Nov): the church's own giving link and/or its bank details, shown as the church gave them.
 * This site takes no payment and keeps nothing: the link opens the church's own page, the bank details are copied by the reader.
 */
export function GivingPage() {
  const { t, prefs } = useUI();
  const giving = churchSettings.giving;
  const church = churchName(churchSettings, prefs.language);
  if (!giving) {
    return (
      <Page title={t("common:giveTitle")} description={t("common:giveIntro", { church })}>
        <p className="give-empty">{t("common:giveNone")}</p>
      </Page>
    );
  }
  const host = giving.link ? new URL(giving.link).hostname : "";
  const bank = giving.bank ?? {};
  const bankRows = BANK_FIELDS.filter((key) => bank[key]);
  return (
    <Page title={t("common:giveTitle")} description={t("common:giveIntro", { church })}>
      {giving.sample && (
        <Notice tone="warning">
          <p>{t("common:giveSample")}</p>
        </Notice>
      )}
      {giving.link && (
        <section className="give-card" aria-labelledby="give-online-title">
          <h2 id="give-online-title">{t("common:giveOnlineTitle")}</h2>
          <a className="os-primary give-online" href={giving.link} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} aria-hidden="true" />
            {t("common:giveOnline")}
          </a>
          <p className="give-hint">{t("common:giveOnlineHint", { host })}</p>
        </section>
      )}
      {!!bankRows.length && (
        <section className="give-card" aria-labelledby="give-bank-title">
          <h2 id="give-bank-title">{t("common:giveBankTitle")}</h2>
          <dl className="give-list">
            {bankRows.map((key) => (
              <Detail key={key} label={t(LABEL[key])} value={bank[key] as string} />
            ))}
          </dl>
        </section>
      )}
      {giving.note && <p className="give-note">{giving.note}</p>}
      <p className="give-fine">{t("common:giveNoPayments")}</p>
    </Page>
  );
}
