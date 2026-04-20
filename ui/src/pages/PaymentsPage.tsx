// ui/src/pages/PaymentsPage.tsx
// KISS реестр платежей + фильтр по deal_id

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, PaymentOut } from "../api";

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function money(x: number) {
  return (x || 0).toLocaleString("ru-RU") + " ₽";
}

export function PaymentsPage() {
  const [items, setItems] = useState<PaymentOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [dealId, setDealId] = useState<string>("");

  const totalPaid = useMemo(() => {
    return items.filter((p) => p.status === "paid").reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [items]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const id = dealId.trim() ? Number(dealId) : undefined;
      const data = await api.payments({ deal_id: id && !Number.isNaN(id) ? id : undefined });
      setItems(data);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    setDealId("");
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Платежи</h2>
        <div className="spacer" />
        <button onClick={load} disabled={loading}>
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
            <label>Фильтр по сделке (deal_id)</label>
            <input value={dealId} onChange={(e) => setDealId(e.target.value)} placeholder="например: 1" />
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button onClick={load} disabled={loading}>
              Применить
            </button>
            <button
              onClick={() => {
                clear();
                setTimeout(() => load(), 0);
              }}
              disabled={loading}
            >
              Сбросить
            </button>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 10 }}>
          <div className="muted">Записей: {items.length}</div>
          <div className="spacer" />
          <div className="muted">Оплачено (paid): {money(totalPaid)}</div>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th style={{ width: 120 }}>Deal</th>
              <th style={{ width: 140 }}>Тип</th>
              <th style={{ width: 120 }}>Статус</th>
              <th style={{ width: 160 }}>Сумма</th>
              <th style={{ width: 220 }}>Дата</th>
              <th>Примечание</th>
              <th style={{ width: 120 }}>Открыть</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="muted">
                  Нет данных.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>#{p.deal_id}</td>
                  <td>
                    <span className="badge">{p.kind}</span>
                  </td>
                  <td>
                    <span className="badge">{p.status}</span>
                  </td>
                  <td>{money(p.amount)}</td>
                  <td>{fmt(p.paid_at)}</td>
                  <td style={{ whiteSpace: "pre-wrap" }}>{p.note || <span className="muted">—</span>}</td>
                  <td>
                    <Link className="link" to={`/deals/${p.deal_id}`}>
                      сделка
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {loading && <div className="muted" style={{ marginTop: 10 }}>Загрузка...</div>}
      </div>
    </div>
  );
}