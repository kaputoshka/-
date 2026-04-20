// ui/src/pages/AdminRolesPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import { api, RoleOut, PermissionOut } from "../api";

export function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [perms, setPerms] = useState<PermissionOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // edit
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSelected, setEditSelected] = useState<Record<string, boolean>>({});

  const permsSorted = useMemo(() => {
    return [...perms].sort((a, b) => a.code.localeCompare(b.code));
  }, [perms]);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [r, p] = await Promise.all([api.adminRoles(), api.adminPermissions()]);
      setRoles(r);
      setPerms(p);
      if (Object.keys(selected).length === 0) {
        const init: Record<string, boolean> = {};
        p.forEach((x) => (init[x.code] = false));
        setSelected(init);
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки ролей/прав");
      setRoles([]);
      setPerms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickCodes(map: Record<string, boolean>): string[] {
    return Object.entries(map)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  function toggle(map: Record<string, boolean>, code: string, value: boolean) {
    return { ...map, [code]: value };
  }

  function startEdit(r: RoleOut) {
    setEditRoleId(r.id);
    setEditTitle(r.title || "");
    const init: Record<string, boolean> = {};
    perms.forEach((p) => (init[p.code] = r.permissions.includes(p.code)));
    setEditSelected(init);
  }

  function cancelEdit() {
    setEditRoleId(null);
    setEditTitle("");
    setEditSelected({});
  }

  async function createRole() {
    setLoading(true);
    setErr(null);
    try {
      const payload = {
        name: name.trim(),
        title: title.trim() || null,
        permission_codes: pickCodes(selected),
      };
      if (!payload.name) throw new Error("Укажи name роли");
      await api.adminRoleCreate(payload as any);

      setName("");
      setTitle("");
      const reset: Record<string, boolean> = {};
      perms.forEach((p) => (reset[p.code] = false));
      setSelected(reset);

      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Ошибка создания роли");
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!editRoleId) return;
    setLoading(true);
    setErr(null);
    try {
      await api.adminRoleUpdate(editRoleId, {
        title: editTitle.trim() || null,
        permission_codes: pickCodes(editSelected),
      });
      cancelEdit();
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Ошибка сохранения роли");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Роли и права</h2>
      <p className="muted">KISS-матрица прав: отмечай permissions и сохраняй.</p>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      {/* Create */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Создать роль</h3>

        <div className="row">
          <div>
            <label>Role name (system)</label>
            <input placeholder="например: auditor" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Название (title)</label>
            <input placeholder="например: Аудитор" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Права</label>
          <div className="card" style={{ padding: 10, maxHeight: 260, overflow: "auto" }}>
            {permsSorted.map((p) => (
              <label key={p.code} style={{ display: "flex", gap: 10, alignItems: "center", margin: "6px 0" }}>
                <input
                  type="checkbox"
                  checked={!!selected[p.code]}
                  onChange={(e) => setSelected(toggle(selected, p.code, e.target.checked))}
                  style={{ width: 16 }}
                />
                <span style={{ minWidth: 140 }} className="badge">
                  {p.code}
                </span>
                <span className="muted">{p.title || ""}</span>
              </label>
            ))}
            {permsSorted.length === 0 && <div className="muted">Нет списка прав (permissions).</div>}
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12 }}>
          <button onClick={createRole} disabled={loading}>
            Создать
          </button>
          <div className="spacer" />
          <button onClick={loadAll} disabled={loading}>
            Обновить
          </button>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <div className="muted">Ролей: {roles.length}</div>
          <div className="spacer" />
          <button onClick={loadAll} disabled={loading}>
            Обновить
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 180 }}>name</th>
              <th style={{ width: 240 }}>title</th>
              <th>permissions</th>
              <th style={{ width: 140 }}>действия</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="muted">
                  Ролей нет.
                </td>
              </tr>
            ) : (
              roles.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="badge">{r.name}</span>
                  </td>
                  <td>{r.title || <span className="muted">—</span>}</td>
                  <td style={{ whiteSpace: "pre-wrap" }}>{r.permissions?.join(", ") || <span className="muted">—</span>}</td>
                  <td>
                    <button onClick={() => startEdit(r)} disabled={loading}>
                      Изменить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal-ish */}
      {editRoleId && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Редактирование роли (id={editRoleId})</h3>

          <div className="row">
            <div>
              <label>Название (title)</label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Права</label>
            <div className="card" style={{ padding: 10, maxHeight: 260, overflow: "auto" }}>
              {permsSorted.map((p) => (
                <label key={p.code} style={{ display: "flex", gap: 10, alignItems: "center", margin: "6px 0" }}>
                  <input
                    type="checkbox"
                    checked={!!editSelected[p.code]}
                    onChange={(e) => setEditSelected(toggle(editSelected, p.code, e.target.checked))}
                    style={{ width: 16 }}
                  />
                  <span style={{ minWidth: 140 }} className="badge">
                    {p.code}
                  </span>
                  <span className="muted">{p.title || ""}</span>
                </label>
              ))}
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