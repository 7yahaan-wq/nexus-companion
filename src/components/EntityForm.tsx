import { L } from '../domain/i18n';
import { useState } from 'react';
import Modal from './Modal';
import { api, uid } from '../domain/api';
import type { Entity } from '../domain/types';
import { useI18n } from '../domain/i18n';
export interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}
export default function EntityForm({
  title,
  value,
  fields,
  onSave,
  onClose,
  onDelete,
}: {
  title: string;
  value?: Entity;
  fields: Field[];
  onSave: (value: Entity) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<Entity>(value || { id: uid() }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        ...form,
        updatedAt: new Date().toISOString(),
        createdAt: form.createdAt || new Date().toISOString(),
      });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="entity-form">
        {fields.map((f) => (
          <label key={f.key}>
            <span>
              {f.label}
              {f.required ? ' *' : ''}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                aria-label={f.label}
                rows={4}
                value={form[f.key] || ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ) : f.options ? (
              <select
                aria-label={f.label}
                value={form[f.key] || ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {['status', 'priority', 'type'].includes(f.key) ? t(o.label) : o.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'directory' ? (
              <div className="input-action">
                <input
                  aria-label={f.label}
                  value={form[f.key] || ''}
                  required={f.required}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const p = await api('chooseDirectory');
                      if (p) setForm({ ...form, [f.key]: p });
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  <L text="浏览" />
                </button>
              </div>
            ) : (
              <input
                aria-label={f.label}
                type={f.type || 'text'}
                required={f.required}
                min={f.type === 'number' ? 0 : undefined}
                value={form[f.key] ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                  })
                }
              />
            )}
          </label>
        ))}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="modal-actions">
          {onDelete && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (!confirm) {
                  setConfirm(true);
                  return;
                }
                setBusy(true);
                try {
                  await onDelete();
                  onClose();
                } catch (e: any) {
                  setError(e.message);
                  setBusy(false);
                }
              }}
            >
              {confirm ? '确认删除' : '删除'}
            </button>
          )}
          <button type="button" onClick={onClose}>
            <L text="取消" />
          </button>
          <button className="primary" disabled={busy} type="submit">
            {busy ? '保存中…' : '保存'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
