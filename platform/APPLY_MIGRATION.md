# Database migrations

Apply the pending Supabase migrations before testing the new show flow.

The relevant new migration is:

```text
supabase/migrations/20260525090000_music_analyses_show_generation.sql
```

It adds upload-scoped `music_analyses` rows, links shows to
`music_analysis_id`, and moves show-generation status onto `shows`.
