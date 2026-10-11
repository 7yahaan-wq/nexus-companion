import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../domain/api';
import { useI18n } from '../../domain/i18n';
import type {
  AccountQuota,
  AgentRun,
  CodexQuotaResult,
  CodexTaskUsageResult,
  QuotaWindow,
  TokenUsage,
} from '../../domain/types';

function number(value: number | null | undefined, language: string, digits = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', {
        maximumFractionDigits: digits,
      })
    : '—';
}

function ObservedTime({ value }: { value: string | null | undefined }) {
  const { language, t } = useI18n();
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? (
    <time dateTime={value!}>{date.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN')}</time>
  ) : (
    <>{t('时间未记录', 'Time not recorded')}</>
  );
}

function QueryReason({ reason }: { reason: string | null }) {
  const { t } = useI18n();
  if (reason === 'NO_TASK_USAGE')
    return (
      <>
        {t(
          '官方尚未提供此会话的用量估算，可稍后重试。',
          'An official usage estimate is not yet available for this session. Please try again later.',
        )}
      </>
    );
  if (reason === 'CHATGPT_REQUIRED')
    return (
      <>
        {t(
          '请先在 Codex 中登录 ChatGPT 账号，再查询套餐用量。',
          'Sign in to Codex with a ChatGPT account to check plan usage.',
        )}
      </>
    );
  if (reason === 'CLI_UNAVAILABLE')
    return (
      <>
        {t(
          '未找到本机 Codex CLI。安装并登录后可查询。',
          'The local Codex CLI was not found. Install it and sign in to query usage.',
        )}
      </>
    );
  if (reason === 'UNSUPPORTED')
    return (
      <>
        {t(
          '当前 Codex CLI 或账号尚未提供此查询。可更新 Codex 后重试。',
          'This Codex CLI or account does not support this query yet. Try again after updating Codex.',
        )}
      </>
    );
  return (
    <>
      {t(
        '查询暂不可用，请稍后重试。',
        'The query is temporarily unavailable. Please try again later.',
      )}
    </>
  );
}

export function TokenSummary({ run }: { run: AgentRun }) {
  const { language, t } = useI18n();
  return (
    <div className="agent-token-summary" data-testid="agent-token-summary">
      <span>{t('会话累计', 'Session total')}</span>
      <strong>{number(run.usage?.total?.totalTokens, language)}</strong>
      <span>tokens</span>
    </div>
  );
}

function WindowQuota({ window, name }: { window: QuotaWindow; name: string }) {
  const { language, t } = useI18n();
  const remaining = Number.isFinite(window.usedPercent)
    ? Math.max(0, Math.min(100, 100 - window.usedPercent))
    : null;
  const reset = window.resetsAt ? Date.parse(window.resetsAt) : NaN;
  const expired = Number.isFinite(reset) && reset <= Date.now();
  const minutes = window.windowMinutes;
  const windowLabel =
    minutes === null || !Number.isFinite(minutes)
      ? name
      : minutes % 1440 === 0
        ? `${number(minutes / 1440, language)} ${t('天窗口', 'day window')}`
        : minutes % 60 === 0
          ? `${number(minutes / 60, language)} ${t('小时窗口', 'hour window')}`
          : `${number(minutes, language)} ${t('分钟窗口', 'minute window')}`;
  return (
    <div className={'quota-window' + (expired ? ' expired' : '')} data-testid="quota-window">
      <span className="quota-window-name">{windowLabel}</span>
      <div className="quota-remaining">
        <strong>
          {expired
            ? t('待更新', 'Needs refresh')
            : `${number(remaining, language, 1)}${remaining === null ? '' : '%'}`}
        </strong>
        <span>
          {expired
            ? t('窗口已过重置时间', 'Reset time has passed')
            : t('观测时剩余', 'Remaining when observed')}
        </span>
      </div>
      {!expired && remaining !== null && (
        <progress
          max={100}
          value={remaining}
          aria-label={`${windowLabel} · ${t('观测时剩余', 'Remaining when observed')}`}
        />
      )}
      {expired && (
        <p>
          {t('上次记录剩余', 'Last recorded remaining')} {number(remaining, language, 1)}%
        </p>
      )}
      <p>
        {t('重置时间', 'Reset time')} · <ObservedTime value={window.resetsAt} />
      </p>
    </div>
  );
}

export function AccountQuotaPanel({
  snapshot,
  result,
  pending,
  error,
  onQuery,
}: {
  snapshot: AccountQuota | null;
  result: CodexQuotaResult | null;
  pending: boolean;
  error: string | null;
  onQuery: () => Promise<void>;
}) {
  const { t } = useI18n();
  const quota = result?.quota ?? snapshot;
  return (
    <section
      className="account-quota"
      data-testid="account-quota"
      aria-label={t('账号套餐额度', 'Account plan quota')}
    >
      <div className="usage-section-heading">
        <div>
          <h3>{t('账号套餐额度', 'Account plan quota')}</h3>
          <p>
            {t(
              '账号共享额度，与单个会话的 tokens 分开统计。',
              'Shared account quota, separate from each session’s token usage.',
            )}
          </p>
        </div>
        <button onClick={onQuery} disabled={pending} aria-busy={pending}>
          <RefreshCw size={14} />
          {pending
            ? t('正在查询…', 'Checking…')
            : t('查询当前套餐额度', 'Check current plan quota')}
        </button>
      </div>
      {error && (
        <p className="usage-error" role="alert">
          <QueryReason reason={error} />
        </p>
      )}
      {error && quota && (
        <p className="usage-note">
          {t('下面保留先前观测的快照。', 'The previously observed snapshot is retained below.')}
        </p>
      )}
      {quota && quota.buckets.length ? (
        <>
          <div className="quota-buckets">
            {quota.buckets.map((bucket, index) => (
              <div className="quota-bucket" key={`${bucket.limitId ?? 'quota'}-${index}`}>
                <div className="quota-bucket-heading">
                  <strong>{bucket.limitName || bucket.limitId || 'Codex'}</strong>
                  {bucket.planType && <span>{bucket.planType}</span>}
                </div>
                <div className="quota-windows">
                  {bucket.primary && (
                    <WindowQuota window={bucket.primary} name={t('主要窗口', 'Primary window')} />
                  )}
                  {bucket.secondary && (
                    <WindowQuota
                      window={bucket.secondary}
                      name={t('次要窗口', 'Secondary window')}
                    />
                  )}
                  {!bucket.primary && !bucket.secondary && (
                    <p className="usage-note">
                      {t('没有可用的订阅窗口记录。', 'No subscription window was reported.')}
                    </p>
                  )}
                </div>
                {bucket.credits && (
                  <p className="quota-credits">
                    {t('额外 Credits', 'Additional credits')} ·{' '}
                    {bucket.credits.unlimited === true
                      ? t('不限量', 'Unlimited')
                      : bucket.credits.hasCredits === true && bucket.credits.balance !== null
                        ? bucket.credits.balance
                        : bucket.credits.hasCredits === false
                          ? t('未启用', 'Not enabled')
                          : t('余额未提供', 'Balance not provided')}
                  </p>
                )}
                <p className="usage-note">
                  {bucket.source === 'app-server'
                    ? t('官方 Codex 查询', 'Official Codex query')
                    : t('本地会话快照', 'Local session snapshot')}
                  {' · '}
                  {t('观测于', 'Observed')}{' '}
                  <ObservedTime value={bucket.observedAt ?? quota.observedAt} />
                </p>
              </div>
            ))}
          </div>
          <p className="usage-note">
            {result?.accountLabel
              ? `${t('查询账号', 'Queried account')} · ${result.accountLabel}`
              : quota.source === 'session-log'
                ? t(
                    '本地记录可能来自不同账号；查询当前套餐可确认当前 CLI 账号的额度。',
                    'Local records may come from different accounts. Check the current plan to retrieve the current CLI account’s quota.',
                  )
                : t('当前 CLI 账号的查询结果。', 'Query result for the current CLI account.')}{' '}
            {t(
              '快照不会自动推算重置后的剩余额度。',
              'Snapshots do not estimate quota after a reset.',
            )}
          </p>
        </>
      ) : (
        <p className="usage-note quota-empty">
          {t(
            '暂无套餐额度记录。点击上方按钮，通过本机 Codex 查询当前账号。',
            'No plan quota has been recorded. Use the button above to query the current account through local Codex.',
          )}
        </p>
      )}
    </section>
  );
}

const tokenRows: { key: keyof TokenUsage; zh: string; en: string }[] = [
  { key: 'inputTokens', zh: '输入', en: 'Input' },
  { key: 'cachedInputTokens', zh: '其中：缓存输入', en: 'Of which: cached input' },
  { key: 'cacheWriteInputTokens', zh: '缓存写入', en: 'Cache write input' },
  { key: 'outputTokens', zh: '输出', en: 'Output' },
  { key: 'reasoningOutputTokens', zh: '其中：推理输出', en: 'Of which: reasoning output' },
  { key: 'totalTokens', zh: '总计', en: 'Total' },
];

export function UsageDetail({ run }: { run: AgentRun }) {
  const { language, t } = useI18n();
  const usage = run.usage;
  return (
    <section className="agent-usage-detail" data-testid="agent-usage-detail">
      <div className="usage-section-heading">
        <h3>{t('会话 token 用量', 'Session token usage')}</h3>
        {usage?.model && <span className="usage-model">{usage.model}</span>}
      </div>
      {usage ? (
        <>
          <div className="usage-table-scroll">
            <table className="usage-table">
              <thead>
                <tr>
                  <th scope="col">tokens</th>
                  <th scope="col">{t('会话累计', 'Session total')}</th>
                  <th scope="col">{t('最近请求', 'Latest request')}</th>
                </tr>
              </thead>
              <tbody>
                {tokenRows.map((row) => (
                  <tr key={row.key} data-token-field={row.key}>
                    <th scope="row">{t(row.zh, row.en)}</th>
                    <td>{number(usage.total?.[row.key], language)}</td>
                    <td>{number(usage.lastRequest?.[row.key], language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="usage-note">
            {t(
              '累计值取自最近的用量记录；最近请求不是整轮任务。缓存与推理为细分项，不与输入 / 输出重复相加。— 表示未提供。',
              'Totals come from the latest usage record. The latest request is not the whole turn. Cache and reasoning fields are breakdowns, not extra tokens to add to input or output. — means not provided.',
            )}
          </p>
          {usage.forkedFromSession && (
            <p className="usage-note">
              {t(
                '此会话由其他会话分叉；这里使用 Codex 当前会话报告的计数，不与来源会话相加。',
                'This session was forked from another session. These are the counts Codex reports for the current session; they are not added to the source session’s counts.',
              )}
            </p>
          )}
          {usage.coverage === 'tail' && (
            <p className="usage-note">
              {t(
                '仅解析了文件末尾记录；未读取的历史不会被当作零。',
                'Only the end of the file was read; omitted history is not treated as zero.',
              )}
            </p>
          )}
          <p className="usage-note">
            {t('观测于', 'Observed')} <ObservedTime value={usage.observedAt} />
            {usage.modelContextWindow !== null && (
              <>
                {' '}
                · {t('模型上下文窗口', 'Model context window')}{' '}
                {number(usage.modelContextWindow, language)} tokens
              </>
            )}
          </p>
        </>
      ) : (
        <p className="usage-note">
          {t(
            '此会话没有可用的 token 用量记录，不能推断为零。',
            'This session has no token usage record; its usage cannot be assumed to be zero.',
          )}
        </p>
      )}
      <TaskCredits key={run.id} threadId={run.id} />
    </section>
  );
}

function TaskCredits({ threadId }: { threadId: string }) {
  const { language, t } = useI18n();
  const [result, setResult] = useState<CodexTaskUsageResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0),
    busy = useRef(false);
  useEffect(
    () => () => {
      ++request.current;
      busy.current = false;
    },
    [],
  );
  async function query() {
    if (busy.current) return;
    busy.current = true;
    const id = ++request.current;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const next = await api<CodexTaskUsageResult>('codexTaskUsage', threadId);
      if (id !== request.current) return;
      if (next.threadUsage && next.threadUsage.threadId !== threadId) {
        setError('INVALID_RESPONSE');
      } else setResult(next);
    } catch {
      if (id === request.current) setError('QUERY_FAILED');
    } finally {
      if (id === request.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  const usage = result?.status === 'AVAILABLE' ? result.threadUsage : null;
  return (
    <div className="task-credit-usage" data-testid="task-credit-usage">
      <div className="usage-section-heading">
        <div>
          <h3>{t('官方任务用量估算', 'Official task usage estimate')}</h3>
          <p>
            {t(
              '按当前会话 ID 查询官方估算 Credits，不代表订阅额度扣减的百分点。',
              'Look up official estimated credits for this session ID. Credits are not percentage points deducted from your subscription quota.',
            )}
          </p>
        </div>
        <button onClick={query} disabled={pending} aria-busy={pending}>
          <RefreshCw size={14} />
          {pending ? t('正在查询…', 'Checking…') : t('查询此任务额度', 'Check this task usage')}
        </button>
      </div>
      {error && (
        <p className="usage-error" role="alert">
          <QueryReason reason={error} />
        </p>
      )}
      {result && !usage && (
        <p className="usage-note" role="status">
          <QueryReason reason={result.reason} />
        </p>
      )}
      {usage && (
        <>
          <div className="task-credit-total">
            <span>{t('官方估算', 'Official estimate')}</span>
            <strong>{number(usage.estimatedCredits, language, 6)}</strong>
            <span>Credits</span>
          </div>
          {usage.groups.length > 0 && (
            <div className="usage-table-scroll">
              <table className="usage-table task-credit-table">
                <thead>
                  <tr>
                    <th scope="col">{t('模型 / 模式', 'Model / mode')}</th>
                    <th scope="col">{t('输入', 'Input')}</th>
                    <th scope="col">{t('其中缓存', 'Cached input')}</th>
                    <th scope="col">{t('输出', 'Output')}</th>
                    <th scope="col">{t('总 tokens', 'Total tokens')}</th>
                    <th scope="col">{t('估算 Credits', 'Estimated credits')}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.groups.map((group, index) => (
                    <tr key={index}>
                      <th scope="row">
                        {group.model || t('模型未提供', 'Model not provided')}
                        {(group.speed || group.reasoningEffort) && (
                          <small>
                            {[group.speed, group.reasoningEffort].filter(Boolean).join(' · ')}
                          </small>
                        )}
                      </th>
                      <td>{number(group.inputTokens, language)}</td>
                      <td>{number(group.cachedInputTokens, language)}</td>
                      <td>{number(group.outputTokens, language)}</td>
                      <td>{number(group.totalTokens, language)}</td>
                      <td>{number(group.estimatedCredits, language, 6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="usage-note">
            {result?.accountLabel && (
              <>
                {t('查询账号', 'Queried account')} · {result.accountLabel} ·{' '}
              </>
            )}
            {t('观测于', 'Observed')} <ObservedTime value={usage.observedAt} />
          </p>
        </>
      )}
    </div>
  );
}
