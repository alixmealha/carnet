import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC } from '../config.js';
import { createMock } from './mock.js';

const mock = import.meta.env.VITE_MOCK === '1';
export const cloud = mock || !!(SUPABASE_URL && SUPABASE_KEY);
export const vapidKey = VAPID_PUBLIC;
export const sb = mock ? createMock() : cloud ? createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'carnet-auth', detectSessionInUrl: false }
}) : null;
