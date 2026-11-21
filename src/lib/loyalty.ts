import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from './supabase';
import type { LoyaltyReason, LoyaltyReward, LoyaltyTransaction } from './types';

export const REASON_LABELS: Record<LoyaltyReason, string> = {
  order: 'Ordine',
  redeem: 'Premio riscattato',
  refund: 'Punti restituiti',
  reversal: 'Storno',
  manual: 'In negozio',
  welcome: 'Benvenuto',
};

export async function loadLoyalty(userId: string) {
  const { data } = await supabase.from('loyalty_transactions').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
  const transactions = (data as LoyaltyTransaction[]) ?? [];
  return { transactions, balance: transactions.reduce((s, t) => s + t.points, 0) };
}

/** Saldo punti, movimenti e premi attivi; si ricarica quando la schermata torna visibile. */
export function useLoyalty(userId: string | undefined) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [r, l] = await Promise.all([
      supabase.from('loyalty_rewards').select('*').eq('active', true).order('points_cost'),
      userId ? loadLoyalty(userId) : Promise.resolve({ transactions: [], balance: 0 }),
    ]);
    setRewards((r.data as LoyaltyReward[]) ?? []);
    setTransactions(l.transactions);
    setBalance(l.balance);
    setLoaded(true);
  }, [userId]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { balance, transactions, rewards, loaded, reload };
}
