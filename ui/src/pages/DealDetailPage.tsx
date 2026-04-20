// ui/src/pages/DealDetailPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, DealOut, PaymentOut, AiPredictOut } from "../api";

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function money(x: number) {
  return (x || 0).toLocaleString("ru-RU") + " ₽";
}

export function DealDetailPage() {
  const { id } = useParams();

  const [deal, setDeal] = useState<DealOut | null>(null);
  const [payments, setPayments] = useState<PaymentOut[]>([]);
  const [statuses, setStatuses] = useState<Array<{ code: string; title: string; is_active: boolean }>>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // status change
  const [newStatus, setNewStatus] = useState<string>("");

  // payment create
  const [payAmount, setPayAmount] = useState<string>("");
  const [payKind, setPayKind] = useState<string>("deposit");
  const [payStatus, setPayStatus] = useState<string>("paid");
  const [payNote, setPayNote] = useState<string>("");

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiPredictOut | null>(null);

  const dealId = useMemo(() => {
    const n = Number(id);
    return id && !Number.isNaN(n) ? n : null;
  }, [id]);

  const paidSum = useMemo(() => {
    const sum = payments
      .filter((p) => p.status === "paid")
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    return sum;
  }, [payments]);

  async function load() {
    if (!dealId) {
      setErr("Некорректный id сделки");
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const d = await api.dealGet(dealId);
      setDeal(d);
      setNewStatus(d.status_code);

      const pays = await api.payments({ deal_id: dealId });
      setPayments(pays);

      // статусы могут быть недоступны по правам — не падаем, просто скрываем dropdown
      try {
        const st = await api.dealStatuses();
        setStatuses(st.filter((x) => x.is_active));
      } catch {
        setStatuses([]);
      }

      setAiErr(null);
      setAiResult(null);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки сделки");
      setDeal(null);
      setPayments([]);
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  async function changeStatus() {
    if (!dealId) return;
    if (!newStatus.trim()) return;

    setLoading(true);
    setErr(null);
    try {
      const d = await api.dealChangeStatus(dealId, newStatus.trim());
      setDeal(d);
      setNewStatus(d.status_code);

      // обновим payments тоже (на всякий)
      const pays = await api.payments({ deal_id: dealId });
      setPayments(pays);
    } catch (e: any) {
      setErr(e?.message || "Ошибка смены статуса");
    } finally {
      setLoading(false);
    }
  }

  async function closeDeal() {
    if (!dealId) return;
    if (!confirm("Закрыть сделку? (нужна оплата >= цена продажи)")) return;

    setLoading(true);
    setErr(null);
    try {
      const d = await api.dealClose(dealId);
      setDeal(d);
      setNewStatus(d.status_code);
    } catch (e: any) {
      setErr(e?.message || "Ошибка закрытия сделки");
    } finally {
      setLoading(false);
    }
  }

  async function cancelDeal() {
    if (!dealId) return;
    if (!confirm("Отменить сделку? Авто вернется в available (если не продано).")) return;

    setLoading(true);
    setErr(null);
    try {
      const d = await api.dealCancel(dealId);
      setDeal(d);
      setNewStatus(d.status_code);
    } catch (e: any) {
      setErr(e?.message || "Ошибка отмены сделки");
    } finally {
      setLoading(false);
    }
  }

  async function addPayment() {
    if (!dealId) return;

    setLoading(true);
    setErr(null);
    try {
      const amount = Number(payAmount);
      if (!payAmount.trim() || Number.isNaN(amount) || amount <= 0) throw new Error("Сумма платежа должна быть > 0");

      await api.paymentCreate({
        deal_id: dealId,
        amount,
        kind: payKind,
        status: payStatus,
        note: payNote.trim() || null,
      });

      // reload payments
      const pays = await api.payments({ deal_id: dealId });
      setPayments(pays);

      setPayAmount("");
      setPayNote("");
    } catch (e: any) {
      setErr(e?.message || "Ошибка добавления платежа");
    } finally {
      setLoading(false);
    }
  }

  async function aiPredict() {
    if (!dealId) return;

    setAiLoading(true);
    setAiErr(null);
    setAiResult(null);
    try {
      const r = await api.aiPredict(dealId);
      setAiResult(r);
    } catch (e: any) {
      setAiErr(e?.message || "Ошибка AI прогноза");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Сделка</h2>
        <div className="spacer" />
        <button onClick={load} disabled={loading}>
          Обновить
        </button>
        <Link className="link" to="/deals">
          к списку
        </Link>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      {!deal && !loading && <div className="muted">Сделка не найдена.</div>}

      {deal && (
        <>
          {/* Main */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row">
              <div>
                <div className="muted">ID</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{deal.id}</div>
              </div>
              <div>
                <div className="muted">Статус</div>
                <span className="badge">{deal.status_code}</span>
              </div>
            </div>

            <hr />

            <div className="row">
              <div>
                <div className="muted">Клиент</div>
                <div>
                  <Link className="link" to={`/clients/${deal.client_id}`}>
                    открыть клиента #{deal.client_id}
                  </Link>
                </div>
              </div>
              <div>
                <div className="muted">Автомобиль</div>
                <div>
                  <Link className="link" to={`/cars/${deal.car_id}`}>
                    открыть авто #{deal.car_id}
                  </Link>
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="muted">Цена продажи</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{money(deal.sale_price)}</div>
              </div>
              <div>
                <div className="muted">Скидка</div>
                <div>{money(deal.discount)}</div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="muted">Источник</div>
                <div>{deal.source}</div>
              </div>
              <div>
                <div className="muted">Касания</div>
                <div>{deal.touches}</div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="muted">Создано</div>
                <div>{fmt(deal.created_at)}</div>
              </div>
              <div>
                <div className="muted">Обновлено</div>
                <div>{fmt(deal.updated_at)}</div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="muted">Закрыто</div>
                <div>{deal.closed_at ? fmt(deal.closed_at) : <span className="muted">—</span>}</div>
              </div>
              <div>
                <div className="muted">Менеджер ID</div>
                <div>{deal.manager_id}</div>
              </div>
            </div>

            <hr />

            <div className="toolbar">
              {statuses.length > 0 ? (
                <>
                  <div style={{ width: 260 }}>
                    <label>Сменить статус</label>
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      {statuses.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={changeStatus} disabled={loading}>
                    Применить
                  </button>
                </>
              ) : (
                <div className="muted">Список статусов недоступен (нет прав или нет данных).</div>
              )}

              <div className="spacer" />

              <button onClick={closeDeal} disabled={loading}>
                Закрыть сделку
              </button>
              <button onClick={cancelDeal} disabled={loading}>
                Отменить
              </button>
            </div>

            <div className="muted" style={{ marginTop: 10 }}>
              Для закрытия требуется: оплачено ≥ {money(deal.sale_price)}. Сейчас оплачено: {money(paidSum)}.
            </div>
          </div>

          {/* Payments */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Платежи</h3>
              <div className="spacer" />
              <div className="muted">Всего: {payments.length}</div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 120 }}>Тип</th>
                  <th style={{ width: 120 }}>Статус</th>
                  <th style={{ width: 160 }}>Сумма</th>
                  <th style={{ width: 220 }}>Дата</th>
                  <th>Примечание</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Платежей нет.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>
                        <span className="badge">{p.kind}</span>
                      </td>
                      <td>
                        <span className="badge">{p.status}</span>
                      </td>
                      <td>{money(p.amount)}</td>
                      <td>{fmt(p.paid_at)}</td>
                      <td style={{ whiteSpace: "pre-wrap" }}>{p.note || <span className="muted">—</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <hr />

            <h4 style={{ margin: "0 0 10px" }}>Добавить платеж</h4>
            <div className="row">
              <div>
                <label>Сумма</label>
                <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="например: 50000" />
              </div>
              <div>
                <label>Тип</label>
                <select value={payKind} onChange={(e) => setPayKind(e.target.value)}>
                  <option value="deposit">deposit</option>
                  <option value="full">full</option>
                  <option value="other">other</option>
                </select>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <label>Статус</label>
                <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
                  <option value="paid">paid</option>
                  <option value="planned">planned</option>
                </select>
              </div>
              <div>
                <label>Примечание</label>
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="необязательно" />
              </div>
            </div>

            <div className="toolbar" style={{ marginTop: 12 }}>
              <button onClick={addPayment} disabled={loading}>
                Добавить
              </button>
            </div>
          </div>

          {/* AI */}
          <div className="card">
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>ИИ-оценка сделки</h3>
              <div className="spacer" />
              <button onClick={aiPredict} disabled={aiLoading}>
                {aiLoading ? "..." : "Оценить"}
              </button>
            </div>

            {aiErr && <div className="error">{aiErr}</div>}

            {aiResult ? (
              <div className="row" style={{ marginTop: 10 }}>
                <div className="card">
                  <div className="muted">Вероятность закрытия</div>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>
                    {(aiResult.probability_close * 100).toFixed(1)}%
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span className="badge">{aiResult.level}</span>
                  </div>
                </div>
                <div className="card">
                  <div className="muted">Признаки</div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(aiResult.used_features, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="muted">Нажми “Оценить”, чтобы получить прогноз.</div>
            )}
          </div>
        </>
      )}

      {loading && <div className="muted" style={{ marginTop: 10 }}>Загрузка...</div>}
    </div>
  );
}