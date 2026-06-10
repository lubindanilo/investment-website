/**
 * SubscriptionContext — état d'abonnement Pro/Free partagé dans toute l'app.
 *
 * Pourquoi un contexte (et pas juste un hook qui fetch par composant) :
 *   1. La modale d'upgrade est utilisée dans plein de composants (screener flouté,
 *      graphiques verrouillés, comparer >2…) — on évite de refetcher partout.
 *   2. Le statut change rarement → un seul fetch au bootstrap, invalidé au login/logout
 *      via le AuthContext.
 *   3. Permet d'attacher un compteur (analyses du jour) consultable n'importe où.
 *
 * Comportement :
 *   - Utilisateur non connecté → isPro=false, loading=false, sub=null
 *   - Utilisateur connecté Free → isPro=false, sub.status='free', quotas dispo
 *   - Utilisateur connecté Pro  → isPro=true, sub.plan='monthly' ou 'yearly'
 *   - Bouton « refresh() » pour resync après un retour du checkout/portal Stripe
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type SubscriptionInfo } from '../lib/api.js';
import { useAuth } from './AuthContext.js';

interface SubscriptionContextValue {
  sub: SubscriptionInfo | null;
  isPro: boolean;
  loading: boolean;
  /** Recharge le statut depuis l'API. À appeler après un retour Stripe Checkout/Portal. */
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Pas connecté → pas de fetch. On garde sub=null (= free anonyme).
    if (!user) { setSub(null); setLoading(false); return; }
    try {
      setLoading(true);
      const data = await api.me.subscription();
      setSub(data);
    } catch {
      // Silencieux : si l'endpoint plante (cold start, réseau), on traite comme free.
      setSub(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return; // attend que AuthContext sache si user existe
    void refresh();
  }, [authLoading, refresh]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    sub,
    isPro: !!sub?.isPro,
    loading,
    refresh,
  }), [sub, loading, refresh]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription doit être appelé à l\'intérieur de <SubscriptionProvider>');
  return ctx;
}
