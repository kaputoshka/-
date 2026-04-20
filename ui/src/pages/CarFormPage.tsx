// ui/src/pages/CarFormPage.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, CarOut } from "../api";

type Props = {
  mode: "create" | "edit";
};

export function CarFormPage({ mode }: Props) {
  const nav = useNavigate();
  const { id } = useParams();

  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [vin, setVin] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [year, setYear] = useState<string>("2020");
  const [mileage, setMileage] = useState<string>("0");
  const [price, setPrice] = useState<string>("1000000");

  async function loadForEdit() {
    if (!isEdit) return;

    const carId = Number(id);
    if (!id || Number.isNaN(carId)) {
      setErr("Некорректный id автомобиля");
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const c: CarOut = await api.carGet(carId);
      setVin(c.vin || "");
      setBrand(c.brand || "");
      setModel(c.model || "");
      setYear(String(c.year));
      setMileage(String(c.mileage));
      setPrice(String(c.price));
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки автомобиля");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id]);

  function validate(): { ok: boolean; message?: string } {
    const y = Number(year);
    const m = Number(mileage);
    const p = Number(price);

    if (!brand.trim()) return { ok: false, message: "Укажи марку" };
    if (!model.trim()) return { ok: false, message: "Укажи модель" };
    if (Number.isNaN(y) || y < 1950 || y > 2100) return { ok: false, message: "Год: 1950–2100" };
    if (Number.isNaN(m) || m < 0) return { ok: false, message: "Пробег должен быть ≥ 0" };
    if (Number.isNaN(p) || p <= 0) return { ok: false, message: "Цена должна быть > 0" };
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
        vin: vin.trim() ? vin.trim() : null,
        brand: brand.trim(),
        model: model.trim(),
        year: Number(year),
        mileage: Number(mileage),
        price: Number(price),
      };

      if (isEdit) {
        const carId = Number(id);
        if (!id || Number.isNaN(carId)) throw new Error("Некорректный id");
        const updated = await api.carUpdate(carId, payload);
        nav(`/cars/${updated.id}`);
      } else {
        const created = await api.carCreate(payload);
        nav(`/cars/${created.id}`);
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{isEdit ? "Редактирование автомобиля" : "Добавление автомобиля"}</h2>
        <div className="spacer" />
        <Link className="link" to="/cars">
          к списку
        </Link>
      </div>

      {err && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="error">{err}</div>
        </div>
      )}

      <div className="card">
        <div className="row">
          <div>
            <label>VIN (необязательно)</label>
            <input value={vin} onChange={(e) => setVin(e.target.value)} placeholder="например: XTESTVIN001" />
          </div>
          <div>
            <label>Год</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Марка</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Toyota" />
          </div>
          <div>
            <label>Модель</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Camry" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Пробег (км)</label>
            <input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label>Цена (₽)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1000000" />
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 14 }}>
          <button onClick={save} disabled={loading}>
            {loading ? "Сохранение..." : "Сохранить"}
          </button>
          <button onClick={() => nav(-1)} disabled={loading}>
            Отмена
          </button>
        </div>

        {isEdit && (
          <div className="muted" style={{ marginTop: 10 }}>
            Примечание: статус авто меняется автоматически через сделки (available/reserved/sold).
          </div>
        )}
      </div>
    </div>
  );
}