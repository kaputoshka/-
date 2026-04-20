// ui/src/pages/AiPage.tsx
// AI: train + metrics + predict for deal_id (KISS)

import React, { useEffect, useState } from "react";
import { api, AiPredictOut } from "../api";
import { hasRole } from "../auth";

export function AiPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<any | null>(null);
  const [trainResult, setTrainResult] = useState<any | null>(null);

  const [dealId, setDealId] = useState<string>("");
  const [predict, setPredict] = useState<AiPredictOut | null>(null);

  const canTrain = hasRole("admin") || hasRole("lead");

  async function loadMetrics() {
    setErr(null);
    try {
      const m = await api.aiMetrics();
      setMetrics(m);
    } catch (e: any) {
      setMetrics(null);
      // метрик может не быть до обучения — не считаем это “ошибкой UI”
      if (String(e?.message || "").includes("Train")) return;
      setErr(e?.message || "Ошибка загрузки метрик");
    }
  }

  useEffect(() => {
    loadMetrics();
  }, []);

  async function train() {
    setLoading(true);
    setErr(null);
    setTrainResult(null);
    try {
      const r = await api.aiTrain();
      setTrainResult(r);
      await loadMetrics();
      alert("Модель обучена и сохранена (server/storage/model.joblib)");
    } catch (e: any) {
      setErr(e?.message || "Ошибка обучения");
    } finally {
      setLoading(false);
    }
  }

  async function doPredict() {
    setLoading(true);
    setErr(null);
    setPredict(null);

    try {
      const id = Number(dealId);
      if (!dealId.trim() || Number.isNaN(id)) throw new Error("Укажи deal_id (число)");
      const r = await api.aiPredict(id);
      setPredict(r);
    } catch (e: any) {
      setErr(e?.message || "Ошибка прогноза");
    } finally {
      setLoading(false);
    }
  }

  function badgeFor(level: string) {
    const text = level === "high" ? "Высокая" : level === "medium" ? "Средняя" : "Низкая";
    return <span className="badge">{text}</span>;
  }

  return (
    <div>
      <h2>ИИ-модуль</h2>
      <p className="muted">
        Учебная модель: прогноз вероятности успешного закрытия сделки. Обучение доступно руководителю/админу.
      </p>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      {/* Train + Metrics */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>Обучение и метрики</h3>
          <div className="spacer" />
          <button onClick={loadMetrics} disabled={loading}>
            Обновить метрики
          </button>
          {canTrain && (
            <button onClick={train} disabled={loading}>
              {loading ? "..." : "Обучить модель"}
            </button>
          )}
        </div>

        <hr />

        {metrics ? (
          <div>
            <div className="muted">trained_at: {metrics.trained_at}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="card">
                <div className="muted">samples</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.samples}</div>
              </div>
              <div className="card">
                <div className="muted">features</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.features}</div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>metrics</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(metrics.metrics, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <div className="muted">Метрик пока нет. Нажми “Обучить модель” (если есть права).</div>
        )}

        {trainResult && (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Результат обучения</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(trainResult, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Predict */}
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Прогноз по сделке</h3>

        <div className="toolbar">
          <div style={{ width: 260 }}>
            <label>deal_id</label>
            <input value={dealId} onChange={(e) => setDealId(e.target.value)} placeholder="например: 1" />
          </div>
          <button onClick={doPredict} disabled={loading}>
            Рассчитать
          </button>
        </div>

        {predict && (
          <div style={{ marginTop: 12 }}>
            <div className="row">
              <div className="card">
                <div className="muted">Вероятность закрытия</div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>
                  {(predict.probability_close * 100).toFixed(1)}%
                </div>
                <div style={{ marginTop: 6 }}>{badgeFor(predict.level)}</div>
              </div>
              <div className="card">
                <div className="muted">Использованные признаки</div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(predict.used_features, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}

        {!predict && <div className="muted" style={{ marginTop: 12 }}>Введи deal_id и нажми “Рассчитать”.</div>}
      </div>
    </div>
  );
}