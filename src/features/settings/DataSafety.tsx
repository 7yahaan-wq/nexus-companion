import { L } from '../../domain/i18n';
import { useState } from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { api } from '../../domain/api';
import Modal from '../../components/Modal';
export default function DataSafety({ setError }: { setError: (s: string) => void }) {
  const [preview, setPreview] = useState<any>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-wide">
      <h2>
        <ShieldCheck size={17} />
        数据与恢复 <span>LOCAL BACKUP</span>
      </h2>
      <p>备份包含任务、项目、日程、笔记、专注记录、设置和自定义图片；只写入你选择的本地文件。</p>
      <div className="toolbar wrap">
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (await api('backupExport')) setMessage('备份已导出，并附有 SHA-256 校验。');
            })
          }
        >
          <Download size={15} />
          导出本地备份
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => run(async () => setPreview(await api('backupPreview')))}
        >
          <Upload size={15} />
          导入备份
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await api('integrity');
              setMessage(r.quick_check === 'ok' ? 'SQLite 完整性检查通过。' : JSON.stringify(r));
            })
          }
        >
          检查数据库
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {preview && (
        <Modal title="恢复备份" onClose={() => setPreview(null)}>
          <p>
            备份日期：{new Date(preview.createdAt).toLocaleString()}
            <br />
            包含 {preview.count} 条记录，校验已通过。
          </p>
          <p>相同 ID 的记录会被此备份覆盖，其他记录保留。恢复前会自动保存当前数据的本地备份。</p>
          <footer className="modal-actions">
            <button onClick={() => setPreview(null)}>
              <L text="取消" />
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api('backupRestore', preview.sha256);
                  window.location.reload();
                })
              }
            >
              确认恢复
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}
