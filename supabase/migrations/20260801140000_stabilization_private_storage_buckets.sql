insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'interview-audio',
    'interview-audio',
    false,
    52428800,
    array[
      'audio/mpeg',
      'audio/mp4',
      'audio/webm',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg'
    ]
  ),
  (
    'interview-transcripts',
    'interview-transcripts',
    false,
    5242880,
    array[
      'application/json',
      'text/plain'
    ]
  )
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are added in this MVP readiness migration.
-- Direct object access remains unavailable to anon/authenticated clients.
