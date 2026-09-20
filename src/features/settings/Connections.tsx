import { L } from '../../domain/i18n';
import { useEffect, useState } from 'react';
import { api } from '../../domain/api';
export default function Connections({ setError }: { setError: (s: string) => void }) {
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try {
      setState(await api('connectionInfo'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function configure(mode: string) {
    setBusy(true);
    try {
      await api('configureConnection', mode);
      window.dispatchEvent(new Event('nexus-connection-changed'));
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-wide connection-settings">
      <h2>
        <L text="Codex 连接" />
        <span>
          <L text="本地记录 · 只读" />
        </span>
      </h2>
      <p>
        Nexus 自动查找此电脑的 Codex 会话目录，每 15 秒读取记录。它没有登录你的 OpenAI
        账号，也不会读取登录凭据或消耗 API 额度。
      </p>
      <p>
        登录请在官方 Codex 应用中完成，或在终端运行 <code>codex login</code>。本地记录读取无需在
        Nexus 再次登录；本版尚不支持直接发送、停止或重试 Codex 任务。
      </p>
      <div className="path-text">{state?.root || '正在检测…'}</div>
      {state && (
        <p role="status">
          {state.enabled
            ? state.availability === 'LOCAL_ONLY'
              ? `已检测到 ${state.count} 个会话`
              : '未检测到可读取会话，请检查目录或先在 Codex 中开始任务'
            : '已暂停读取'}{' '}
          · {state.scannedAt ? new Date(state.scannedAt).toLocaleTimeString() : ''}
        </p>
      )}
      <div className="toolbar wrap">
        <button disabled={busy} onClick={refresh}>
          <L text="重新检测" />
        </button>
        <button disabled={busy} onClick={() => configure('choose')}>
          <L text="选择 Codex 目录" />
        </button>
        <button disabled={busy} onClick={() => configure('default')}>
          <L text="恢复自动检测" />
        </button>
        <button disabled={busy} onClick={() => configure(state?.enabled ? 'disable' : 'enable')}>
          {state?.enabled ? '暂停读取' : '启用读取'}
        </button>
        <button
          onClick={() =>
            api('openUrl', 'https://developers.openai.com/codex/auth').catch((e) =>
              setError(e.message),
            )
          }
        >
          <L text="官方登录说明 ↗" />
        </button>
      </div>
      <p>选择包含 sessions 文件夹的 Codex 数据目录。暂停仅停止后续读取，已导入的时间线仍保留。</p>
    </section>
  );
}
