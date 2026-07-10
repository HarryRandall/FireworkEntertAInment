-- Cover posters are now captured as downscaled JPEGs (a full-res PNG of a
-- noisy shader frame regularly blew past the 5MB object limit). Allow JPEG
-- uploads to the public covers bucket alongside the existing PNGs.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg']
where id = 'covers';
