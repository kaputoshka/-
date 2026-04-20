// ui/src/pages/LoginPage.tsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { setToken, setRoles } from "../auth";

export function LoginPage() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      const res = await api.login(username.trim(), password);
      setToken(res.access_token);
      setRoles(res.roles || []);
      localStorage.setItem("username", res.username || username.trim());
      nav("/");
    } catch (e: any) {
      setErr(e?.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 16 }}>
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        <h2>Вход</h2>
        <p className="muted">
          Учёт сделок по продаже автомобилей (учебный проект).
        </p>

        {err && <div className="error" style={{ marginBottom: 10 }}>{err}</div>}

        <form onSubmit={submit}>
          <div style={{ marginBottom: 10 }}>
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin / manager / lead" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="admin / manager / lead" />
          </div>

          <div className="toolbar">
            <button type="submit" disabled={loading}>
              {loading ? "..." : "Войти"}
            </button>
            <div className="spacer" />
            <Link className="link" to="/">
              На главную
            </Link>
          </div>
        </form>

        <hr />

        <div className="muted" style={{ fontSize: 13 }}>
          Тестовые пользователи появляются после запуска <span className="badge">seed</span> в админке:
          <div style={{ marginTop: 6 }}>
            admin / admin<br />
            manager / manager<br />
            lead / lead
          </div>
        </div>
      </div>
    </div>
  );
}
