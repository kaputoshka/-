// ui/src/pages/AdminAuditPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import { api, AuditOut, UserOut } from "../api";

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export function AdminAuditPage() {
  const [rows, setRows] = useState<AuditOut[]>([]);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [userId, setUserId] = useState<string>(""); // keep as string for input/select
  const [entity, setEntity] = useState<string>("");
  const [action, setAction] = useState<string>("");

  const userMap = useMemo(() => {
    const m = new Map<number, string>();
    users.forEach((u) => m.set(u.id, u.username));
    return m;
  }, [users]);

  async function loadUsers() {
    try {
      const u = await api.adminUsers();
      setUsers(u);
    } catch {
      // если вдруг не грузится - не критично
      setUsers([]);
    }
  }

  async function loadAudit() {
    setLoading(true);
    setErr(null);
    try {
      const uid = userId.trim() ? Number(userId) : undefined;
      const data = await api.audit({
        date_from: dateFrom.trim() || undefined,
        date_to: dateTo.trim() || undefined,
        user_id: uid && !Number.isNaN(uid) ? uid : undefined,
        entity: entity.trim() || undefined,
        action: action.trim() || undefined,
      });
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки журнала");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setUserId("");
    setEntity("");
    setAction("");
  }

  useEffect(() => {
    loadUsers();
    // начальная загрузка журнала
    loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2>Журнал действий (Audit)</h2>
      <p className="muted">
        Фильтры: период, пользователь, сущность, действие. Для дат — формат YYYY-MM-DD.
      </p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <div>
            <label>Дата от</label>
            <input placeholder="YYYY-MM-DD" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label>Дата до</label>
            <input placeholder="YYYY-MM-DD" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Пользователь</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Все</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.username} (id={u.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Сущность (entity)</label>
            <input
              placeholder="например: Deal / Car / Client / Payment / User / Role / AI"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Действие (action)</label>
            <input placeholder="например: CREATE / UPDATE / DELETE / LOGIN / AI_TRAIN / AI_PREDICT" value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
            <button onClick={loadAudit} disabled={loading}>
              {loading ? "Загрузка..." : "Применить фильтры"}
            </button>
            <button
              onClick={() => {
                clearFilters();
                // после очистки — перезагрузить без фильтров
                setTimeout(() => loadAudit(), 0);
              }}
              disabled={loading}
            >
              Сбросить
            </button>
          </div>
        </div>

        {err && <div className="error" style={{ marginTop: 10 }}>{err}</div>}
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <div className="muted">Записей: {rows.length}</div>
          <div className="spacer" />
          <button onClick={loadAudit} disabled={loading}>
            Обновить
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 180 }}>Время</th>
              <th style={{ width: 140 }}>Пользователь</th>
              <th style={{ width: 120 }}>Действие</th>
              <th style={{ width: 120 }}>Сущность</th>
              <th style={{ width: 120 }}>ID</th>
              <th>Детали</th>
              <th style={{ width: 140 }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="muted">
                  Нет записей по выбранным фильтрам.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmt(r.created_at)}</td>
                  <td>
                    {r.user_id ? (
                      <>
                        <span className="badge">{userMap.get(r.user_id) || `id=${r.user_id}`}</span>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge">{r.action}</span>
                  </td>
                  <td>{r.entity}</td>
                  <td>{r.entity_id || <span className="muted">—</span>}</td>
                  <td style={{ whiteSpace: "pre-wrap" }}>{r.details || <span className="muted">—</span>}</td>
                  <td>{r.ip || <span className="muted">—</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}