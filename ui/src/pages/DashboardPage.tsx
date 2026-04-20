// ui/src/pages/DashboardPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, CarOut, DealOut, AuditOut } from "../api";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export function DashboardPage() {
  const [cars, setCars] = useState<CarOut[]>([]);
  const [deals, setDeals] = useState<DealOut[]>([]);
  const [audit, setAudit] = useState<AuditOut[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [c, d] = await Promise.all([api.cars(), api.deals()]);
      setCars(c);
      setDeals(d);

      // Audit может быть недоступен по правам — не считаем это ошибкой
      try {
        const a = await api.audit();
        setAudit(a.slice(0, 10));
      } catch {
        setAudit(null);
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки данных");
      setCars([]);
      setDeals([]);
      setAudit(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const kpi = useMemo(() => {
    const today = new Date();

    const carAvailable = cars.filter((x) => x.status === "available").length;
    const carReserved = cars.filter((x) => x.status === "reserved").length;
    const carSold = cars.filter((x) => x.status === "sold").length;

    const dealsTotal = deals.length;
    const dealsActive = deals.filter((d) => d.status_code !== "closed" && d.status_code !== "canceled").length;
    const dealsClosed = deals.filter((d) => d.status_code === "closed").length;
    const dealsCanceled = deals.filter((d) => d.status_code === "canceled").length;

    const dealsToday = deals.filter((d) => isSameDay(new Date(d.created_at), today)).length;

    return {
      carAvailable,
      carReserved,
      carSold,
      dealsTotal,
      dealsActive,
      dealsClosed,
      dealsCanceled,
      dealsToday,
    };
  }, [cars, deals]);

  const lastDeals = useMemo(() => deals.slice(0, 10), [deals]);

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Главная</h2>
        <div className="spacer" />
        <Link className="link" to="/deals/new">
          + Новая сделка
        </Link>
        <Link className="link" to="/cars/new">
          + Добавить авто
        </Link>
        <Link className="link" to="/clients/new">
          + Добавить клиента
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

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="muted">Сделки активные</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{kpi.dealsActive}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Сегодня создано: {kpi.dealsToday}
          </div>
        </div>

        <div className="card">
          <div className="muted">Сделки (всего / закрыто / отменено)</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {kpi.dealsTotal} / {kpi.dealsClosed} / {kpi.dealsCanceled}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Статусы: new / in_progress / closed / canceled
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="muted">Автомобили доступные</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{kpi.carAvailable}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            В резерве: {kpi.carReserved}
          </div>
        </div>

        <div className="card">
          <div className="muted">Автомобили продано</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{kpi.carSold}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Всего авто: {cars.length}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Последние сделки</h3>
          <div className="spacer" />
          <Link className="link" to="/deals">
            открыть список
          </Link>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th style={{ width: 140 }}>Статус</th>
              <th style={{ width: 160 }}>Цена</th>
              <th style={{ width: 140 }}>Клиент ID</th>
              <th style={{ width: 120 }}>Авто ID</th>
              <th style={{ width: 220 }}>Создано</th>
              <th style={{ width: 90 }}>Открыть</th>
            </tr>
          </thead>
          <tbody>
            {lastDeals.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="muted">
                  Сделок пока нет.
                </td>
              </tr>
            ) : (
              lastDeals.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>
                    <span className="badge">{d.status_code}</span>
                  </td>
                  <td>{d.sale_price.toLocaleString("ru-RU")} ₽</td>
                  <td>{d.client_id}</td>
                  <td>{d.car_id}</td>
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

        {loading && <div className="muted" style={{ marginTop: 10 }}>Загрузка...</div>}
      </div>

      {audit && (
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Последние события (журнал)</h3>
            <div className="spacer" />
            <Link className="link" to="/admin/audit">
              открыть журнал
            </Link>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Время</th>
                <th style={{ width: 140 }}>Действие</th>
                <th style={{ width: 140 }}>Сущность</th>
                <th style={{ width: 140 }}>ID</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Нет событий.
                  </td>
                </tr>
              ) : (
                audit.map((a) => (
                  <tr key={a.id}>
                    <td>{fmt(a.created_at)}</td>
                    <td>
                      <span className="badge">{a.action}</span>
                    </td>
                    <td>{a.entity}</td>
                    <td>{a.entity_id || <span className="muted">—</span>}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{a.details || <span className="muted">—</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}