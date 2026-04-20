// ui/src/layout.tsx
// KISS layout: topbar + sidebar + content

import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getRoles, logout, isAuthed } from "./auth";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "block",
        padding: "10px 12px",
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
        background: isActive ? "rgba(0,0,0,0.08)" : "transparent",
      })}
    >
      {label}
    </NavLink>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const roles = getRoles();
  const authed = isAuthed();
  const username = localStorage.getItem("username") || "user";

  const isAdmin = roles.includes("admin");
  const isLead = roles.includes("lead") || isAdmin;
  const isManager = roles.includes("manager") || isAdmin;

  const doLogout = () => {
    logout();
    nav("/login");
  };

  return (
    <div style={{ display: "grid", gridTemplateRows: "56px 1fr", height: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/" style={{ textDecoration: "none", color: "inherit", fontWeight: 700 }}>
            Car sales — учет сделок
          </Link>
          <span style={{ opacity: 0.6, fontSize: 12 }}>учебная ИС</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {authed ? (
            <>
              <span style={{ opacity: 0.7, fontSize: 14 }}>
                {username} ({roles.join(", ") || "no roles"})
              </span>
              <button onClick={doLogout}>Выйти</button>
            </>
          ) : (
            <Link to="/login">Войти</Link>
          )}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: 0 }}>
        <aside
          style={{
            padding: 12,
            borderRight: "1px solid rgba(0,0,0,0.08)",
            overflow: "auto",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.6, margin: "8px 8px 6px" }}>Основное</div>
          <NavItem to="/" label="Главная" />
          <NavItem to="/deals" label="Сделки" />
          <NavItem to="/cars" label="Автомобили" />
          <NavItem to="/clients" label="Клиенты" />
          <NavItem to="/payments" label="Платежи" />
          {isLead && <NavItem to="/reports" label="Отчеты" />}
          {(isManager || isLead) && <NavItem to="/ai" label="ИИ" />}

          {isAdmin && (
            <>
              <div style={{ fontSize: 12, opacity: 0.6, margin: "14px 8px 6px" }}>Администрирование</div>
              <NavItem to="/admin/users" label="Пользователи" />
              <NavItem to="/admin/roles" label="Роли и права" />
              <NavItem to="/admin/audit" label="Журнал" />
            </>
          )}
        </aside>

        <main style={{ padding: 16, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}