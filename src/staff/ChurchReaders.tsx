import { useEffect, useState } from "react";
import { Notice } from "../ui/Notice";
import { useUI } from "../Platform";
import { lastDays, totalOf, utcDay, type ReaderDay } from "../church/readerCount";
import { AdminSelect } from "./AdminSelect";
import type { ChurchesStore } from "./churchesStore.ts";
import type { ChurchRecord } from "./churchEdits";

/**
 * The readers of one church, a day at a time (contract Part 8, T-167): how many people opened the church's reading on each UTC day.
 * A number only: no names, no phone numbers. Anyone on staff may look; nothing here changes anything.
 */
export function ChurchReaders({ church, store }: { church: ChurchRecord; store: ChurchesStore }) {
  const { t } = useUI();
  const [period, setPeriod] = useState("7");
  const [rows, setRows] = useState<ReaderDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const addresses = church.addresses.join(",");

  useEffect(() => {
    let live = true;
    setRows(null);
    setFailed(false);
    store
      .readers(church, lastDays(Number(period), utcDay()))
      .then((found) => live && setRows(found))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // The church row changes at every save; only the address list and the period change what is counted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, church.id, addresses, period, tries]);

  const total = rows ? totalOf(rows) : 0;
  const most = Math.max(1, ...(rows ?? []).map((r) => r.count));

  return (
    <section className="os-church-readers" aria-labelledby="church-readers" aria-busy={!rows && !failed}>
      <h2 id="church-readers">{t("admin:churchReadersHeading")}</h2>
      <p className="os-field-hint">{t("admin:churchReadersHint")}</p>
      {store.kind === "browser" && <p className="os-field-hint">{t("admin:churchReadersStandIn")}</p>}
      <AdminSelect
        label={t("admin:churchReadersPeriod")}
        value={period}
        options={[
          { value: "7", label: t("admin:churchReadersLast7") },
          { value: "30", label: t("admin:churchReadersLast30") },
        ]}
        onChange={setPeriod}
      />
      {failed ? (
        <Notice tone="error">
          <p>{t("admin:churchReadersLoadFailed")}</p>
          <p>
            <button type="button" onClick={() => setTries(tries + 1)}>
              {t("admin:churchReadersRetry")}
            </button>
          </p>
        </Notice>
      ) : !rows ? (
        <p role="status">{t("common:loading")}</p>
      ) : total === 0 ? (
        <p className="os-church-readers-empty">{t("admin:churchReadersEmpty")}</p>
      ) : (
        <>
          <p className="os-church-readers-total">{t("admin:churchReadersTotal", { count: total })}</p>
          <ul className="os-church-readers-list">
            {rows.map((row) => (
              <li key={row.date}>
                <span className="os-church-readers-date">{row.date}</span>
                <span className="os-church-readers-bar" aria-hidden="true">
                  {row.count > 0 && <i style={{ width: `${(row.count / most) * 100}%` }} />}
                </span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
