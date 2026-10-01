-- =====================================================================
-- JuIntake V1 — Supabase backend design reference
-- =====================================================================
-- 이 파일은 JuIntake 운영 백엔드의 "문서용 스키마 기준"입니다.
-- 실제 운영 데이터베이스는 이미 프로비저닝되어 있고, 이 저장소는
-- 정적 사이트만 담습니다. 따라서 이 SQL을 그대로 실행하는 것은
-- 문서 정합성 확인용이며, 운영 반영은 supabase CLI / SQL 편집기에서
-- 동일 내용을 1회만 적용하면 됩니다.
--
-- 호스팅 위치
--   프로젝트 AI-Study-Group (무료 활성 프로젝트 2개 한도 때문에
--   JuIntake 전용 프로젝트를 만들지 않고 이 프로젝트 안에서 운영)
--   URL: https://maftfuenkiadrjwujvdu.supabase.co
--
-- 격리 규칙
--   - JuIntake가 만드는 모든 DB 오브젝트는 juintake_ 접두사를 가집니다.
--   - 기존 public.applications 테이블(다른 서비스용)은 절대 읽거나
--     쓰지 않습니다. 이 스키마에도 해당 테이블에 대한 참조가 없습니다.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. 확장
-- ---------------------------------------------------------------------
-- juintake_admin_config.token_hash 계산에 필요합니다.
-- digest()는 pgcrypto 확장에 있으며, Supabase에서는
-- extensions 스키마로 이동되어 extensions.digest(...)로 호출합니다.
create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------------
-- 1. 테이블: juintake_requests
-- ---------------------------------------------------------------------
-- 공개 폼이 채운 1행을 그대로 보관합니다.
-- 공개 클라이언트는 이 테이블에 직접 접근하지 않습니다.
-- grant 를 별도로 주지 않고 RPC(security definer) 경로만 엽니다.
create table if not exists public.juintake_requests (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- 분류
  request_type      text        not null
                    check (request_type in (
                      'dev_ai_setup',    -- 개발환경 구축 + AI 연동
                      'vibe_coding',     -- 바이브코딩 시작 / 배우기
                      'outsourcing',     -- 제작 / 외주 의뢰
                      'automation_agent',-- 업무 자동화 / AI Agent
                      'troubleshooting', -- 기존 프로젝트 / 환경 문제 해결
                      'consultation'     -- 아직 잘 모르겠어요 / 방향 상담
                    )),

  -- 공통 필드 (정규 컬럼: 목록/검색/연락처 용도)
  name              text        not null,
  contact           text        not null,
  title             text        not null,

--   -- 유형별/공통 문답 전체. 프론트엔드(assets/js/form.js)가 만드는 모양:
--   --   { "v": 1, "common": { ... }, "detail": { ... } }
--   -- "common" 은 이름/연락처/요약/사용 맥락/최종 목표/AI 도구 등 공통 문답,
--   -- "detail" 은 접수 유형별 문답(assets/js/config.js 의 requestTypes 기준)입니다.
  answers           jsonb       not null default '{}'::jsonb,

  -- 운영 상태
  status            text        not null default 'NEW'
                    check (status in (
                      'NEW',
                      'REVIEWING',
                      'NEED_MORE_INFO',
                      'ROADMAP_READY',
                      'ACCEPTED',
                      'IN_PROGRESS',
                      'DONE'
                    )),
  admin_note        text,

  updated_at        timestamptz not null default now()
);

comment on table  public.juintake_requests is 'JuIntake 공개 접수 요청. 클라이언트 직접 접근 금지, RPC 전용.';
comment on column public.juintake_requests.request_type is '접수 유형 코드 (dev_ai_setup|vibe_coding|outsourcing|automation_agent|troubleshooting|consultation)';
comment on column public.juintake_requests.answers is '공통(common) + 유형별(detail) 문답 JSON. assets/js/form.js 가 생성, assets/js/config.js 가 항목 정의.';
comment on column public.juintake_requests.status is '운영 상태. NEW -> REVIEWING -> (NEED_MORE_INFO|ROADMAP_READY|ACCEPTED|IN_PROGRESS|DONE).';

create index if not exists juintake_requests_created_at_idx
  on public.juintake_requests (created_at desc);

create index if not exists juintake_requests_status_idx
  on public.juintake_requests (status, created_at desc);

create index if not exists juintake_requests_request_type_idx
  on public.juintake_requests (request_type, created_at desc);


-- ---------------------------------------------------------------------
-- 2. 테이블: juintake_admin_config
-- ---------------------------------------------------------------------
-- 관리자 토큰은 평문으로 두지 않습니다. sha256 해시만 저장합니다.
-- 해시는 extensions.digest(p_token, 'sha256') 로 계산하며 hex 인코딩되어
-- 저장됩니다. 토큰 원문은 어떤 환경에도 커밋하지 않습니다.
create table if not exists public.juintake_admin_config (
  id            boolean     primary key default true check (id),
  token_hash    text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.juintake_admin_config is '관리자 토큰 sha256 해시 보관. 평문 토큰은 저장/커밋 금지.';
comment on column public.juintake_admin_config.token_hash is 'encode(extensions.digest(<token>, ''sha256''), ''hex'') 결과.';


-- ---------------------------------------------------------------------
-- 3. 관리자 토큰 일치 검사 헬퍼
-- ---------------------------------------------------------------------
-- 일정 비교(timing attack)를 피하기 위해 해시 문자열을 상수로
-- 비교하지 않고, DB 내부에서 행을 1회 조회해 boolean으로 판정합니다.
create or replace function public.juintake_check_admin_token(p_token text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
      from public.juintake_admin_config c
     where c.id
       and c.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  );
$$;

comment on function public.juintake_check_admin_token(text)
  is '관리자 토큰 유효성 판정. extensions.digest 기반 sha256 비교. 공개 클라이언트에는 호출 권한 없음.';


-- ---------------------------------------------------------------------
-- 4. 공개 RPC: juintake_submit_request
-- ---------------------------------------------------------------------
-- 공개 폼이 유일하게 호출하는 쓰기 경로입니다.
-- 테이블에 대한 grant 없이 security definer 로 실행되므로
-- 익명(anon) 키로는 테이블 SELECT/INSERT/UPDATE 가 불가능합니다.
--
-- 클라이언트 호출 예:
--   supabase.rpc('juintake_submit_request', {
--     p_request_type: 'dev_ai_setup',
--     p_name:        '홍길동',
--     p_contact:     'example@example.com',
--     p_title:       '회사 사내 도구 AI 연동하고 싶습니다',
--     p_answers:     { ... }   // storage.jsonb 형태
--   })
create or replace function public.juintake_submit_request(
  p_request_type text,
  p_name         text,
  p_contact      text,
  p_title        text,
  p_answers      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  -- 유효성: 요청 유형 화이트리스트
  if p_request_type is null
     or p_request_type not in ('dev_ai_setup','vibe_coding','outsourcing',
                               'automation_agent','troubleshooting','consultation') then
    raise exception 'invalid request type' using errcode = 'P0001';
  end if;

  -- 유효성: 필수 문자열
  if coalesce(btrim(p_name), '')    = '' then
    raise exception 'name is required' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_contact), '') = '' then
    raise exception 'contact is required' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_title), '')   = '' then
    raise exception 'title is required' using errcode = 'P0001';
  end if;

  -- 유효성: 연락처는 너무 길면 안 됨 (정리되지 않은 값 방어)
  if length(p_name)    > 200 or
     length(p_contact) > 400 or
     length(p_title)   > 400 then
    raise exception 'field too long' using errcode = 'P0001';
  end if;

  insert into public.juintake_requests (
    request_type, name, contact, title, answers
  )
  values (
    p_request_type,
    btrim(p_name),
    btrim(p_contact),
    btrim(p_title),
    coalesce(p_answers, '{}'::jsonb)
  )
  returning id into v_id;

  return jsonb_build_object(
    'id',         v_id,
    'request_type', p_request_type,
    'status',     'NEW',
    'created_at', now()
  );
end;
$$;

comment on function public.juintake_submit_request(text, text, text, text, jsonb)
  is '공개 접수 쓰기 진입점. security definer. 테이블 직접 접근 불가.';


-- ---------------------------------------------------------------------
-- 5. 관리자 RPC: juintake_admin_list_requests
-- ---------------------------------------------------------------------
-- 토큰이 틀리면 예외를 던져 실패(fail closed)합니다.
-- 유효한 경우에만 전체/상태별 목록을 반환합니다.
create or replace function public.juintake_admin_list_requests(
  p_token  text,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.juintake_check_admin_token(p_token) then
    raise exception 'invalid admin token' using errcode = 'P0001';
  end if;

  if p_status is not null
     and p_status <> ''
     and p_status not in ('NEW','REVIEWING','NEED_MORE_INFO','ROADMAP_READY',
                           'ACCEPTED','IN_PROGRESS','DONE') then
    raise exception 'invalid status filter' using errcode = 'P0001';
  end if;

  return coalesce(
    (
      select jsonb_agg(
               jsonb_build_object(
                 'id',           r.id,
                 'created_at',   r.created_at,
                 'updated_at',   r.updated_at,
                 'request_type', r.request_type,
                 'name',         r.name,
                 'contact',      r.contact,
                 'title',        r.title,
                 'status',       r.status,
                 'admin_note',   r.admin_note,
                 'answers',      r.answers
               )
               order by r.created_at desc
             )
      from public.juintake_requests r
      where p_status is null or p_status = '' or r.status = p_status
    ),
    '[]'::jsonb
  );
end;
$$;

comment on function public.juintake_admin_list_requests(text, text)
  is '관리자 목록 조회. 잘못된 토큰이면 raise (fail closed).';


-- ---------------------------------------------------------------------
-- 6. 관리자 RPC: juintake_admin_update_request
-- ---------------------------------------------------------------------
create or replace function public.juintake_admin_update_request(
  p_token      text,
  p_id         uuid,
  p_status     text default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.juintake_requests;
begin
  if not public.juintake_check_admin_token(p_token) then
    raise exception 'invalid admin token' using errcode = 'P0001';
  end if;

  if p_status is not null
     and p_status <> ''
     and p_status not in ('NEW','REVIEWING','NEED_MORE_INFO','ROADMAP_READY',
                           'ACCEPTED','IN_PROGRESS','DONE') then
    raise exception 'invalid status' using errcode = 'P0001';
  end if;

  update public.juintake_requests
     set status      = coalesce(nullif(p_status, ''), status),
         admin_note  = coalesce(p_admin_note, admin_note),
         updated_at  = now()
   where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'request not found' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'id',         v_row.id,
    'status',     v_row.status,
    'admin_note', v_row.admin_note,
    'updated_at', v_row.updated_at
  );
end;
$$;

comment on function public.juintake_admin_update_request(text, uuid, text, text)
  is '관리자 상태/메모 갱신. 잘못된 토큰이면 raise (fail closed).';


-- ---------------------------------------------------------------------
-- 7. 권한 (핵심 보안 원칙)
-- ---------------------------------------------------------------------
-- 익명 클라이언트에는 테이블 권한을 전혀 주지 않고,
-- public 스키마의 함수 실행 권한만 허용합니다.
revoke all on public.juintake_requests  from anon, authenticated;
revoke all on public.juintake_admin_config from anon, authenticated;

revoke all on function public.juintake_check_admin_token(text) from public, anon, authenticated;
revoke all on function public.juintake_admin_list_requests(text, text) from public, anon, authenticated;
revoke all on function public.juintake_admin_update_request(text, uuid, text, text) from public, anon, authenticated;

grant execute on function public.juintake_submit_request(text, text, text, text, jsonb) to anon, authenticated;

-- admin RPC 는 클라이언트(anon)가 직접 호출하므로 실행 권한은 필요합니다.
-- 보안은 함수 내부의 토큰 해시 검사(fail closed)에 의존합니다.
grant execute on function public.juintake_admin_list_requests(text, text) to anon, authenticated;
grant execute on function public.juintake_admin_update_request(text, uuid, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. 관리자 토큰 설정 (Founder 전용, 수동 1회)
-- ---------------------------------------------------------------------
-- 아래에 쓰는 <token> 은 이 저장소에 커밋하지 않습니다.
-- Founder가 Supabase SQL 편집기에서 직접 실행합니다.
--
--   insert into public.juintake_admin_config (id, token_hash)
--   values (true,
--           encode(extensions.digest('<여기에-직접-생성한-관리자-토큰>', 'sha256'), 'hex'))
--   on conflict (id) do update
--     set token_hash = excluded.token_hash,
--         updated_at = now();
--
-- 토큰 생성 예시 (로컬, 결과는 직접 복사):
--   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
--
-- 주의:
--   - GitHub 저장소에는 관리자 토큰이 절대 포함되지 않습니다.
--   - admin.html 은 브라우저에서 토큰을 입력받아 sessionStorage 에만
--     보관하며, 페이지 새로고침/탭 종료 시 사라집니다.
--   - 관리자 전용(privileged) 키는 이 프론트엔드에서 사용하지 않습니다.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 9. 확인용 쿼리 (읽기 전용 점검)
-- ---------------------------------------------------------------------
-- select status, count(*) from public.juintake_requests group by 1 order by 1;
-- select request_type, count(*) from public.juintake_requests group by 1 order by 2 desc;
-- select count(*) from public.juintake_admin_config;  -- 1이어야 정상(평문 아님)