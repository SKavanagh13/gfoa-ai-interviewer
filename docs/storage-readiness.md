# Private Storage Readiness

This MVP uses two Supabase Storage buckets for interview-derived files:

- `interview-audio`
- `interview-transcripts`

Both buckets are created as private buckets by
`supabase/migrations/20260801140000_stabilization_private_storage_buckets.sql`.
The migration does not add `storage.objects` policies for `anon` or
`authenticated`, so direct browser/client access to objects is not enabled.

## MVP Access Decision

Admin review displays stored object paths only. It does not expose public URLs,
download links, playable audio, or transcript-file downloads.

The canonical transcript for MVP review remains `transcript_segments`. Any
transcript file in Storage is a derived serialization, not an independent
source of truth.

## Future Signed Access Requirement

If pilot operations require reading stored audio or transcript files through
the app, add a server-only route that:

1. requires `requireStaffOrAdmin()`;
2. verifies the requested path belongs to the selected interview;
3. creates a short-lived signed URL with the service-role client;
4. does not expose the service-role key to browser code;
5. logs only interview IDs, bucket names, and object paths, not secrets or full
   transcript contents.

Do not make either bucket public for pilot use.
