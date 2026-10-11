export type Entity = { id: string; [key: string]: any };
export type AgentStatus =
  | 'IDLE'
  | 'STARTING'
  | 'RUNNING'
  | 'WAITING'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNAVAILABLE';
export interface TokenUsage {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteInputTokens: number | null;
  outputTokens: number | null;
  reasoningOutputTokens: number | null;
  totalTokens: number | null;
}
export interface AgentUsage {
  total: TokenUsage | null;
  lastRequest: TokenUsage | null;
  observedAt: string | null;
  model: string | null;
  modelContextWindow: number | null;
  forkedFromSession: boolean;
  coverage: 'full' | 'tail';
}
export interface QuotaWindow {
  usedPercent: number;
  windowMinutes: number | null;
  resetsAt: string | null;
}
export interface QuotaBucket {
  limitId: string | null;
  limitName: string | null;
  primary: QuotaWindow | null;
  secondary: QuotaWindow | null;
  credits: {
    hasCredits: boolean | null;
    unlimited: boolean | null;
    balance: string | null;
  } | null;
  planType: string | null;
  observedAt: string | null;
  source: 'session-log' | 'app-server';
}
export interface AccountQuota {
  buckets: QuotaBucket[];
  observedAt: string | null;
  source: 'session-log' | 'app-server';
}
export type CodexQueryReason =
  | 'CHATGPT_REQUIRED'
  | 'CLI_UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'QUERY_FAILED'
  | 'INVALID_REQUEST'
  | 'NO_TASK_USAGE';
export interface CodexQuotaResult {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  accountLabel: string | null;
  quota: AccountQuota | null;
  reason: CodexQueryReason | null;
}
export interface CodexTaskUsageResult {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  accountLabel: string | null;
  reason: CodexQueryReason | null;
  threadUsage: {
    threadId: string;
    estimatedCredits: number;
    observedAt: string;
    groups: {
      model: string | null;
      speed: string | null;
      reasoningEffort: string | null;
      inputTokens: number | null;
      cachedInputTokens: number | null;
      outputTokens: number | null;
      totalTokens: number | null;
      estimatedCredits: number;
    }[];
  } | null;
}
export interface AgentRun extends Entity {
  agentName: string;
  agentType: string;
  project: string;
  taskName: string;
  taskId: string;
  status: AgentStatus;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  progress: number | null;
  currentStep: string;
  lastMessage: string;
  workingDirectory: string;
  changedFiles: string[];
  logs: string[];
  error: string | null;
  provider: string;
  observedAt: string;
  usage: AgentUsage | null;
  accountQuota: AccountQuota | null;
}
export interface AgentProvider {
  id: string;
  capabilities: { stop: boolean; retry: boolean; live: boolean };
  list(): Promise<AgentRun[]>;
}
export interface AgentsSnapshot {
  runs: AgentRun[];
  availability: string;
  message: string;
  capabilities: AgentProvider['capabilities'];
  accountQuota: AccountQuota | null;
  root?: string;
  scannedAt?: string;
}
export interface CalendarProvider {
  list(): Promise<Entity[]>;
  save(event: Entity): Promise<Entity>;
  remove(id: string): Promise<void>;
}
export type AvatarState =
  'idle' | 'working' | 'thinking' | 'happy' | 'warning' | 'error' | 'sleepy' | 'celebrate';
export interface AvatarPack {
  id: string;
  name: string;
  states: Record<AvatarState, string>;
}
export interface WidgetDefinition {
  id: string;
  title: string;
  order: number;
  visible: boolean;
}
declare global {
  interface Window {
    nexus: {
      call: (method: string, ...args: any[]) => Promise<{ ok: boolean; data: any; error?: string }>;
      onCommand: (callback: (value: string) => void) => () => void;
      onVisibility: (callback: (visible: boolean) => void) => () => void;
    };
  }
}
