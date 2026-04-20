// ui/src/pages/DealFormPage.tsx
// KISS: create deal (pick client + pick available car + price/discount/source/touches)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, CarOut, ClientOut } from "../api";

export function DealFormPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // data
  const [clients, setClients] = useState<ClientOut[]>([]);
  const [cars, setCars] = useState<CarOut[]>([]);

  // selections
  const [clientId, setClientId] = useState<string>("");
  const [carId, setCarId] = useState<string>("");

  // deal fields
  const [salePrice, setSalePrice] = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [source, setSource] = useState<string>("site");
  const [touches, setTouches] = useState<string>("1");

  // quick search
  const [clientQ, setClientQ] = useState<string>("");
  const [carQ, setCarQ] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [cl, ca] = await Promise.all([api.clients(), api.cars({ status: "available" })]);
      setClients(cl);
      setCars(ca);

      // если авто уже выбрано — проставим цену по умолчанию
      if (!salePrice && ca.length > 0) {
        // оставляем пустым, пока не выбрали авто
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки данных");
      setClients([]);
      setCars([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredClients = useMemo(() => {
    const q = clientQ.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => (c.full_name + " " + c.phone).toLowerCase().includes(q));
  }, [clients, clientQ]);

  const filteredCars = useMemo(() => {
    const q = carQ.trim().toLowerCase();
    if (!q) return cars;
    return cars.filter((c) => `${c.brand} ${c.model} ${c.vin || ""}`.toLowerCase().includes(q));
  }, [cars, carQ]);

  const selectedCar = useMemo(() => {
    const id = Number(carId);
    if (!carId.trim() || Number.isNaN(id)) return null;
    return cars.find((c) => c.id === id) || null;
  }, [carId, cars]);

  useEffect(() => {
    // При выборе авто — подставим price по умолчанию (если salePrice пуст)
    if (selectedCar && !salePrice.trim()) {
      setSalePrice(String(selectedCar.price));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCar?.id]);

  function validate(): { ok: boolean; message?: string } {
    const cId = Number(clientId);
    const aId = Number(carId);
    const sp = Number(salePrice);
    const d = Number(discount);
    const t = Number(touches);

    if (!clientId.trim() || Number.isNaN(cId)) return { ok: false, message: "Выбери клиента" };
    if (!carId.trim() || Number.isNaN(aId)) return { ok: false, message: "Выбери автомобиль" };
    if (Number.isNaN(sp) || sp <= 0) return { ok: false, message: "Цена продажи должна быть > 0" };
    if (Number.isNaN(d) || d < 0) return { ok: false, message: "Скидка должна быть ≥ 0" };
    if (d > sp) return { ok: false, message: "Скидка не может быть больше цены" };
    if (!source.trim()) return { ok: false, message: "Укажи источник" };
    if (Number.isNaN(t) || t < 1) return { ok: false, message: "Касания должны быть ≥ 1" };
    return { ok: true };
  }

  async function save() {
    const v = validate();
    if (!v.ok) {
      setErr(v.message || "Проверь поля");
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const payload = {
        client_id: Number(clientId),
        car_id: Number(carId),
        sale_price: Number(salePrice),
        discount: Number(discount),
        source: source.trim(),
        touches: Number(touches),
      };

      const d = await api.dealCreate(payload);
      nav(`/deals/${d.id}`);
    } catch (e: any) {
      setErr(e?.message || "Ошибка создания сделки");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Создание сделки</h2>
        <div className="spacer" />
        <Link className="link" to="/deals">
          к списку
        </Link>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      <div className="row">
        {/* Client */}
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Клиент</h3>
            <div className="spacer" />
            <Link className="link" to="/clients/new">
              + новый клиент
            </Link>
          </div>

          <label>Поиск</label>
          <input value={clientQ} onChange={(e) => setClientQ(e.target.value)} placeholder="ФИО / телефон" />

          <div style={{ marginTop: 10 }}>
            <label>Выбор клиента</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— выбери —</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  #{c.id} — {c.full_name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="muted" style={{ marginTop: 10 }}>
            Клиентов: {filteredClients.length}
          </div>
        </div>

        {/* Car */}
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Автомобиль</h3>
            <div className="spacer" />
            <Link className="link" to="/cars/new">
              + новое авто
            </Link>
          </div>

          <label>Поиск</label>
          <input value={carQ} onChange={(e) => setCarQ(e.target.value)} placeholder="марка / модель / VIN" />

          <div style={{ marginTop: 10 }}>
            <label>Выбор авто (только available)</label>
            <select value={carId} onChange={(e) => setCarId(e.target.value)}>
              <option value="">— выбери —</option>
              {filteredCars.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  #{c.id} — {c.brand} {c.model} {c.year} — {c.price.toLocaleString("ru-RU")} ₽
                </option>
              ))}
            </select>
          </div>

          {selectedCar && (
            <div className="card" style={{ marginTop: 10 }}>
              <div className="muted">Выбрано</div>
              <div style={{ fontWeight: 800 }}>
                {selectedCar.brand} {selectedCar.model} {selectedCar.year}
              </div>
              <div className="muted">price: {selectedCar.price.toLocaleString("ru-RU")} ₽, mileage: {selectedCar.mileage.toLocaleString("ru-RU")} км</div>
            </div>
          )}

          <div className="muted" style={{ marginTop: 10 }}>
            Доступных авто: {filteredCars.length}
          </div>
        </div>
      </div>

      {/* Deal fields */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Условия сделки</h3>

        <div className="row">
          <div>
            <label>Цена продажи (₽)</label>
            <input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="например: 1500000" />
          </div>
          <div>
            <label>Скидка (₽)</label>
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Источник</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="site">site</option>
              <option value="call">call</option>
              <option value="ads">ads</option>
              <option value="walkin">walkin</option>
              <option value="partners">partners</option>
              <option value="unknown">unknown</option>
            </select>
          </div>
          <div>
            <label>Касания (touches)</label>
            <input value={touches} onChange={(e) => setTouches(e.target.value)} placeholder="1" />
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 14 }}>
          <button onClick={save} disabled={loading}>
            {loading ? "Создание..." : "Создать сделку"}
          </button>
          <button onClick={() => nav(-1)} disabled={loading}>
            Отмена
          </button>
          <div className="spacer" />
          <button onClick={load} disabled={loading}>
            Обновить списки
          </button>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>
          После создания сделки авто автоматически перейдёт в статус <span className="badge">reserved</span>.
        </div>
      </div>
    </div>
  );
}