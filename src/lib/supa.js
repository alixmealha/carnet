import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
export const cloud = !!(SUPABASE_URL && SUPABASE_KEY);
export const sb = cloud ? createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'carnet-auth', detectSessionInUrl: false }
}) : null;
