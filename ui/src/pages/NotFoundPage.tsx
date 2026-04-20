// ui/src/pages/NotFoundPage.tsx

import React from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2>404 — Страница не найдена</h2>
      <p className="muted">
        Такой страницы нет. Проверь URL или перейди на главную.
      </p>
      <div className="toolbar">
        <Link className="link" to="/">
          На главную
        </Link>
        <Link className="link" to="/deals">
          К сделкам
        </Link>
      </div>
    </div>
  );
}