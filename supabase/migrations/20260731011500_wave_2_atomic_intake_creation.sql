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
  p_operating_principles_version text,
  p_interview_guide_version text,
  p_live_prompt_version text
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
    participant_id,
    consent_version,
    consented_at,
    operating_principles_version,
    interview_guide_version,
    live_prompt_version
  )
  values (
    created_participant_id,
    p_consent_version,
    p_consented_at,
    p_operating_principles_version,
    p_interview_guide_version,
    p_live_prompt_version
  )
  returning interviews.interview_id into created_interview_id;

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
  text,
  text,
  text
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
  text,
  text,
  text
) to service_role;
