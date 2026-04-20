// ui/src/pages/AdminUsersPage.tsx

import React, { useEffect, useState } from "react";
import { api, UserOut } from "../api";

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState({ admin: false, manager: true, lead: false });

  // edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editRoles, setEditRoles] = useState({ admin: false, manager: false, lead: false });

  async function loadUsers() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.adminUsers();
      setUsers(data);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки пользователей");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function roleNamesFromState(state: { admin: boolean; manager: boolean; lead: boolean }) {
    const out: string[] = [];
    if (state.admin) out.push("admin");
    if (state.manager) out.push("manager");
    if (state.lead) out.push("lead");
    return out;
  }

  async function createUser() {
    setLoading(true);
    setErr(null);
    try {
      const u = username.trim();
      const p = password.trim();
      if (!u) throw new Error("Укажи username");
      if (p.length < 4) throw new Error("Пароль минимум 4 символа");

      await api.adminUserCreate({
        username: u,
        full_name: fullName.trim() || null,
        password: p,
        role_names: roleNamesFromState(roles),
      } as any);

      setUsername("");
      setFullName("");
      setPassword("");
      setRoles({ admin: false, manager: true, lead: false });

      await loadUsers();
    } catch (e: any) {
      setErr(e?.message || "Ошибка создания пользователя");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(u: UserOut) {
    setEditId(u.id);
    setEditFullName(u.full_name || "");
    setEditPassword("");
    setEditActive(u.is_active);
    setEditRoles({
      admin: u.roles.includes("admin"),
      manager: u.roles.includes("manager"),
      lead: u.roles.includes("lead"),
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditFullName("");
    setEditPassword("");
    setEditActive(true);
    setEditRoles({ admin: false, manager: false, lead: false });
  }

  async function saveEdit() {
    if (!editId) return;
    setLoading(true);
    setErr(null);
    try {
      await api.adminUserUpdate(editId, {
        full_name: editFullName.trim() || null,
        is_active: editActive,
        password: editPassword.trim() ? editPassword.trim() : null,
        role_names: roleNamesFromState(editRoles),
      } as any);

      cancelEdit();
      await loadUsers();
    } catch (e: any) {
      setErr(e?.message || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  }

  async function seed() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.seed();
      alert(
        `Seed OK.\nadmin/admin\nmanager/manager\nlead/lead\n\n${JSON.stringify(res, null, 2)}`
      );
      await loadUsers();
    } catch (e: any) {
      setErr(e?.message || "Ошибка seed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Пользователи</h2>
      <p className="muted">
        Создание/редактирование пользователей и назначение ролей. Seed создаёт тестовые роли/права/статусы/пользователей.
      </p>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <button onClick={loadUsers} disabled={loading}>
          Обновить
        </button>
        <button onClick={seed} disabled={loading}>
          Seed (тестовые данные)
        </button>
      </div>

      {/* Create */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Создать пользователя</h3>

        <div className="row">
          <div>
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="например: user1" />
          </div>
          <div>
            <label>ФИО</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="необязательно" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label>Роли</label>
            <div className="card" style={{ padding: 10 }}>
              {(["admin", "manager", "lead"] as const).map((r) => (
                <label key={r} style={{ display: "flex", gap: 10, alignItems: "center", margin: "6px 0" }}>
                  <input
                    type="checkbox"
                    checked={(roles as any)[r]}
                    onChange={(e) => setRoles({ ...roles, [r]: e.target.checked })}
                    style={{ width: 16 }}
                  />
                  <span className="badge">{r}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <button onClick={createUser} disabled={loading}>
            Создать
          </button>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="muted" style={{ marginBottom: 10 }}>
          Пользователей: {users.length}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>id</th>
              <th style={{ width: 220 }}>username</th>
              <th>ФИО</th>
              <th style={{ width: 140 }}>active</th>
              <th style={{ width: 240 }}>roles</th>
              <th style={{ width: 140 }}>действия</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="muted">
                  Пользователей нет.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    <span className="badge">{u.username}</span>
                  </td>
                  <td>{u.full_name || <span className="muted">—</span>}</td>
                  <td>{u.is_active ? "yes" : "no"}</td>
                  <td>{u.roles?.join(", ") || <span className="muted">—</span>}</td>
                  <td>
                    <button onClick={() => startEdit(u)} disabled={loading}>
                      Изменить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit */}
      {editId && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Редактирование пользователя (id={editId})</h3>

          <div className="row">
            <div>
              <label>ФИО</label>
              <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </div>
            <div>
              <label>Новый пароль (необязательно)</label>
              <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div>
              <label>Active</label>
              <select value={editActive ? "1" : "0"} onChange={(e) => setEditActive(e.target.value === "1")}>
                <option value="1">yes</option>
                <option value="0">no</option>
              </select>
            </div>
            <div>
              <label>Роли</label>
              <div className="card" style={{ padding: 10 }}>
                {(["admin", "manager", "lead"] as const).map((r) => (
                  <label key={r} style={{ display: "flex", gap: 10, alignItems: "center", margin: "6px 0" }}>
                    <input
                      type="checkbox"
                      checked={(editRoles as any)[r]}
                      onChange={(e) => setEditRoles({ ...editRoles, [r]: e.target.checked })}
                      style={{ width: 16 }}
                    />
                    <span className="badge">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="toolbar" style={{ marginTop: 12 }}>
            <button onClick={saveEdit} disabled={loading}>
              Сохранить
            </button>
            <button onClick={cancelEdit} disabled={loading}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
