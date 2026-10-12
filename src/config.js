// Projet Supabase et clé publique « anon » : elle peut être publique, l'accès aux données
// est protégé par la connexion et les règles RLS (chacun ne voit que ses lignes, le coach celles de ses athlètes).
// VITE_LOCAL=1 au build = mode local seul (tests), sans connexion ni synchronisation.
const local = import.meta.env.VITE_LOCAL === '1';
export const SUPABASE_URL = local ? '' : 'https://remthpcuidagjaxxkohc.supabase.co';
export const SUPABASE_KEY = local ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbXRocGN1aWRhZ2pheHhrb2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3OTQ0MTQsImV4cCI6MjEwNzM3MDQxNH0.6PFQMpJVPpHQNVB3IiKKUXfBGMa-oX-3Di9J0rdXwvc';
// Clé publique des notifications (VAPID). La clé privée correspondante est un secret de la fonction « notify ».
export const VAPID_PUBLIC = 'BKnyphkjNE2TEVBLg8sxVYflEe_7LQLN4B5U7JiAbyC3XolBieaNG5uFtbB241_Dv3fQNWLldWdmSDuOPcbbF8Q';
