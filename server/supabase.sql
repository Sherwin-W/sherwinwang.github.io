-- Public last-played cache for the Spotify tile. Holds only normalized track data.
create table if not exists spotify_cache (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
-- The API uses the service-role key, which bypasses RLS. Enabling RLS with no policies
-- keeps the table unreadable through the public anon key.
alter table spotify_cache enable row level security;
