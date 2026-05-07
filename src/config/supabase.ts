import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://acjwagnrdbkedvacligr.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjandhZ25yZGJrZWR2YWNsaWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNTU3OTYsImV4cCI6MjA5MzczMTc5Nn0.Ii7zNN5cnFVSo0NzJ0NU2ltD1hTdwLXQYuIbBDo37yM';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export const STORAGE_BUCKET = 'documents';

export async function uploadToStorage(
  file: File | Blob,
  path: string,
): Promise<{ path: string; publicUrl: string }> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: (file as File).type || 'application/pdf',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function downloadFromStorage(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error) throw error;
  return data;
}
