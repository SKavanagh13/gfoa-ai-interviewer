alter table public.interviews
add column continuation_consented_at timestamptz;

comment on column public.interviews.continuation_consented_at is
  'Timestamp when the participant affirmatively agreed to continue past the 15-minute target.';
