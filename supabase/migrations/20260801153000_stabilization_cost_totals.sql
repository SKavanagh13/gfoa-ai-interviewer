create or replace function public.refresh_interview_total_cost(
  p_interview_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  live_cost numeric(12, 6);
  analysis_cost numeric(12, 6);
begin
  select estimated_live_cost_usd
  into live_cost
  from public.interviews
  where interview_id = p_interview_id
  for update;

  if not found then
    raise exception 'interview not found';
  end if;

  select coalesce(sum(estimated_analysis_cost_usd), 0)::numeric(12, 6)
  into analysis_cost
  from public.analysis_runs
  where interview_id = p_interview_id;

  update public.interviews
  set estimated_total_cost_usd =
    case
      when live_cost is null and analysis_cost = 0 then null
      else (coalesce(live_cost, 0) + analysis_cost)::numeric(12, 6)
    end
  where interview_id = p_interview_id;
end;
$$;

revoke all on function public.refresh_interview_total_cost(uuid)
from public, anon, authenticated;

grant execute on function public.refresh_interview_total_cost(uuid)
to service_role;

comment on function public.refresh_interview_total_cost(uuid) is
  'Recomputes interview-level total estimated cost from live cost plus every analysis-run cost for the interview, including failed or rerun attempts when usage is available.';
