create or replace function public.load_admin_review_participant_context(
  p_interview_id uuid
)
returns table (
  participant_id uuid,
  government_type text,
  state_or_region text,
  organization_size_band text,
  experience_band text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_or_admin() then
    raise exception 'admin review participant context requires staff or admin role';
  end if;

  if not exists (
    select 1
    from public.interviews i
    where i.interview_id = p_interview_id
  ) then
    return;
  end if;

  return query
  select
    p.participant_id,
    p.government_type,
    p.state_or_region,
    p.organization_size_band,
    p.experience_band
  from public.interviews i
  join public.participants p on p.participant_id = i.participant_id
  where i.interview_id = p_interview_id;
end;
$$;

revoke all on function public.load_admin_review_participant_context(
  uuid
) from public, anon;

grant execute on function public.load_admin_review_participant_context(
  uuid
) to authenticated;

create or replace function public.update_negative_reaction_flag(
  p_interview_id uuid,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.interviews
  set negative_reaction_flag = p_value
  where interview_id = p_interview_id;

  if not found then
    raise exception 'interview not found';
  end if;
end;
$$;

revoke all on function public.update_negative_reaction_flag(
  uuid,
  boolean
) from public, anon, authenticated;

grant execute on function public.update_negative_reaction_flag(
  uuid,
  boolean
) to service_role;

comment on function public.load_admin_review_participant_context(uuid) is
  'Wave 6 authenticated admin review read helper returning only approved non-identifying participant context.';

comment on function public.update_negative_reaction_flag(uuid, boolean) is
  'Wave 6 narrow service-role write helper for reviewer-controlled interview experience metadata.';
