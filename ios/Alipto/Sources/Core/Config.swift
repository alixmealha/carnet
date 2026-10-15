import Foundation

/// Projet Supabase et clé publique « anon » (la même que la version web) : elle peut être publique,
/// l'accès aux données est protégé par la connexion et les règles de la base (chacun ne voit que ses lignes).
enum Config {
    static let supabaseURL = URL(string: "https://remthpcuidagjaxxkohc.supabase.co")!
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbXRocGN1aWRhZ2pheHhrb2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3OTQ0MTQsImV4cCI6MjEwNzM3MDQxNH0.6PFQMpJVPpHQNVB3IiKKUXfBGMa-oX-3Di9J0rdXwvc"
    static let webURL = URL(string: "https://alixmealha.github.io/carnet/")!
}
