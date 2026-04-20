// ui/src/pages/ClientDetailPage.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, ClientOut, DealOut } from "../api";

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export function ClientDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [client, setClient] = useState<ClientOut | null>(null);
  const [deals, setDeals] = useState<DealOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const clientId = Number(id);
      if (!id || Number.isNaN(clientId)) throw new Error("Некорректный id");

      const c = await api.clientGet(clientId);
      setClient(c);

      // backend нет /clients/:id/deals — KISS: тянем все и фильтруем
      const allDeals = await api.deals();
      setDeals(allDeals.filter((d) => d.client_id === clientId));
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки");
      setClient(null);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function del() {
    if (!client) return;
    if (!confirm(`Удалить клиента #${client.id}? (если есть сделки — система запретит)`)) return;

    setLoading(true);
    setErr(null);
    try {
      await api.clientDelete(client.id);
      nav("/clients");
    } catch (e: any) {
      setErr(e?.message || "Ошибка удаления");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Клиент</h2>
        <div className="spacer" />
        <button onClick={load} disabled={loading}>
          Обновить
        </button>
        {client && (
          <>
            <Link className="link" to={`/clients/${client.id}/edit`} style={{ marginRight: 8 }}>
              Редактировать
            </Link>
            <button onClick={del} disabled={loading}>
              Удалить
            </button>
          </>
        )}
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      {!client && !loading && <div className="muted">Клиент не найден.</div>}

      {client && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row">
              <div>
                <div className="muted">ID</div>
                <div style={{ fontWeight: 800 }}>{client.id}</div>
              </div>
              <div>
                <div className="muted">Создано</div>
                <div>{fmt(client.created_at)}</div>
              </div>
            </div>

            <hr />

            <div className="row">
              <div>
                <div className="muted">ФИО</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{client.full_name}</div>
              </div>
              <div>
                <div className="muted">Телефон</div>
                <div>{client.phone}</div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="muted">Документ</div>
                <div>{client.doc_id || <span className="muted">—</span>}</div>
              </div>
              <div>
                <div className="muted">Примечание</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{client.note || <span className="muted">—</span>}</div>
              </div>
            </div>

            <div className="toolbar" style={{ marginTop: 12 }}>
              <Link className="link" to="/deals/new">
                + Создать сделку
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Сделки клиента</h3>
              <div className="spacer" />
              <div className="muted">Всего: {deals.length}</div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 140 }}>Статус</th>
                  <th style={{ width: 160 }}>Цена</th>
                  <th style={{ width: 120 }}>Авто ID</th>
                  <th style={{ width: 220 }}>Создано</th>
                  <th style={{ width: 120 }}>Открыть</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Сделок нет.
                    </td>
                  </tr>
                ) : (
                  deals.map((d) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>
                        <span className="badge">{d.status_code}</span>
                      </td>
                      <td>{d.sale_price.toLocaleString("ru-RU")} ₽</td>
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
          </div>
        </>
      )}

      {loading && <div className="muted" style={{ marginTop: 10 }}>Загрузка...</div>}
    </div>
  );
}