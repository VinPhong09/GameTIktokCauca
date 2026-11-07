import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameConfig } from '@shared/types';
import { useGameStore } from '../services/store';
import { api } from '../services/api';

export function Card({ title, children, actions, className = '' }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title && <h3 className="text-lg font-extrabold text-slate-800">{title}</h3>}
          <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-bold text-slate-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Num({ value, onChange, step = 1, min, max, className = '' }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      className={`admin-input ${className}`}
      value={text}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function Text({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <input className={`admin-input ${className}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] | T[]; className?: string }) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <select className={`admin-input ${className}`} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center gap-2 text-sm font-bold text-slate-700">
      <span className={`relative h-6 w-11 rounded-full transition ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

const BTN = {
  primary: 'bg-sky-600 text-white hover:bg-sky-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  warn: 'bg-amber-500 text-white hover:bg-amber-600',
  ghost: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  violet: 'bg-violet-600 text-white hover:bg-violet-700',
  pink: 'bg-pink-500 text-white hover:bg-pink-600',
};

export function Btn({ children, onClick, kind = 'primary', disabled, className = '', title }: { children: ReactNode; onClick?: () => void; kind?: keyof typeof BTN; disabled?: boolean; className?: string; title?: string }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={`admin-btn ${BTN[kind]} ${className}`}>
      {children}
    </button>
  );
}

let toastSeq = 0;
type ToastListener = (t: { id: number; text: string; ok: boolean }) => void;
const toastListeners = new Set<ToastListener>();
export function notify(text: string, ok = true) {
  const t = { id: ++toastSeq, text, ok };
  toastListeners.forEach((l) => l(t));
}
export function AdminToasts() {
  const [items, setItems] = useState<{ id: number; text: string; ok: boolean }[]>([]);
  useEffect(() => {
    const l: ToastListener = (t) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3000);
    };
    toastListeners.add(l);
    return () => {
      toastListeners.delete(l);
    };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg ${t.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export async function run<T>(p: Promise<T>, okText?: string): Promise<T | undefined> {
  try {
    const r = await p;
    if (okText) notify(okText);
    return r;
  } catch (e) {
    notify((e as Error).message, false);
    return undefined;
  }
}

/**
 * Editable local copy of a config section. Re-syncs from the server unless the user has unsaved edits.
 */
export function useDraft<K extends keyof GameConfig>(section: K) {
  const value = useGameStore((s) => s.config?.[section]);
  const [draft, setDraftState] = useState<GameConfig[K] | undefined>(value ? structuredClone(value) : undefined);
  const dirty = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    if (!dirty.current && value) setDraftState(structuredClone(value));
  }, [value]);
  const setDraft = (updater: (d: GameConfig[K]) => void) => {
    setDraftState((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      updater(next);
      return next;
    });
    dirty.current = true;
    setIsDirty(true);
  };
  const save = async () => {
    if (!draft) return;
    const ok = await run(api.patch(`/config/${section}`, draft), 'Đã lưu cấu hình');
    if (ok) {
      dirty.current = false;
      setIsDirty(false);
    }
  };
  const revert = () => {
    dirty.current = false;
    setIsDirty(false);
    if (value) setDraftState(structuredClone(value));
  };
  const reset = async () => {
    if (!confirm(`Khôi phục mặc định cho "${String(section)}"?`)) return;
    dirty.current = false;
    setIsDirty(false);
    await run(api.post('/config/reset', { section }), 'Đã khôi phục mặc định');
  };
  return { draft, setDraft, save, revert, reset, isDirty };
}

export function SaveBar({ isDirty, save, revert, reset }: { isDirty: boolean; save: () => void; revert: () => void; reset: () => void }) {
  return (
    <>
      <Btn kind="ghost" onClick={reset}>Mặc định</Btn>
      <Btn kind="ghost" onClick={revert} disabled={!isDirty}>Hoàn tác</Btn>
      <Btn kind="success" onClick={save} disabled={!isDirty}>💾 Lưu</Btn>
    </>
  );
}
