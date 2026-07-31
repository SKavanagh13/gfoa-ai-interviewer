alter table public.interview_quote_segments
add column start_offset integer,
add column end_offset integer,
add constraint interview_quote_segments_start_offset_nonnegative check (
  start_offset is null
  or start_offset >= 0
),
add constraint interview_quote_segments_end_offset_after_start check (
  start_offset is null
  or end_offset is null
  or end_offset > start_offset
);

create or replace function public.validate_interview_quote_segment_offsets()
returns trigger
language plpgsql
as $$
declare
  quote_status public.quote_verification_status;
begin
  select iq.verification_status
  into quote_status
  from public.interview_quotes iq
  where iq.quote_id = new.quote_id;

  if quote_status = 'accepted'
    and (new.start_offset is null or new.end_offset is null)
  then
    raise exception 'accepted quote evidence must include source offsets';
  end if;

  return new;
end;
$$;

create trigger interview_quote_segments_require_offsets_for_accepted
before insert or update
on public.interview_quote_segments
for each row
execute function public.validate_interview_quote_segment_offsets();

create or replace function public.record_analysis_eligibility(
  p_interview_id uuid,
  p_analysis_eligibility public.analysis_eligibility,
  p_supporting_objective public.objective,
  p_supporting_segment_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.analysis_eligibility_segments
  where interview_id = p_interview_id;

  if p_analysis_eligibility = 'eligible' then
    if p_supporting_objective is null then
      raise exception 'eligible interview requires a supporting objective';
    end if;

    if coalesce(array_length(p_supporting_segment_ids, 1), 0) = 0 then
      raise exception 'eligible interview requires supporting segments';
    end if;

    insert into public.analysis_eligibility_segments (interview_id, segment_id)
    select p_interview_id, segment_id
    from unnest(p_supporting_segment_ids) as segment_id;
  elsif p_supporting_objective is not null then
    raise exception 'ineligible interview cannot carry a supporting objective';
  end if;

  update public.interviews
  set
    analysis_eligibility = p_analysis_eligibility,
    analysis_eligibility_supporting_objective =
      case
        when p_analysis_eligibility = 'eligible' then p_supporting_objective
        else null
      end,
    analysis_eligibility_decided_at = now()
  where interview_id = p_interview_id;
end;
$$;

revoke all on function public.record_analysis_eligibility(
  uuid,
  public.analysis_eligibility,
  public.objective,
  uuid[]
) from public, anon, authenticated;

grant execute on function public.record_analysis_eligibility(
  uuid,
  public.analysis_eligibility,
  public.objective,
  uuid[]
) to service_role;

create or replace function public.persist_succeeded_analysis(
  p_analysis_id uuid,
  p_overall_summary text,
  p_primary_takeaway text,
  p_additional_issue text,
  p_overall_quality public.overall_quality,
  p_key_tension text,
  p_recurring_concern text,
  p_opportunity_signal text,
  p_emerging_signal text,
  p_limitations text,
  p_raw_structured_output jsonb,
  p_estimated_input_tokens integer,
  p_estimated_output_tokens integer,
  p_estimated_analysis_cost_usd numeric,
  p_negative_reaction_flag boolean,
  p_objective_results jsonb,
  p_objective_segments jsonb,
  p_quotes jsonb,
  p_quote_segments jsonb,
  p_theme_assignments jsonb,
  p_theme_segments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_interview_id uuid;
  objective_count integer;
begin
  select ar.interview_id
  into parent_interview_id
  from public.analysis_runs ar
  where ar.analysis_id = p_analysis_id
  for update;

  if parent_interview_id is null then
    raise exception 'analysis run does not exist';
  end if;

  delete from public.theme_assignment_segments
  where theme_assignment_id in (
    select theme_assignment_id
    from public.theme_assignments
    where analysis_id = p_analysis_id
  );
  delete from public.theme_assignments where analysis_id = p_analysis_id;
  delete from public.interview_quote_segments
  where quote_id in (
    select quote_id
    from public.interview_quotes
    where analysis_id = p_analysis_id
  );
  delete from public.interview_quotes where analysis_id = p_analysis_id;
  delete from public.objective_result_segments
  where objective_result_id in (
    select objective_result_id
    from public.objective_results
    where analysis_id = p_analysis_id
  );
  delete from public.objective_results where analysis_id = p_analysis_id;

  insert into public.objective_results (
    objective_result_id,
    analysis_id,
    objective,
    narrative_summary,
    coverage,
    confidence,
    structured_fields
  )
  select
    (item ->> 'objective_result_id')::uuid,
    p_analysis_id,
    (item ->> 'objective')::public.objective,
    item ->> 'narrative_summary',
    (item ->> 'coverage')::public.objective_coverage,
    (item ->> 'confidence')::public.confidence,
    item -> 'structured_fields'
  from jsonb_array_elements(p_objective_results) as item;

  select count(*)
  into objective_count
  from public.objective_results
  where analysis_id = p_analysis_id;

  if objective_count <> 6 then
    raise exception 'successful analysis persistence requires exactly six objective rows';
  end if;

  insert into public.objective_result_segments (objective_result_id, segment_id)
  select
    (item ->> 'objective_result_id')::uuid,
    (item ->> 'segment_id')::uuid
  from jsonb_array_elements(p_objective_segments) as item;

  insert into public.interview_quotes (
    quote_id,
    analysis_id,
    interview_id,
    quote_text,
    objective,
    verification_status,
    reason_selected
  )
  select
    (item ->> 'quote_id')::uuid,
    p_analysis_id,
    parent_interview_id,
    item ->> 'quote_text',
    nullif(item ->> 'objective', '')::public.objective,
    (item ->> 'verification_status')::public.quote_verification_status,
    item ->> 'reason_selected'
  from jsonb_array_elements(p_quotes) as item;

  insert into public.interview_quote_segments (
    quote_id,
    segment_id,
    start_offset,
    end_offset
  )
  select
    (item ->> 'quote_id')::uuid,
    (item ->> 'segment_id')::uuid,
    (item ->> 'start_offset')::integer,
    (item ->> 'end_offset')::integer
  from jsonb_array_elements(p_quote_segments) as item;

  insert into public.theme_assignments (
    theme_assignment_id,
    analysis_id,
    label,
    description
  )
  select
    (item ->> 'theme_assignment_id')::uuid,
    p_analysis_id,
    item ->> 'label',
    item ->> 'description'
  from jsonb_array_elements(p_theme_assignments) as item;

  insert into public.theme_assignment_segments (
    theme_assignment_id,
    segment_id
  )
  select
    (item ->> 'theme_assignment_id')::uuid,
    (item ->> 'segment_id')::uuid
  from jsonb_array_elements(p_theme_segments) as item;

  update public.interviews
  set negative_reaction_flag = coalesce(p_negative_reaction_flag, negative_reaction_flag)
  where interview_id = parent_interview_id;

  update public.analysis_runs
  set
    status = 'succeeded',
    overall_summary = p_overall_summary,
    primary_takeaway = p_primary_takeaway,
    additional_issue = p_additional_issue,
    overall_quality = p_overall_quality,
    key_tension = p_key_tension,
    recurring_concern = p_recurring_concern,
    opportunity_signal = p_opportunity_signal,
    emerging_signal = p_emerging_signal,
    limitations = p_limitations,
    raw_structured_output = p_raw_structured_output,
    estimated_input_tokens = p_estimated_input_tokens,
    estimated_output_tokens = p_estimated_output_tokens,
    estimated_analysis_cost_usd = p_estimated_analysis_cost_usd,
    error_message = null
  where analysis_id = p_analysis_id;
end;
$$;

revoke all on function public.persist_succeeded_analysis(
  uuid,
  text,
  text,
  text,
  public.overall_quality,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  integer,
  integer,
  numeric,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_succeeded_analysis(
  uuid,
  text,
  text,
  text,
  public.overall_quality,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  integer,
  integer,
  numeric,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;

comment on function public.record_analysis_eligibility(
  uuid,
  public.analysis_eligibility,
  public.objective,
  uuid[]
) is
  'Atomic Wave 5 eligibility decision persistence with required canonical evidence for eligible interviews.';

comment on function public.persist_succeeded_analysis(
  uuid,
  text,
  text,
  text,
  public.overall_quality,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  integer,
  integer,
  numeric,
  boolean,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) is
  'Atomic Wave 5 successful analysis persistence. Inserts exactly six objective rows, evidence, quotes, quote offsets, optional themes, and then marks the run succeeded.';
