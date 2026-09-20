import type { Entity, CalendarProvider } from './types';
export async function api<T = any>(method: string, ...args: any[]): Promise<T> {
  if (!window.nexus) throw Error('请使用桌面应用打开。浏览器预览不连接本地数据。');
  const r = await window.nexus.call(method, ...args);
  if (!r.ok) throw Error(r.error || '操作失败');
  return r.data;
}
export const localCalendar: CalendarProvider = {
  list: () => api('list', 'events'),
  save: (e: Entity) => api('save', 'events', e),
  remove: async (id: string) => {
    await api('delete', 'events', id);
  },
};
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toLocaleDateString('sv-SE');
