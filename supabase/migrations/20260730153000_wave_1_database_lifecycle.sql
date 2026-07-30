create extension if not exists pgcrypto;

create type public.end_disposition as enum (
  'completed',
  'participant_ended',
  'technical_failure'
);

create type public.analysis_eligibility as enum (
  'eligible',
  'ineligible_insufficient_content'
);

create type public.analysis_run_status as enum (
  'pending',
  'succeeded',
  'failed'
);

create type public.transcript_status as enum (
  'pending',
  'stabilizing',
  'stable',
  'failed'
);

create type public.objective as enum (
  'current_issue',
  'enduring_concern',
  'theory_vs_practice',
  'recent_change',
  'unmet_need',
  'innovation_orientation'
);

create type public.objective_coverage as enum (
  'sufficiently_covered',
  'partially_covered',
  'not_covered',
  'unclear'
);

create type public.confidence as enum (
  'high',
  'moderate',
  'low'
);

create type public.overall_quality as enum (
  'strong',
  'adequate',
  'limited',
  'unusable'
);

create type public.quote_verification_status as enum (
  'proposed',
  'accepted',
  'rejected',
  'needs_review'
);

create type public.profile_status as enum (
  'matched_confirmed',
  'matched_corrected',
  'unmatched_minimum_collected',
  'not_confirmed'
);

create type public.transcript_speaker as enum (
  'participant',
  'interviewer',
  'system'
);

create type public.connection_status as enum (
  'pending',
  'connected',
  'failed',
  'closed'
);

create type public.interview_lifecycle_status as enum (
  'created',
  'active',
  'ending',
  'ended',
  'failed'
);

create type public.cost_category as enum (
  'completed',
  'abandoned',
  'technical_failure'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('staff', 'admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create table public.participants (
  participant_id uuid primary key default gen_random_uuid(),
  gfoa_member_id text,
  email text not null,
  name text,
  title text,
  organization_name text,
  government_type text,
  state_or_region text,
  organization_size_band text,
  experience_band text,
  profile_status public.profile_status not null default 'not_confirmed',
  profile_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_email_not_blank check (length(btrim(email)) > 0)
);

create table public.interviews (
  interview_id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(participant_id) on delete restrict,
  lifecycle_status public.interview_lifecycle_status not null default 'created',
  end_disposition public.end_disposition,
  analysis_eligibility public.analysis_eligibility,
  analysis_eligibility_supporting_objective public.objective,
  analysis_eligibility_decided_at timestamptz,
  transcript_status public.transcript_status not null default 'pending',
  transcript_stabilized_at timestamptz,
  transcript_reconciliation_timeout_ms integer,
  transcript_processing_error text,
  negative_reaction_flag boolean,
  consent_version text,
  consented_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  operating_principles_version text,
  interview_guide_version text,
  live_prompt_version text,
  audio_storage_path text,
  transcript_storage_path text,
  realtime_call_id text,
  browser_connection_status public.connection_status not null default 'pending',
  sideband_connection_status public.connection_status not null default 'pending',
  estimated_input_tokens integer,
  estimated_output_tokens integer,
  estimated_live_cost_usd numeric(12, 6),
  estimated_total_cost_usd numeric(12, 6),
  cost_category public.cost_category,
  technical_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviews_duration_nonnegative check (duration_seconds is null or duration_seconds >= 0),
  constraint interviews_reconciliation_timeout_positive check (
    transcript_reconciliation_timeout_ms is null
    or transcript_reconciliation_timeout_ms > 0
  ),
  constraint interviews_estimated_input_tokens_nonnegative check (
    estimated_input_tokens is null
    or estimated_input_tokens >= 0
  ),
  constraint interviews_estimated_output_tokens_nonnegative check (
    estimated_output_tokens is null
    or estimated_output_tokens >= 0
  ),
  constraint interviews_estimated_live_cost_nonnegative check (
    estimated_live_cost_usd is null
    or estimated_live_cost_usd >= 0
  ),
  constraint interviews_estimated_total_cost_nonnegative check (
    estimated_total_cost_usd is null
    or estimated_total_cost_usd >= 0
  ),
  constraint interviews_stable_transcript_has_timestamp check (
    transcript_status <> 'stable'
    or transcript_stabilized_at is not null
  ),
  constraint interviews_failed_transcript_has_error check (
    transcript_status <> 'failed'
    or transcript_processing_error is not null
  ),
  constraint interviews_eligible_has_supporting_objective check (
    analysis_eligibility <> 'eligible'
    or analysis_eligibility_supporting_objective is not null
  )
);

create table public.transcript_segments (
  segment_id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(interview_id) on delete cascade,
  sequence_number integer not null,
  speaker public.transcript_speaker not null,
  text text not null,
  start_time_ms integer,
  end_time_ms integer,
  provider_event_id text,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transcript_segments_sequence_positive check (sequence_number > 0),
  constraint transcript_segments_text_not_blank check (length(btrim(text)) > 0),
  constraint transcript_segments_start_nonnegative check (
    start_time_ms is null
    or start_time_ms >= 0
  ),
  constraint transcript_segments_end_nonnegative check (
    end_time_ms is null
    or end_time_ms >= 0
  ),
  constraint transcript_segments_end_after_start check (
    start_time_ms is null
    or end_time_ms is null
    or end_time_ms >= start_time_ms
  ),
  constraint transcript_segments_sequence_unique unique (interview_id, sequence_number)
);

create unique index transcript_segments_provider_event_unique
  on public.transcript_segments (interview_id, provider_event_id)
  where provider_event_id is not null;

create table public.analysis_runs (
  analysis_id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(interview_id) on delete restrict,
  status public.analysis_run_status not null default 'pending',
  analysis_model text,
  analysis_prompt_version text,
  output_specification_version text,
  structured_schema_version text,
  overall_summary text,
  primary_takeaway text,
  additional_issue text,
  overall_quality public.overall_quality,
  key_tension text,
  recurring_concern text,
  opportunity_signal text,
  emerging_signal text,
  limitations text,
  raw_structured_output jsonb,
  estimated_input_tokens integer,
  estimated_output_tokens integer,
  estimated_analysis_cost_usd numeric(12, 6),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_runs_input_tokens_nonnegative check (
    estimated_input_tokens is null
    or estimated_input_tokens >= 0
  ),
  constraint analysis_runs_output_tokens_nonnegative check (
    estimated_output_tokens is null
    or estimated_output_tokens >= 0
  ),
  constraint analysis_runs_estimated_cost_nonnegative check (
    estimated_analysis_cost_usd is null
    or estimated_analysis_cost_usd >= 0
  ),
  constraint analysis_runs_failed_has_error check (
    status <> 'failed'
    or error_message is not null
  )
);

create table public.objective_results (
  objective_result_id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analysis_runs(analysis_id) on delete cascade,
  objective public.objective not null,
  narrative_summary text not null,
  coverage public.objective_coverage not null,
  confidence public.confidence not null,
  structured_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint objective_results_summary_not_blank check (length(btrim(narrative_summary)) > 0),
  constraint objective_results_analysis_objective_unique unique (analysis_id, objective)
);

create table public.objective_result_segments (
  objective_result_id uuid not null references public.objective_results(objective_result_id) on delete cascade,
  segment_id uuid not null references public.transcript_segments(segment_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (objective_result_id, segment_id)
);

create table public.interview_quotes (
  quote_id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analysis_runs(analysis_id) on delete cascade,
  interview_id uuid not null references public.interviews(interview_id) on delete cascade,
  quote_text text not null,
  start_time_ms integer,
  objective public.objective,
  verification_status public.quote_verification_status not null default 'proposed',
  reason_selected text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interview_quotes_text_not_blank check (length(btrim(quote_text)) > 0),
  constraint interview_quotes_start_nonnegative check (
    start_time_ms is null
    or start_time_ms >= 0
  )
);

create table public.interview_quote_segments (
  quote_id uuid not null references public.interview_quotes(quote_id) on delete cascade,
  segment_id uuid not null references public.transcript_segments(segment_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (quote_id, segment_id)
);

create table public.analysis_eligibility_segments (
  interview_id uuid not null references public.interviews(interview_id) on delete cascade,
  segment_id uuid not null references public.transcript_segments(segment_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (interview_id, segment_id)
);

create table public.theme_assignments (
  theme_assignment_id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analysis_runs(analysis_id) on delete cascade,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint theme_assignments_label_not_blank check (length(btrim(label)) > 0)
);

create table public.theme_assignment_segments (
  theme_assignment_id uuid not null references public.theme_assignments(theme_assignment_id) on delete cascade,
  segment_id uuid not null references public.transcript_segments(segment_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (theme_assignment_id, segment_id)
);

create or replace function public.validate_interview_active_connections()
returns trigger
language plpgsql
as $$
begin
  if new.lifecycle_status = 'active'
    and (
      new.browser_connection_status <> 'connected'
      or new.sideband_connection_status <> 'connected'
    )
  then
    raise exception 'interview cannot be active unless browser and sideband connections are connected';
  end if;

  return new;
end;
$$;

create trigger interviews_validate_active_connections
before insert or update of lifecycle_status, browser_connection_status, sideband_connection_status
on public.interviews
for each row
execute function public.validate_interview_active_connections();

create or replace function public.validate_analysis_transcript_stable()
returns trigger
language plpgsql
as $$
declare
  parent_transcript_status public.transcript_status;
  parent_transcript_stabilized_at timestamptz;
begin
  select i.transcript_status, i.transcript_stabilized_at
  into parent_transcript_status, parent_transcript_stabilized_at
  from public.interviews i
  where i.interview_id = new.interview_id;

  if parent_transcript_status <> 'stable'
    or parent_transcript_stabilized_at is null
  then
    raise exception 'analysis cannot begin until transcript stable state is recorded';
  end if;

  return new;
end;
$$;

create trigger analysis_runs_require_stable_transcript
before insert or update of interview_id
on public.analysis_runs
for each row
execute function public.validate_analysis_transcript_stable();

create or replace function public.validate_succeeded_analysis_objective_count()
returns trigger
language plpgsql
as $$
declare
  objective_count integer;
begin
  if new.status = 'succeeded'
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    select count(*)
    into objective_count
    from public.objective_results
    where analysis_id = new.analysis_id;

    if objective_count <> 6 then
      raise exception 'succeeded analysis must have exactly six objective results';
    end if;
  end if;

  return new;
end;
$$;

create trigger analysis_runs_require_six_objective_results
before insert or update of status
on public.analysis_runs
for each row
execute function public.validate_succeeded_analysis_objective_count();

create or replace function public.prevent_objective_result_deletion_if_succeeded()
returns trigger
language plpgsql
as $$
declare
  run_status public.analysis_run_status;
begin
  select ar.status
  into run_status
  from public.analysis_runs ar
  where ar.analysis_id = old.analysis_id;

  if run_status = 'succeeded' then
    raise exception 'cannot delete objective results from a succeeded analysis run';
  end if;

  return old;
end;
$$;

create trigger objective_results_prevent_deletion_if_succeeded
before delete
on public.objective_results
for each row
execute function public.prevent_objective_result_deletion_if_succeeded();

create or replace function public.validate_eligible_interview_has_segments()
returns trigger
language plpgsql
as $$
declare
  seg_count integer;
begin
  if new.analysis_eligibility = 'eligible' then
    select count(*)
    into seg_count
    from public.analysis_eligibility_segments aes
    where aes.interview_id = new.interview_id;

    if seg_count = 0 then
      raise exception 'eligible interview must have at least one supporting segment in analysis_eligibility_segments';
    end if;
  end if;

  return new;
end;
$$;

create trigger interviews_require_eligibility_segments
before insert or update of analysis_eligibility
on public.interviews
for each row
execute function public.validate_eligible_interview_has_segments();

create or replace function public.validate_objective_result_segment()
returns trigger
language plpgsql
as $$
declare
  segment_interview_id uuid;
  segment_is_final boolean;
  result_interview_id uuid;
begin
  select ts.interview_id, ts.is_final
  into segment_interview_id, segment_is_final
  from public.transcript_segments ts
  where ts.segment_id = new.segment_id;

  select ar.interview_id
  into result_interview_id
  from public.objective_results obj
  join public.analysis_runs ar on ar.analysis_id = obj.analysis_id
  where obj.objective_result_id = new.objective_result_id;

  if segment_is_final is not true then
    raise exception 'objective result evidence must reference final transcript segments';
  end if;

  if segment_interview_id <> result_interview_id then
    raise exception 'objective result evidence must reference a segment from the same interview';
  end if;

  return new;
end;
$$;

create trigger objective_result_segments_validate_final_segment
before insert or update
on public.objective_result_segments
for each row
execute function public.validate_objective_result_segment();

create or replace function public.validate_interview_quote_segment()
returns trigger
language plpgsql
as $$
declare
  segment_interview_id uuid;
  segment_is_final boolean;
  quote_interview_id uuid;
begin
  select ts.interview_id, ts.is_final
  into segment_interview_id, segment_is_final
  from public.transcript_segments ts
  where ts.segment_id = new.segment_id;

  select iq.interview_id
  into quote_interview_id
  from public.interview_quotes iq
  where iq.quote_id = new.quote_id;

  if segment_is_final is not true then
    raise exception 'quote evidence must reference final transcript segments';
  end if;

  if segment_interview_id <> quote_interview_id then
    raise exception 'quote evidence must reference a segment from the same interview';
  end if;

  return new;
end;
$$;

create trigger interview_quote_segments_validate_final_segment
before insert or update
on public.interview_quote_segments
for each row
execute function public.validate_interview_quote_segment();

create or replace function public.validate_analysis_eligibility_segment()
returns trigger
language plpgsql
as $$
declare
  segment_interview_id uuid;
  segment_is_final boolean;
begin
  select ts.interview_id, ts.is_final
  into segment_interview_id, segment_is_final
  from public.transcript_segments ts
  where ts.segment_id = new.segment_id;

  if segment_is_final is not true then
    raise exception 'analysis eligibility evidence must reference final transcript segments';
  end if;

  if segment_interview_id <> new.interview_id then
    raise exception 'analysis eligibility evidence must reference a segment from the same interview';
  end if;

  return new;
end;
$$;

create trigger analysis_eligibility_segments_validate_final_segment
before insert or update
on public.analysis_eligibility_segments
for each row
execute function public.validate_analysis_eligibility_segment();

create or replace function public.validate_theme_assignment_segment()
returns trigger
language plpgsql
as $$
declare
  segment_interview_id uuid;
  segment_is_final boolean;
  theme_interview_id uuid;
begin
  select ts.interview_id, ts.is_final
  into segment_interview_id, segment_is_final
  from public.transcript_segments ts
  where ts.segment_id = new.segment_id;

  select ar.interview_id
  into theme_interview_id
  from public.theme_assignments ta
  join public.analysis_runs ar on ar.analysis_id = ta.analysis_id
  where ta.theme_assignment_id = new.theme_assignment_id;

  if segment_is_final is not true then
    raise exception 'theme evidence must reference final transcript segments';
  end if;

  if segment_interview_id <> theme_interview_id then
    raise exception 'theme evidence must reference a segment from the same interview';
  end if;

  return new;
end;
$$;

create trigger theme_assignment_segments_validate_final_segment
before insert or update
on public.theme_assignment_segments
for each row
execute function public.validate_theme_assignment_segment();

create trigger participants_set_updated_at
before update on public.participants
for each row
execute function public.set_updated_at();

create trigger interviews_set_updated_at
before update on public.interviews
for each row
execute function public.set_updated_at();

create trigger transcript_segments_set_updated_at
before update on public.transcript_segments
for each row
execute function public.set_updated_at();

create trigger analysis_runs_set_updated_at
before update on public.analysis_runs
for each row
execute function public.set_updated_at();

create trigger objective_results_set_updated_at
before update on public.objective_results
for each row
execute function public.set_updated_at();

create trigger interview_quotes_set_updated_at
before update on public.interview_quotes
for each row
execute function public.set_updated_at();

create trigger theme_assignments_set_updated_at
before update on public.theme_assignments
for each row
execute function public.set_updated_at();

alter table public.participants enable row level security;
alter table public.interviews enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.objective_results enable row level security;
alter table public.objective_result_segments enable row level security;
alter table public.interview_quotes enable row level security;
alter table public.interview_quote_segments enable row level security;
alter table public.analysis_eligibility_segments enable row level security;
alter table public.theme_assignments enable row level security;
alter table public.theme_assignment_segments enable row level security;

create policy participants_admin_read
on public.participants
for select
to authenticated
using (public.is_admin());

create policy interviews_staff_read
on public.interviews
for select
to authenticated
using (public.is_staff_or_admin());

create policy transcript_segments_staff_read
on public.transcript_segments
for select
to authenticated
using (public.is_staff_or_admin());

create policy analysis_runs_staff_read
on public.analysis_runs
for select
to authenticated
using (public.is_staff_or_admin());

create policy objective_results_staff_read
on public.objective_results
for select
to authenticated
using (public.is_staff_or_admin());

create policy objective_result_segments_staff_read
on public.objective_result_segments
for select
to authenticated
using (public.is_staff_or_admin());

create policy interview_quotes_staff_read
on public.interview_quotes
for select
to authenticated
using (public.is_staff_or_admin());

create policy interview_quote_segments_staff_read
on public.interview_quote_segments
for select
to authenticated
using (public.is_staff_or_admin());

create policy analysis_eligibility_segments_staff_read
on public.analysis_eligibility_segments
for select
to authenticated
using (public.is_staff_or_admin());

create policy theme_assignments_staff_read
on public.theme_assignments
for select
to authenticated
using (public.is_staff_or_admin());

create policy theme_assignment_segments_staff_read
on public.theme_assignment_segments
for select
to authenticated
using (public.is_staff_or_admin());

comment on table public.participants is
  'Layer 1 direct identifiers and confirmed profile context; access is more tightly restricted than analytical records.';

comment on table public.interviews is
  'Interview lifecycle, consent, transcript status, connection state, storage paths, and cost metadata.';

comment on table public.transcript_segments is
  'Canonical ordered transcript segments. Analysis, quote matching, and evidence references operate on this source text.';

comment on table public.analysis_runs is
  'One row per post-interview analysis attempt. Historical runs are preserved and not overwritten.';

comment on table public.objective_results is
  'Six objective records for each succeeded analysis. Absence of a row never represents non-coverage.';

comment on table public.theme_assignments is
  'Lightweight plain-language theme labels only; not a formal taxonomy.';
