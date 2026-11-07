import type { LogEntry } from '@shared/types';

type Listener = (entry: LogEntry) => void;

class LoggerImpl {
  private entries: LogEntry[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;
  quiet = false;

  private push(level: LogEntry['level'], message: string) {
    const entry: LogEntry = { id: ++this.seq, time: Date.now(), level, message };
    this.entries.push(entry);
    if (this.entries.length > 500) this.entries.shift();
    if (!this.quiet) {
      const t = new Date(entry.time).toLocaleTimeString();
      const line = `[${t}] ${level.toUpperCase().padEnd(5)} ${message}`;
      if (level === 'error') console.error(line);
      else console.log(line);
    }
    for (const l of this.listeners) l(entry);
  }

  info(msg: string) { this.push('info', msg); }
  warn(msg: string) { this.push('warn', msg); }
  error(msg: string) { this.push('error', msg); }
  event(msg: string) { this.push('event', msg); }
  recent(n = 200) { return this.entries.slice(-n); }
  onEntry(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
}

export const Logger = new LoggerImpl();
