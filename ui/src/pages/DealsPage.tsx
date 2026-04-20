// ui/src/pages/DealsPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, DealOut } from "../api";

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export function DealsPage() {
  const [items, setItems] = useState<DealOut[]>([]);
  const [statuses, setStatuses] = useState<Array<{ code: string; title: string; is_active: boolean }>>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [statusCode, setStatusCode] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const statusTitle = useMemo(() => {
    const m = new Map<string, string>();
    statuses.forEach((s) => m.set(s.code, s.title));
    return m;
  }, [statuses]);

  async function loadStatuses() {
    try {
      const st = await api.dealStatuses();
      setStatuses(st.filter((x) => x.is_active));
    } catch {
      // по правам может не быть — оставим пусто
      setStatuses([]);
    }
  }

  async function loadDeals() {
    setLoading(true);
    setErr(null);
    try {
      const mid = managerId.trim() ? Number(managerId) : undefined;
      const data = await api.deals({
        status_code: statusCode.trim() || undefined,
        manager_id: mid && !Number.isNaN(mid) ? mid : undefined,
        date_from: dateFrom.trim() || undefined,
        date_to: dateTo.trim() || undefined,
      });
      setItems(data);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    await Promise.all([loadStatuses(), loadDeals()]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearFilters() {
    setStatusCode("");
    setManagerId("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Сделки</h2>
        <div className="spacer" />
        <Link className="link" to="/deals/new">
          + Создать
        </Link>
        <button onClick={loadDeals} disabled={loading}>
          Обновить
        </button>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <div>
            <label>Статус</label>
            {statuses.length > 0 ? (
              <select value={statusCode} onChange={(e) => setStatusCode(e.target.value)}>
                <option value="">Все</option>
                {statuses.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.title}
                  </option>
                ))}
              </select>
            ) : (
              <input value={statusCode} onChange={(e) => setStatusCode(e.target.value)} placeholder="например: new" />
            )}
          </div>

          <div>
            <label>Manager ID</label>
            <input value={managerId} onChange={(e) => setManagerId(e.target.value)} placeholder="например: 2" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Дата от (YYYY-MM-DD)</label>
            <input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="2026-03-01" />
          </div>
          <div>
            <label>Дата до (YYYY-MM-DD)</label>
            <input value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="2026-03-31" />
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <button onClick={loadDeals} disabled={loading}>
            Применить
          </button>
          <button
            onClick={() => {
              clearFilters();
              setTimeout(() => loadDeals(), 0);
            }}
            disabled={loading}
          >
            Сбросить
          </button>
          <div className="spacer" />
          <div className="muted">Найдено: {items.length}</div>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th style={{ width: 160 }}>Статус</th>
              <th style={{ width: 140 }}>Клиент</th>
              <th style={{ width: 120 }}>Авто</th>
              <th style={{ width: 160 }}>Цена</th>
              <th style={{ width: 120 }}>Скидка</th>
              <th style={{ width: 110 }}>Manager</th>
              <th style={{ width: 220 }}>Создано</th>
              <th style={{ width: 90 }}>Открыть</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={9} className="muted">
                  Нет данных.
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>
                    <span className="badge">{d.status_code}</span>{" "}
                    <span className="muted">{statusTitle.get(d.status_code) ? `— ${statusTitle.get(d.status_code)}` : ""}</span>
                  </td>
                  <td>
                    <Link className="link" to={`/clients/${d.client_id}`}>
                      #{d.client_id}
                    </Link>
                  </td>
                  <td>
                    <Link className="link" to={`/cars/${d.car_id}`}>
                      #{d.car_id}
                    </Link>
                  </td>
                  <td>{d.sale_price.toLocaleString("ru-RU")} ₽</td>
                  <td>{d.discount.toLocaleString("ru-RU")} ₽</td>
                  <td>{d.manager_id}</td>
                  <td>{fmt(d.created_at)}</td>
                  <td>
                    <Link className="link" to={`/deals/${d.id}`}>
                      открыть
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loading && <div className="muted" style={{ marginTop: 10 }}>Загрузка...</div>}
    </div>
  );
}