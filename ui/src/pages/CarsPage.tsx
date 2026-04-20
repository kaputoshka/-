// ui/src/pages/CarsPage.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, CarOut } from "../api";

export function CarsPage() {
  const [items, setItems] = useState<CarOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.cars({ q: q.trim() || undefined, status: status.trim() || undefined });
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
        <h2 style={{ margin: 0 }}>Автомобили</h2>
        <div className="spacer" />
        <Link className="link" to="/cars/new">
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="марка / модель / VIN" />
          </div>
          <div>
            <label>Статус</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все</option>
              <option value="available">available</option>
              <option value="reserved">reserved</option>
              <option value="sold">sold</option>
            </select>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <button onClick={load} disabled={loading}>
            Применить
          </button>
          <button
            onClick={() => {
              setQ("");
              setStatus("");
              setTimeout(() => load(), 0);
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
              <th style={{ width: 160 }}>VIN</th>
              <th>Марка / модель</th>
              <th style={{ width: 90 }}>Год</th>
              <th style={{ width: 140 }}>Пробег</th>
              <th style={{ width: 150 }}>Цена</th>
              <th style={{ width: 120 }}>Статус</th>
              <th style={{ width: 90 }}>Открыть</th>
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
              items.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.vin || <span className="muted">—</span>}</td>
                  <td>
                    {c.brand} {c.model}
                  </td>
                  <td>{c.year}</td>
                  <td>{c.mileage.toLocaleString("ru-RU")} км</td>
                  <td>{c.price.toLocaleString("ru-RU")} ₽</td>
                  <td>
                    <span className="badge">{c.status}</span>
                  </td>
                  <td>
                    <Link className="link" to={`/cars/${c.id}`}>
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