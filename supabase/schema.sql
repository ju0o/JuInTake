-- JuIntake V1 — production Supabase schema reference
-- Production project: AI-Study-Group (shared free-tier project)
-- All JuIntake objects use the juintake_ prefix.
-- Never commit the plaintext admin token.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.juintake_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (
    request_type in (
      'dev_ai_setup',
      'vibe_coding',
      'outsourcing',
      'automation_agent',
      'troubleshooting',
      'consultation'
    )
  ),
  name text not null,
  contact text not null,
  title text not null,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'NEW' check (
    status in (
      'NEW',
      'REVIEWING',
      'NEED_MORE_INFO',
      'ROADMAP_READY',
      'ACCEPTED',
      'IN_PROGRESS',
      'DONE'
    )
  ),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists juintake_requests_created_at_idx
  on public.juintake_requests (created_at desc);
create index if not exists juintake_requests_status_idx
  on public.juintake_requests (status, created_at desc);
create index if not exists juintake_requests_request_type_idx
  on public.juintake_requests (request_type, created_at desc);

create table if not exists public.juintake_admin_config (
  singleton boolean primary key default true check (singleton),
  token_hash text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.juintake_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists juintake_requests_updated_at on public.juintake_requests;
create trigger juintake_requests_updated_at
before update on public.juintake_requests
for each row execute function public.juintake_set_updated_at();

drop function if exists public.juintake_submit_request(text, text, text, text, jsonb);
create function public.juintake_submit_request(
  p_request_type text,
  p_name text,
  p_contact text,
  p_title text,
  p_answers jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_created_at timestamptz;
begin
  if p_request_type is null
     or p_request_type not in (
       'dev_ai_setup','vibe_coding','outsourcing',
       'automation_agent','troubleshooting','consultation'
     ) then
    raise exception 'invalid request type';
  end if;

  if length(trim(coalesce(p_name, ''))) not between 1 and 200 then
    raise exception 'invalid name';
  end if;
  if length(trim(coalesce(p_contact, ''))) not between 1 and 400 then
    raise exception 'invalid contact';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 1 and 400 then
    raise exception 'invalid title';
  end if;

  insert into public.juintake_requests (
    request_type, name, contact, title, answers, status, admin_note
  ) values (
    p_request_type,
    trim(p_name),
    trim(p_contact),
    trim(p_title),
    coalesce(p_answers, '{}'::jsonb),
    'NEW',
    null
  )
  returning id, created_at into v_id, v_created_at;

  return jsonb_build_object(
    'id', v_id,
    'request_type', p_request_type,
    'status', 'NEW',
    'created_at', v_created_at
  );
end;
$$;

drop function if exists public.juintake_admin_list_requests(text);
drop function if exists public.juintake_admin_list_requests(text, text);
create function public.juintake_admin_list_requests(
  p_token text,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.juintake_admin_config c
    where c.singleton = true
      and c.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  ) then
    raise exception 'invalid admin token';
  end if;

  if p_status is not null
     and p_status <> ''
     and p_status not in (
       'NEW','REVIEWING','NEED_MORE_INFO','ROADMAP_READY',
       'ACCEPTED','IN_PROGRESS','DONE'
     ) then
    raise exception 'invalid status filter';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'request_type', r.request_type,
        'name', r.name,
        'contact', r.contact,
        'title', r.title,
        'answers', r.answers,
        'status', r.status,
        'admin_note', r.admin_note,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      )
      order by r.created_at desc
    )
    from public.juintake_requests r
    where p_status is null or p_status = '' or r.status = p_status
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.juintake_admin_update_request(text, uuid, text, text);
create function public.juintake_admin_update_request(
  p_token text,
  p_id uuid,
  p_status text default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.juintake_requests;
begin
  if not exists (
    select 1
    from public.juintake_admin_config c
    where c.singleton = true
      and c.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  ) then
    raise exception 'invalid admin token';
  end if;

  if p_status is not null
     and p_status <> ''
     and p_status not in (
       'NEW','REVIEWING','NEED_MORE_INFO','ROADMAP_READY',
       'ACCEPTED','IN_PROGRESS','DONE'
     ) then
    raise exception 'invalid status';
  end if;

  update public.juintake_requests r
  set status = coalesce(nullif(p_status, ''), r.status),
      admin_note = coalesce(p_admin_note, r.admin_note),
      updated_at = now()
  where r.id = p_id
  returning r.* into v_row;

  if v_row.id is null then
    raise exception 'request not found';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'admin_note', v_row.admin_note,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on public.juintake_requests from anon, authenticated;
revoke all on public.juintake_admin_config from anon, authenticated;
revoke all on function public.juintake_submit_request(text,text,text,text,jsonb) from public;
revoke all on function public.juintake_admin_list_requests(text,text) from public;
revoke all on function public.juintake_admin_update_request(text,uuid,text,text) from public;

grant execute on function public.juintake_submit_request(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.juintake_admin_list_requests(text,text) to anon, authenticated;
grant execute on function public.juintake_admin_update_request(text,uuid,text,text) to anon, authenticated;

-- Founder-only admin-token registration example.
-- Replace <ADMIN_TOKEN> locally; never commit the plaintext token.
-- insert into public.juintake_admin_config (singleton, token_hash, updated_at)
-- values (
--   true,
--   encode(extensions.digest('<ADMIN_TOKEN>', 'sha256'), 'hex'),
--   now()
-- )
-- on conflict (singleton) do update
-- set token_hash = excluded.token_hash,
--     updated_at = now();
