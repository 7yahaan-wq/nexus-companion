import { useI18n } from '../../domain/i18n';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../domain/api';

interface ConnectionInfo {
  enabled: boolean;
  root: string | null;
  availability: string;
  count: number;
  scannedAt: string | null;
}

export default function Connections({
  setError,
  focusRevision,
}: {
  setError: (s: string) => void;
  focusRevision?: number;
}) {
  const { language, t } = useI18n();
  const [state, setState] = useState<ConnectionInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setLocalError] = useState('');
  const section = useRef<HTMLElement>(null);
  const request = useRef(0),
    operationBusy = useRef(false);
  async function operate(mode?: string) {
    if (operationBusy.current) return;
    operationBusy.current = true;
    const id = ++request.current;
    setBusy(true);
    setLocalError('');
    try {
      if (mode) {
        const changed = await api<boolean>('configureConnection', mode);
        if (!changed) return;
        // Notify the existing local-reader hook; settings navigation uses props.
        window.dispatchEvent(new Event('nexus-connection-changed'));
      }
      const next = await api<ConnectionInfo>('connectionInfo');
      if (id === request.current) setState(next);
    } catch (cause) {
      if (id === request.current)
        setLocalError(
          cause instanceof Error
            ? cause.message
            : t(
                '无法读取连接信息，请重试。',
                'Connection information could not be read. Please retry.',
              ),
        );
    } finally {
      if (id === request.current) {
        operationBusy.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    operate();
    return () => {
      ++request.current;
      operationBusy.current = false;
    };
  }, []);
  useEffect(() => {
    if (focusRevision === undefined) return;
    const frame = requestAnimationFrame(() => {
      section.current?.focus({ preventScroll: true });
      section.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRevision]);
  const scanned = state?.scannedAt ? new Date(state.scannedAt) : null;
  return (
    <section
      ref={section}
      tabIndex={-1}
      id="codex-connections"
      aria-labelledby="codex-connections-heading"
      data-testid="codex-connection-settings"
      className="panel settings-wide connection-settings"
    >
      <h2 id="codex-connections-heading">
        {t('Codex 连接', 'Codex connection')}
        <span>{t('本地记录 · 只读', 'Local records · read only')}</span>
      </h2>
      <p>
        {t(
          '每 15 秒读取所选目录中的本地会话记录，不会自动登录、发送提示或执行 Codex 任务。停止、重试和实时审批尚不支持。',
          'Reads local session records in the selected directory every 15 seconds. It does not sign in automatically, send prompts or run Codex tasks. Stop, retry and live approvals are not supported.',
        )}
      </p>
      <p>
        {t(
          '只有在 Agent 工作台手动点击额度查询，才会通过本机 Codex CLI 的当前账号读取官方用量。CLI 可能联网并刷新自身登录；Nexus 不读取或保存登录凭据。',
          'Only a manual usage-query click on the Agents page asks the local Codex CLI for official usage using its current account. The CLI may contact the service and refresh its own login; Nexus does not read or store credentials.',
        )}
      </p>
      <div className="connection-status-meta">
        <span>{t('读取目录', 'Session directory')}</span>
        <div className="path-text" data-testid="connection-root">
          {state?.root || t('正在检测…', 'Detecting…')}
        </div>
        <span>
          {t('最近扫描', 'Last scan')} ·{' '}
          {scanned && Number.isFinite(scanned.getTime()) ? (
            <time dateTime={state?.scannedAt || undefined}>
              {scanned.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN')}
            </time>
          ) : (
            t('尚未扫描', 'Not scanned yet')
          )}
        </span>
      </div>
      {state && (
        <p role="status">
          {!state.enabled
            ? t('已暂停读取', 'Reading is paused')
            : state.availability !== 'LOCAL_ONLY'
              ? t(
                  '当前目录不可读取，请检查路径和访问权限。',
                  'The current directory cannot be read. Check its path and access permissions.',
                )
              : state.count === 0
                ? t(
                    '目录可读取，尚未发现本地会话。',
                    'The directory is readable, but no local sessions were found.',
                  )
                : t(`已检测到 ${state.count} 个会话`, `${state.count} sessions found`)}
        </p>
      )}
      {error && (
        <p className="usage-error" role="alert">
          {t('连接操作未完成', 'Connection action could not be completed')} · {error}
        </p>
      )}
      <div className="toolbar wrap" aria-busy={busy}>
        <button disabled={busy} onClick={() => operate()}>
          {t('重新检测', 'Scan again')}
        </button>
        <button disabled={busy} onClick={() => operate('choose')}>
          {t('选择 Codex 目录', 'Choose Codex directory')}
        </button>
        <button disabled={busy} onClick={() => operate('default')}>
          {t('恢复自动检测', 'Restore automatic detection')}
        </button>
        <button
          disabled={busy || !state}
          onClick={() => operate(state?.enabled ? 'disable' : 'enable')}
        >
          {state?.enabled ? t('暂停读取', 'Pause reading') : t('启用读取', 'Enable reading')}
        </button>
        <button
          onClick={() =>
            api('openUrl', 'https://developers.openai.com/codex/auth').catch((cause) =>
              setError(cause.message),
            )
          }
        >
          {t('官方登录说明 ↗', 'Official sign-in guide ↗')}
        </button>
      </div>
      <p>
        {t(
          '选择包含 sessions 文件夹的 Codex 数据目录。暂停只停止后续读取，已有时间线保留。本地查看不需要在 Nexus 登录；如需账号登录，请在官方 Codex 中完成。',
          'Choose a Codex data directory containing a sessions folder. Pausing stops future reads and keeps existing timeline entries. Viewing local records needs no Nexus sign-in; sign in through official Codex when needed.',
        )}
      </p>
    </section>
  );
}
