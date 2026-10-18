-- Ejecutá este SQL en Supabase > SQL Editor.
-- Las tablas no son públicas; las políticas limitan el acceso a la cuenta propietaria.
create table if not exists public.owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  netlify_site_id text not null,
  site_url text,
  deploy_id text,
  created_at timestamptz not null default now()
);
alter table public.owners enable row level security;
alter table public.projects enable row level security;
revoke all on public.owners from anon, authenticated;
revoke all on public.projects from anon, authenticated;
grant select on public.owners to authenticated;
grant select on public.projects to authenticated;
create policy "Owner can read own owner record"
on public.owners for select to authenticated
using (auth.uid() = user_id);
create policy "Owner can read own projects"
on public.projects for select to authenticated
using (auth.uid() = owner_id);
-- No habilitamos inserción/edición desde el navegador. La función de Netlify
-- verifica el propietario y realiza la inserción usando el contexto autenticado.
-- Para la primera configuración, crear una cuenta en la web y luego ejecutar:
-- insert into public.owners (user_id) values ('UUID_DE_TU_USUARIO');
-- Encontrás el UUID en Supabase > Authentication > Users.
