create table public.participant_session_tokens (
  participant_session_token_id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(interview_id) on delete cascade,
  token_digest text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_session_tokens_digest_not_blank check (length(btrim(token_digest)) > 0),
  constraint participant_session_tokens_expires_in_future check (expires_at > created_at)
);

create unique index participant_session_tokens_interview_unique
  on public.participant_session_tokens (interview_id);

alter table public.participant_session_tokens enable row level security;

create trigger participant_session_tokens_set_updated_at
before update on public.participant_session_tokens
for each row
execute function public.set_updated_at();

drop function public.create_participant_and_interview(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.profile_status,
  timestamptz,
  text,
  timestamptz,
  text,
  text,
  text
);

create or replace function public.create_participant_and_interview(
  p_email text,
  p_gfoa_member_id text,
  p_name text,
  p_title text,
  p_organization_name text,
  p_government_type text,
  p_state_or_region text,
  p_organization_size_band text,
  p_experience_band text,
  p_profile_status public.profile_status,
  p_profile_confirmed_at timestamptz,
  p_consent_version text,
  p_consented_at timestamptz,
  p_interview_id uuid,
  p_operating_principles_version text,
  p_interview_guide_version text,
  p_live_prompt_version text,
  p_participant_session_token_digest text,
  p_participant_session_expires_at timestamptz
)
returns table (
  participant_id uuid,
  interview_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_participant_id uuid;
  created_interview_id uuid;
begin
  insert into public.participants (
    email,
    gfoa_member_id,
    name,
    title,
    organization_name,
    government_type,
    state_or_region,
    organization_size_band,
    experience_band,
    profile_status,
    profile_confirmed_at
  )
  values (
    p_email,
    nullif(p_gfoa_member_id, ''),
    nullif(p_name, ''),
    nullif(p_title, ''),
    nullif(p_organization_name, ''),
    nullif(p_government_type, ''),
    nullif(p_state_or_region, ''),
    nullif(p_organization_size_band, ''),
    nullif(p_experience_band, ''),
    p_profile_status,
    p_profile_confirmed_at
  )
  returning participants.participant_id into created_participant_id;

  insert into public.interviews (
    interview_id,
    participant_id,
    consent_version,
    consented_at,
    operating_principles_version,
    interview_guide_version,
    live_prompt_version
  )
  values (
    p_interview_id,
    created_participant_id,
    p_consent_version,
    p_consented_at,
    p_operating_principles_version,
    p_interview_guide_version,
    p_live_prompt_version
  )
  returning interviews.interview_id into created_interview_id;

  insert into public.participant_session_tokens (
    interview_id,
    token_digest,
    expires_at
  )
  values (
    created_interview_id,
    p_participant_session_token_digest,
    p_participant_session_expires_at
  );

  participant_id := created_participant_id;
  interview_id := created_interview_id;
  return next;
end;
$$;

revoke all on function public.create_participant_and_interview(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.profile_status,
  timestamptz,
  text,
  timestamptz,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.create_participant_and_interview(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  public.profile_status,
  timestamptz,
  text,
  timestamptz,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
) to service_role;

create or replace function public.try_mark_interview_active(p_interview_id uuid)
returns public.interview_lifecycle_status
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status public.interview_lifecycle_status;
begin
  update public.interviews
  set
    lifecycle_status = 'active',
    started_at = coalesce(started_at, now())
  where interview_id = p_interview_id
    and lifecycle_status = 'created'
    and browser_connection_status = 'connected'
    and sideband_connection_status = 'connected'
  returning lifecycle_status into current_status;

  if current_status is null then
    select lifecycle_status
    into current_status
    from public.interviews
    where interview_id = p_interview_id;
  end if;

  return current_status;
end;
$$;

revoke all on function public.try_mark_interview_active(uuid)
from public, anon, authenticated;

grant execute on function public.try_mark_interview_active(uuid)
to service_role;

comment on table public.participant_session_tokens is
  'Hashed/HMACed short-lived participant session tokens for participant-facing live interview routes. Raw tokens are never stored.';

comment on function public.try_mark_interview_active(uuid) is
  'Mutual activation path: an interview becomes active only after browser and sideband connections are both connected.';
