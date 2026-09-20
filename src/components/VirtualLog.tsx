import { useState } from 'react';
export default function VirtualLog({ logs }: { logs: string[] }) {
  const [scroll, setScroll] = useState(0);
  const lines = logs.flatMap((l) => l.split('\n'));
  const height = 24,
    start = Math.max(0, Math.floor(scroll / height) - 5),
    end = Math.min(lines.length, start + 28);
  return (
    <div
      className="virtual-log"
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      style={{ height: 420, overflow: 'auto' }}
    >
      <div style={{ height: lines.length * height, position: 'relative', minWidth: 600 }}>
        {lines.slice(start, end).map((l, i) => (
          <div
            className="log-line"
            key={start + i}
            style={{ position: 'absolute', top: (start + i) * height, height, whiteSpace: 'pre' }}
          >
            <span>{start + i + 1}</span>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
