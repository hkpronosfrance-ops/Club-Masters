-- Keep the database aligned with the club creation payload.
-- Safe to run on both existing and new Supabase projects.

alter table public.clubs
  add column if not exists crest_shape text not null default 'shield',
  add column if not exists crest_icon text not null default 'ball',
  add column if not exists secondary_color text not null default '#FFFFFF';

-- Basic database-level validation for values controlled by the UI.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clubs_crest_shape_check'
  ) then
    alter table public.clubs
      add constraint clubs_crest_shape_check
      check (crest_shape in ('shield', 'round', 'diamond'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clubs_primary_color_hex_check'
  ) then
    alter table public.clubs
      add constraint clubs_primary_color_hex_check
      check (primary_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'clubs_secondary_color_hex_check'
  ) then
    alter table public.clubs
      add constraint clubs_secondary_color_hex_check
      check (secondary_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;
