// ui/src/pages/ReportsPage.tsx
// KISS: один отчет (summary) за период

import React, { useState } from "react";
import { api, ReportSummaryOut } from "../api";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfMonthISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function money(x: number) {
  return (x || 0).toLocaleString("ru-RU") + " ₽";
}

export function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(firstDayOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ReportSummaryOut | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    setData(null);

    try {
      const res = await api.reportSummary(dateFrom.trim(), dateTo.trim());
      setData(res);
    } catch (e: any) {
      setErr(e?.message || "Ошибка отчета");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Отчёты</h2>
      <p className="muted">Сводный отчёт по продажам за период.</p>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <div>
            <label>Дата от (YYYY-MM-DD)</label>
            <input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label>Дата до (YYYY-MM-DD)</label>
            <input value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <button onClick={load} disabled={loading}>
            {loading ? "..." : "Сформировать"}
          </button>
        </div>
      </div>

      {data && (
        <div className="row">
          <div className="card">
            <div className="muted">Сделок создано</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{data.deals_total}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Период: {data.date_from} — {data.date_to}
            </div>
          </div>

          <div className="card">
            <div className="muted">Сделок закрыто</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{data.deals_closed}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Конверсия:{" "}
              {data.deals_total > 0 ? ((data.deals_closed / data.deals_total) * 100).toFixed(1) + "%" : "0%"}
            </div>
          </div>

          <div className="card">
            <div className="muted">Выручка</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{money(data.revenue)}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Средний чек: {money(data.avg_check)}
            </div>
          </div>
        </div>
      )}

      {!data && <div className="muted">Задай период и нажми “Сформировать”.</div>}
    </div>
  );
}