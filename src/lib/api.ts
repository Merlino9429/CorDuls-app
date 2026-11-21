import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Chiama una Edge Function e restituisce un messaggio d'errore leggibile. */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? 'Si è verificato un errore');
    }
    throw new Error('Connessione non disponibile. Riprova.');
  }
  return data as T;
}

/** Carica una foto (uri locale da ImagePicker) nello storage e ne restituisce l'URL pubblico. */
export async function uploadImage(uri: string, folder: string, mimeType?: string | null): Promise<string> {
  const res = await fetch(uri);
  const buffer = await res.arrayBuffer();
  const contentType = mimeType ?? 'image/jpeg';
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('images').upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Caricamento foto non riuscito: ${error.message}`);
  return supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
}
