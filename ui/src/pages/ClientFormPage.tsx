// ui/src/pages/ClientFormPage.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, ClientOut } from "../api";

type Props = {
  mode: "create" | "edit";
};

export function ClientFormPage({ mode }: Props) {
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [docId, setDocId] = useState("");
  const [note, setNote] = useState("");

  async function loadForEdit() {
    if (!isEdit) return;

    const clientId = Number(id);
    if (!id || Number.isNaN(clientId)) {
      setErr("Некорректный id клиента");
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const c: ClientOut = await api.clientGet(clientId);
      setFullName(c.full_name || "");
      setPhone(c.phone || "");
      setDocId(c.doc_id || "");
      setNote(c.note || "");
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки клиента");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id]);

  function validate(): { ok: boolean; message?: string } {
    if (!fullName.trim() || fullName.trim().length < 2) return { ok: false, message: "ФИО минимум 2 символа" };
    if (!phone.trim() || phone.trim().length < 5) return { ok: false, message: "Телефон минимум 5 символов" };
    if (docId.trim().length > 64) return { ok: false, message: "Документ слишком длинный" };
    if (note.trim().length > 500) return { ok: false, message: "Примечание слишком длинное" };
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
        full_name: fullName.trim(),
        phone: phone.trim(),
        doc_id: docId.trim() ? docId.trim() : null,
        note: note.trim() ? note.trim() : null,
      };

      if (isEdit) {
        const clientId = Number(id);
        if (!id || Number.isNaN(clientId)) throw new Error("Некорректный id");
        const updated = await api.clientUpdate(clientId, payload);
        nav(`/clients/${updated.id}`);
      } else {
        const created = await api.clientCreate(payload);
        nav(`/clients/${created.id}`);
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
        <h2 style={{ margin: 0 }}>{isEdit ? "Редактирование клиента" : "Добавление клиента"}</h2>
        <div className="spacer" />
        <Link className="link" to="/clients">
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
            <label>ФИО</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван" />
          </div>
          <div>
            <label>Телефон</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79990000000" />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Документ (упрощённо)</label>
            <input value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="1111 222222" />
          </div>
          <div>
            <label>Примечание</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="необязательно" />
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
      </div>
    </div>
  );
}