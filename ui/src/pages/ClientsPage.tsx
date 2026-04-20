// ui/src/pages/ClientsPage.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ClientOut } from "../api";

export function ClientsPage() {
  const [items, setItems] = useState<ClientOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.clients({ q: q.trim() || undefined });
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

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Клиенты</h2>
        <div className="spacer" />
        <Link className="link" to="/clients/new">
          + Добавить
        </Link>
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
            <label>Поиск</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ФИО / телефон" />
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button onClick={load} disabled={loading}>
              Применить
            </button>
            <button
              onClick={() => {
                setQ("");
                setTimeout(() => load(), 0);
              }}
              disabled={loading}
            >
              Сбросить
            </button>
          </div>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Найдено: {items.length}
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>ФИО</th>
              <th style={{ width: 180 }}>Телефон</th>
              <th style={{ width: 220 }}>Создано</th>
              <th style={{ width: 90 }}>Открыть</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="muted">
                  Нет данных.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.full_name}</td>
                  <td>{c.phone}</td>
                  <td>{new Date(c.created_at).toLocaleString()}</td>
                  <td>
                    <Link className="link" to={`/clients/${c.id}`}>
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