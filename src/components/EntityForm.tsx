import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { api, uid } from '../domain/api';
import type { Entity } from '../domain/types';
import { useI18n } from '../domain/i18n';
import { useDraft } from '../domain/useDraft';
export interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  advanced?: boolean;
  options?: { value: string; label: string }[];
}
export default function EntityForm({
  title,
  value,
  fields,
  onSave,
  onClose,
  onDelete,
  draftKey,
}: {
  title: string;
  value?: Entity;
  fields: Field[];
  onSave: (value: Entity) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  draftKey?: string;
}) {
  const { t } = useI18n();
  const initial = useRef<Entity>(value || { id: uid() });
  const draft = useDraft(draftKey, initial.current);
  const { form } = draft;
  const element = useRef<HTMLFormElement>(null);
  const busyRef = useRef(false);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (draft.ready)
      element.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
  }, [draft.ready]);

  function lock() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    return true;
  }
  function unlock() {
    busyRef.current = false;
    setBusy(false);
  }
  async function close() {
    if (busyRef.current) return;
    if (!draftKey && draft.dirty) {
      setConfirmClose(true);
      return;
    }
    if (!lock()) return;
    try {
      await draft.flush();
      onClose();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      unlock();
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.ready || !lock()) return;
    try {
      await onSave({
        ...form,
        updatedAt: new Date().toISOString(),
        createdAt: form.createdAt || new Date().toISOString(),
      });
      await draft.clear();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      unlock();
    }
  }
  const field = (f: Field) => (
    <label key={f.key}>
      <span>
        {t(f.label)}
        {f.required ? ' *' : ''}
      </span>
      {f.type === 'textarea' ? (
        <textarea
          aria-label={f.label}
          rows={4}
          required={f.required}
          value={form[f.key] || ''}
          onChange={(e) => draft.change(f.key, e.target.value)}
        />
      ) : f.options ? (
        <select
          aria-label={f.label}
          required={f.required}
          value={form[f.key] || ''}
          onChange={(e) => draft.change(f.key, e.target.value)}
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
            onChange={(e) => draft.change(f.key, e.target.value)}
          />
          <button
            type="button"
            onClick={async () => {
              if (!lock()) return;
              try {
                const p = await api('chooseDirectory');
                if (p) draft.change(f.key, p);
              } catch (cause: any) {
                setError(cause.message);
              } finally {
                unlock();
              }
            }}
          >
            {t('浏览')}
          </button>
        </div>
      ) : (
        <input
          aria-label={f.label}
          type={f.type || 'text'}
          required={f.required}
          min={f.type === 'number' ? 0 : undefined}
          step={f.type === 'number' ? 'any' : undefined}
          value={form[f.key] ?? ''}
          onChange={(e) =>
            draft.change(
              f.key,
              f.type === 'number' && e.target.value !== ''
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </label>
  );
  const basic = fields.filter((f) => !f.advanced || f.required);
  const advanced = fields.filter((f) => f.advanced && !f.required);
  return (
    <Modal title={title} onClose={close}>
      <form
        ref={element}
        onSubmit={submit}
        className="entity-form"
        aria-busy={busy || !draft.ready}
      >
        {draftKey && (
          <p className="draft-status" role="status">
            {!draft.ready
              ? t('正在读取草稿…', 'Loading draft…')
              : draft.status === 'saving'
                ? t('正在保存草稿…', 'Saving draft…')
                : draft.status === 'error'
                  ? t('草稿暂未保存，请重试。', 'Draft not saved. Please retry.')
                  : draft.restored
                    ? t('已恢复未保存的草稿', 'Unsaved draft restored')
                    : draft.status === 'saved'
                      ? t('草稿已保存在本机', 'Draft saved on this device')
                      : t('输入内容会自动保存为本地草稿', 'Your writing is saved as a local draft')}
          </p>
        )}
        <fieldset disabled={busy || !draft.ready} className="entity-fields">
          {basic.map(field)}
          {advanced.length > 0 && (
            <details className="entity-advanced">
              <summary>{t('更多选项', 'More options')}</summary>
              {advanced.map(field)}
            </details>
          )}
        </fieldset>
        {(error || draft.error) && (
          <p className="error" role="alert">
            {error || draft.error}
          </p>
        )}
        {confirmClose && (
          <div className="unsaved-confirm" role="alert">
            <p>
              {t('有未保存的修改。要放弃这些修改吗？', 'You have unsaved changes. Discard them?')}
            </p>
            <button type="button" disabled={busy} onClick={() => setConfirmClose(false)}>
              {t('继续编辑', 'Keep editing')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="danger"
              onClick={() => {
                if (!busyRef.current) onClose();
              }}
            >
              {t('放弃修改', 'Discard changes')}
            </button>
          </div>
        )}
        <footer className="modal-actions">
          {onDelete && (
            <button
              type="button"
              className="danger"
              disabled={busy || !draft.ready}
              onClick={async () => {
                if (!confirm) {
                  setConfirm(true);
                  return;
                }
                if (!lock()) return;
                try {
                  await onDelete();
                  await draft.clear();
                  onClose();
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  unlock();
                }
              }}
            >
              {confirm ? t('确认删除', 'Confirm deletion') : t('删除', 'Delete')}
            </button>
          )}
          {draftKey && draft.ready && (draft.dirty || draft.restored) && (
            <button
              type="button"
              className="discard-draft"
              disabled={busy}
              onClick={async () => {
                if (!lock()) return;
                try {
                  await draft.discard();
                  onClose();
                } catch (cause: any) {
                  setError(cause.message);
                } finally {
                  unlock();
                }
              }}
            >
              {t('丢弃草稿', 'Discard draft')}
            </button>
          )}
          <button type="button" disabled={busy} onClick={close}>
            {t('取消')}
          </button>
          <button className="primary" disabled={busy || !draft.ready} type="submit">
            {busy ? t('保存中…', 'Saving…') : t('保存')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
