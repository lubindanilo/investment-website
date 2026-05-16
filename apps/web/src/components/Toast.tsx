/**
 * Toast system avec 2 contextes pour éviter les re-renders en cascade :
 *   • ToastStateContext  : `toasts: Toast[]` — change à chaque push/dismiss
 *   • ToastActionsContext: `{ push, dismiss }` — STABLE forever
 *
 * Les composants qui veulent juste push un toast utilisent `useToast()`
 * qui ne consomme que les actions stables. Leurs useCallback/useEffect avec
 * `[toast]` comme dépendance ne se ré-évaluent JAMAIS.
 *
 * Seul `ToastProvider` lui-même consomme le state (pour rendre la stack).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import './Toast.css';

export type ToastKind = 'info' | 'success' | 'error' | 'warn';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastActions {
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

const ToastActionsContext = createContext<ToastActions | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Objet stable : ne change JAMAIS car push et dismiss sont stable (useCallback []).
  const actions = useMemo<ToastActions>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastActionsContext.Provider value={actions}>
      {children}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Fermer">×</button>
          </div>
        ))}
      </div>
    </ToastActionsContext.Provider>
  );
}

/**
 * Retourne uniquement les actions (push, dismiss). Référence **stable** —
 * peut être utilisée sans souci dans une dépendance useCallback/useEffect.
 */
export function useToast(): ToastActions {
  const ctx = useContext(ToastActionsContext);
  if (!ctx) throw new Error('useToast doit être utilisé à l\'intérieur d\'un <ToastProvider>');
  return ctx;
}
