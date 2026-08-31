-- Enforce the same audio upload contract at the Storage bucket level that the
-- browser wizard and music-analysis endpoint already validate.
update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/aac',
    'audio/mp4',
    'audio/x-m4a'
  ]
where id = 'audio';
