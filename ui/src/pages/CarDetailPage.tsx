// ui/src/pages/CarDetailPage.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, CarOut, DealOut } from "../api";

export function CarDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [car, setCar] = useState<CarOut | null>(null);
  const [deals, setDeals] = useState<DealOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const carId = Number(id);
      if (!id || Number.isNaN(carId)) throw new Error("Некорректный id");

      const c = await api.carGet(carId);
      setCar(c);

      // backend не имеет /cars/:id/deals, поэтому KISS: тянем все сделки и фильтруем по car_id
      const allDeals = await api.deals();
      setDeals(allDeals.filter((d) => d.car_id === carId));
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки");
      setCar(null);
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
    if (!car) return;
    if (!confirm(`Удалить авто #${car.id}?`)) return;

    setLoading(true);
    setErr(null);
    try {
      await api.carDelete(car.id);
      nav("/cars");
    } catch (e: any) {
      setErr(e?.message || "Ошибка удаления");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Автомобиль</h2>
        <div className="spacer" />
        <button onClick={load} disabled={loading}>
          Обновить
        </button>
        {car && (
          <>
            <Link className="link" to={`/cars/${car.id}/edit`} style={{ marginRight: 8 }}>
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

      {!car && !loading && <div className="muted">Автомобиль не найден.</div>}

      {car && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row">
              <div>
                <div className="muted">ID</div>
                <div style={{ fontWeight: 700 }}>{car.id}</div>
              </div>
              <div>
                <div className="muted">Статус</div>
                <span className="badge">{car.status}</span>
              </div>
            </div>

            <hr />

            <div className="row">
              <div>
                <div className="muted">VIN</div>
                <div>{car.vin || <span className="muted">—</span>}</div>
              </div>
              <div>
                <div className="muted">Марка / модель</div>
                <div>
                  {car.brand} {car.model}
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="muted">Год</div>
                <div>{car.year}</div>
              </div>
              <div>
                <div className="muted">Пробег</div>
                <div>{car.mileage.toLocaleString("ru-RU")} км</div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <div className="muted">Цена</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{car.price.toLocaleString("ru-RU")} ₽</div>
              </div>
              <div>
                <div className="muted">Создано</div>
                <div>{new Date(car.created_at).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Сделки по автомобилю</h3>
              <div className="spacer" />
              <Link className="link" to="/deals/new">
                Создать сделку
              </Link>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 140 }}>Статус</th>
                  <th style={{ width: 170 }}>Цена</th>
                  <th style={{ width: 220 }}>Создано</th>
                  <th style={{ width: 120 }}>Открыть</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Сделок по этому автомобилю нет.
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
                      <td>{new Date(d.created_at).toLocaleString()}</td>
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