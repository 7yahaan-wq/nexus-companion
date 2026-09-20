import { Component, type ReactNode } from 'react';
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error) {
    window.nexus?.call('clientError', error.stack || error.message);
  }
  render() {
    return this.state.error ? (
      <div style={{ padding: 60, color: '#e9eaf3', background: '#10131b', minHeight: '100vh' }}>
        <h1>界面遇到了一点问题</h1>
        <p>你的数据仍保存在本地。可以重新加载界面，或打开日志排查。</p>
        <pre>{this.state.error}</pre>
        <button onClick={() => window.location.reload()}>重新加载</button>
        <button onClick={() => window.nexus?.call('openLogs')}>打开日志</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
