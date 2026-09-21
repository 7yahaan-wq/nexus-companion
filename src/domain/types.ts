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
}
export interface AgentProvider {
  id: string;
  capabilities: { stop: boolean; retry: boolean; live: boolean };
  list(): Promise<AgentRun[]>;
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
