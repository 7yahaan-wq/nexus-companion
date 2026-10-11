// These are observations reported by Codex, not a bill or a per-task quota debit.
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const tokenNumber = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
const text = (value) =>
  typeof value === 'string' && value.trim() && value.length <= 160 && !/[\u0000-\u001f]/.test(value)
    ? value.trim()
    : null;

function observedTime(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (
    typeof value === 'string' &&
    !/^\d+(\.\d+)?$/.test(value) &&
    !/^\d{4}-\d{2}-\d{2}T/.test(value)
  )
    return null;
  const numeric = typeof value === 'number' || /^\d+(\.\d+)?$/.test(value) ? Number(value) : null;
  if (numeric !== null && (!Number.isFinite(numeric) || numeric < 0)) return null;
  const date = new Date(numeric === null ? value : numeric < 1e11 ? numeric * 1000 : numeric);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeTokens(raw) {
  if (!isObject(raw)) return null;
  const result = {};
  for (const [field, camel] of [
    ['input_tokens', 'inputTokens'],
    ['cached_input_tokens', 'cachedInputTokens'],
    ['cache_write_input_tokens', 'cacheWriteInputTokens'],
    ['output_tokens', 'outputTokens'],
    ['reasoning_output_tokens', 'reasoningOutputTokens'],
    ['total_tokens', 'totalTokens'],
  ])
    result[camel] = tokenNumber(raw[field] ?? raw[camel]);
  return Object.values(result).some((value) => value !== null) ? result : null;
}

function normalizeWindow(raw) {
  if (!isObject(raw)) return null;
  const usedPercent = raw.used_percent ?? raw.usedPercent;
  if (typeof usedPercent !== 'number' || !Number.isFinite(usedPercent) || usedPercent < 0)
    return null;
  const duration =
    raw.window_minutes ?? raw.window_duration_mins ?? raw.windowMinutes ?? raw.windowDurationMins;
  return {
    usedPercent,
    windowMinutes: tokenNumber(duration) > 0 ? duration : null,
    resetsAt: observedTime(raw.resets_at ?? raw.resetsAt),
  };
}

function normalizeCredits(raw) {
  if (!isObject(raw)) return null;
  const hasCredits = raw.has_credits ?? raw.hasCredits;
  const result = {
    hasCredits: typeof hasCredits === 'boolean' ? hasCredits : null,
    unlimited: typeof raw.unlimited === 'boolean' ? raw.unlimited : null,
    // Keep the reported decimal string. Its unit is not assumed to be dollars.
    balance:
      typeof raw.balance === 'string' &&
      raw.balance.length <= 80 &&
      /^-?\d+(\.\d+)?$/.test(raw.balance)
        ? raw.balance
        : null,
  };
  return Object.values(result).some((value) => value !== null) ? result : null;
}

function quotaBucket(raw, observedAt, source, fallbackId) {
  if (!isObject(raw)) return null;
  const primary = normalizeWindow(raw.primary);
  const secondary = normalizeWindow(raw.secondary);
  const credits = normalizeCredits(raw.credits);
  if (!primary && !secondary && !credits) return null;
  return {
    limitId: text(raw.limit_id ?? raw.limitId) || text(fallbackId) || 'codex',
    limitName: text(raw.limit_name ?? raw.limitName),
    primary,
    secondary,
    credits,
    planType: text(raw.plan_type ?? raw.planType),
    observedAt,
    source,
  };
}

function mergeQuotaSnapshots(snapshots) {
  const byId = new Map();
  for (const snapshot of snapshots) {
    for (const bucket of snapshot?.buckets || []) {
      const existing = byId.get(bucket.limitId);
      if (!existing || bucket.observedAt >= existing.observedAt) byId.set(bucket.limitId, bucket);
    }
  }
  if (!byId.size) return null;
  const buckets = [...byId.values()].sort((a, b) => a.limitId.localeCompare(b.limitId));
  const newest = buckets.reduce((a, b) => (a.observedAt >= b.observedAt ? a : b));
  return { buckets, observedAt: newest.observedAt, source: newest.source };
}

function normalizeQuota(raw, observedAt, source = 'session-log') {
  const time = observedTime(observedAt);
  if (!isObject(raw) || !time || !['session-log', 'app-server'].includes(source)) return null;
  const buckets = [];
  const single = quotaBucket(raw.rate_limits ?? raw.rateLimits ?? raw, time, source);
  if (single) buckets.push(single);
  const keyed = raw.rate_limits_by_limit_id ?? raw.rateLimitsByLimitId;
  if (isObject(keyed)) {
    // The keyed API view is authoritative when the legacy view names the same bucket.
    for (const [id, value] of Object.entries(keyed)) {
      const bucket = quotaBucket(value, time, source, id);
      if (bucket) buckets.push(bucket);
    }
  }
  return mergeQuotaSnapshots([{ buckets }]);
}

function parseUsage(records, { forkedFromSession = false, coverage = 'full' } = {}) {
  let usage = null;
  let model = null;
  let modelContextWindow = null;
  const quotas = [];
  for (const record of records) {
    if (!isObject(record)) continue;
    const payload = isObject(record.payload) ? record.payload : {};
    if (record.type === 'turn_context') {
      model = text(payload.model);
      continue;
    }
    if (record.type !== 'event_msg' || payload.type !== 'token_count') continue;
    const time = observedTime(record.timestamp) || observedTime(payload.timestamp);
    const accountQuota = normalizeQuota(payload.rate_limits ?? payload.rateLimits, time);
    if (accountQuota) quotas.push(accountQuota);
    const info = isObject(payload.info) ? payload.info : {};
    const total = normalizeTokens(info.total_token_usage ?? info.totalTokenUsage);
    const lastRequest = normalizeTokens(info.last_token_usage ?? info.lastTokenUsage);
    if (!total && !lastRequest) continue;
    const context = tokenNumber(info.model_context_window ?? info.modelContextWindow);
    if (context !== null && context > 0) modelContextWindow = context;
    const next = {
      total: total || usage?.total || null,
      lastRequest: lastRequest || usage?.lastRequest || null,
    };
    // Quota-only notifications may repeat the exact same token information.
    // Replace counters, never sum them; lastRequest is not the current turn total.
    const changed =
      !usage ||
      JSON.stringify(next.total) !== JSON.stringify(usage.total) ||
      JSON.stringify(next.lastRequest) !== JSON.stringify(usage.lastRequest);
    usage = {
      ...next,
      observedAt: changed ? time : usage.observedAt || time,
      model,
      modelContextWindow,
      forkedFromSession,
      coverage,
    };
  }
  return { usage, accountQuota: mergeQuotaSnapshots(quotas) };
}

module.exports = { normalizeTokens, normalizeQuota, mergeQuotaSnapshots, parseUsage };
