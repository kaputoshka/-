// ui/src/pages/ForbiddenPage.tsx

import React from "react";
import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2>403 — Нет доступа</h2>
      <p className="muted">
        У вашей роли недостаточно прав для просмотра этой страницы.
      </p>
      <div className="toolbar">
        <Link className="link" to="/">
          На главную
        </Link>
        <Link className="link" to="/login">
          Войти другим пользователем
        </Link>
      </div>
    </div>
  );
}