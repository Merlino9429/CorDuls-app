import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return v;
}

/** Client con service role: bypassa RLS, da usare SOLO lato server. */
export const admin: SupabaseClient = createClient(
  env('SUPABASE_URL'),
  env('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Restituisce l'utente autenticato dalla richiesta, oppure lancia 401. */
export async function requireUser(req: Request): Promise<User> {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError('Accesso richiesto', 401);
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError('Sessione non valida', 401);
  return data.user;
}

/** Come requireUser, ma richiede anche il ruolo admin. */
export async function requireAdmin(req: Request): Promise<User> {
  const user = await requireUser(req);
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (data?.role !== 'admin') throw new HttpError('Permesso negato', 403);
  return user;
}
