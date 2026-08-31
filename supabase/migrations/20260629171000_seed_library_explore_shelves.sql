-- Expand the public Explore library so each shelf can show 30 unique presets.
WITH shelf_seed_sections AS (
  SELECT *
  FROM (
    VALUES
      (
        'featured',
        'Staff picks',
        'curated staff-pick',
        2000,
        true,
        ARRAY[
          'Starlight Harbour',
          'Velvet Crown',
          'Glass Sky Overture',
          'Moonlit Circuit',
          'Halo Parade',
          'Silver Cathedral',
          'Prism Arcadia',
          'Northern Applause',
          'Opal Runway',
          'Celestial Bloom',
          'Signal Garden',
          'Riviera Finale',
          'Diamond Horizon',
          'Twilight Architects',
          'Cloudline Sonata',
          'Orbit Garden',
          'Radiant Atrium',
          'Summit Lanterns',
          'Blue Hour Crown',
          'Aurora Assembly',
          'Satin Comets',
          'Sapphire Promenade',
          'Golden Observatory',
          'Lantern Meridian',
          'Crystal Wake',
          'Luminous Assembly',
          'Crown Geometry',
          'Midnight Atrium',
          'Harbour Overture',
          'Brilliant Signal'
        ]::text[],
        ARRAY[
          'polished silver palms with blue accents',
          'premium halo bursts and soft strobes',
          'cinematic comets with a broad finale',
          'elegant willows with crisp white lifts',
          'layered rings and sapphire trails',
          'balanced gold crowns and cool shimmer',
          'architectural palms with clean timing',
          'wide sky blooms with silver returns',
          'quiet build into a brilliant finish',
          'formal colour changes and strobe detail'
        ]::text[],
        ARRAY[
          'palm-default',
          'kamuro-default',
          'ring-azure',
          'strobe-default',
          'brocade-default',
          'willow-default',
          'peony-azure',
          'double_break-default'
        ]::text[]
      ),
      (
        'popular',
        'Popular this month',
        'crowd favourite',
        3000,
        false,
        ARRAY[
          'Crowd Chorus',
          'Stadium Bloom',
          'Festival Relay',
          'Neon County Fair',
          'Balcony Anthem',
          'Summer Pulse',
          'Rooftop Cheers',
          'Night Market Pop',
          'Coastline Party',
          'Fireline Social',
          'Electric Picnic',
          'Citywide Spark',
          'Dancefloor Skyline',
          'Carnival Ribbon',
          'Weekend Ignition',
          'Sunset Rally',
          'Common Ground',
          'Pop Parade',
          'Harbour Cheers',
          'Garden Party Rise',
          'Main Stage Glitter',
          'Streetlight Finale',
          'Open Air Applause',
          'Metro Firefall',
          'Field Song',
          'Bright Side Crowd',
          'Confetti Heights',
          'Big Tent Bloom',
          'Lantern Crowd',
          'Uplift Avenue'
        ]::text[],
        ARRAY[
          'crowd-friendly peonies with bright rings',
          'festival colour hits and tidy mines',
          'open-air palms with a pop finish',
          'family-friendly bursts and blue returns',
          'cheerful red and gold transitions',
          'danceable comet lines with quick lifts',
          'broad blooms for backyards and parks',
          'simple high-contrast effects for groups',
          'classic party timing with silver accents',
          'bright finales built for repeat previews'
        ]::text[],
        ARRAY[
          'peony-crimson',
          'ring-azure',
          'chrysanthemum-default',
          'crossette-default',
          'mine-default',
          'palm-default',
          'strobe-default',
          'peony-azure'
        ]::text[]
      ),
      (
        'hot',
        'Hot right now',
        'high-energy',
        4000,
        false,
        ARRAY[
          'Ignition Rush',
          'Voltage Wave',
          'Redline Choir',
          'Afterburn Arcade',
          'Thunder Ladder',
          'Pulse Engine',
          'Shockwave Bloom',
          'Nitro Palms',
          'Bassline Barrage',
          'Skyline Trigger',
          'White Hot Signal',
          'Turbo Garden',
          'Rapid Crown',
          'Fusebreaker',
          'Wildline Spiral',
          'Neon Detonation',
          'Heat Map',
          'Spark Driver',
          'High Noon Night',
          'Rocket Dial',
          'Strike Pattern',
          'Flare Circuit',
          'Overdrive Moon',
          'Strobe Riot',
          'Velocity Field',
          'Sharp Finale',
          'Kinetic Bloom',
          'Thunder Mesh',
          'Bright Impact',
          'Last Beat Flash'
        ]::text[],
        ARRAY[
          'fast crimson mines with white strobe hits',
          'dense crossettes and tight finale timing',
          'loud crackle lines with red peonies',
          'rapid comet runs and bold ring accents',
          'heavy mines with quick colour changes',
          'bass-ready pulses and sharp strobes',
          'aggressive palms with short pauses',
          'high-contrast blasts for loud tracks',
          'hot red trails with electric blue relief',
          'finale-heavy timing from the first beat'
        ]::text[],
        ARRAY[
          'mine-default',
          'crackle-crimson',
          'crossette-crimson',
          'strobe-crimson',
          'comet-crimson',
          'ring-crimson',
          'peony-crimson',
          'whirl-azure'
        ]::text[]
      ),
      (
        'recent',
        'Fresh drops',
        'freshly published',
        5000,
        false,
        ARRAY[
          'Fresh Horizon',
          'New Moon Garden',
          'First Light Circuit',
          'Tomorrow Bloom',
          'Soft Launch Sky',
          'Modern Willow',
          'Rain Glass',
          'Blue Draft',
          'Orchard Signal',
          'Crescent Field',
          'Clean Slate Crown',
          'Quiet Neon',
          'Studio Sparks',
          'North Pier Glow',
          'Morning Afterglow',
          'Polished Echo',
          'Garden Prototype',
          'Future Lanterns',
          'Arrival Sequence',
          'Silver Notebook',
          'New Coastline',
          'Preview Bloom',
          'Paper Lantern Demo',
          'Ripple Theatre',
          'Light Study',
          'Open Sketch',
          'Vivid Trial',
          'Comet Notebook',
          'Pale Signal',
          'Next Night'
        ]::text[],
        ARRAY[
          'fresh cyan trails with soft willow lifts',
          'new blue peonies and calm silver falls',
          'clean comet timing with gentle rings',
          'modern pastel colour and low noise',
          'soft garden breaks with bright edges',
          'cool-toned rehearsal pacing',
          'new-show balance for quick cloning',
          'lightweight drama with tidy spacing',
          'smooth preview arcs and silver detail',
          'recently tuned cues with a crisp close'
        ]::text[],
        ARRAY[
          'comet-azure',
          'pearls-default',
          'willow-default',
          'ring-default',
          'pistil-azure',
          'peony-default',
          'waterfall-azure',
          'nishiki-default'
        ]::text[]
      ),
      (
        'shortest',
        'Quick bursts',
        'quick burst',
        6000,
        false,
        ARRAY[
          'Spark Shot',
          'Tiny Crown',
          'One-Minute Bloom',
          'Quick Lantern',
          'Flash Garden',
          'Pocket Finale',
          'Ten Beat Pop',
          'Micro Halo',
          'Short Fuse Suite',
          'Mini Meridian',
          'Snap Willow',
          'Swift Peony',
          'Little Orbit',
          'Blink Parade',
          'Crisp Comets',
          'Minute Market',
          'Small Applause',
          'Tap Burst',
          'Brief Aurora',
          'Quick Silver',
          'Pop Sprint',
          'Signal Clip',
          'Small Skyline',
          'Short Garden',
          'Pocket Pulse',
          'Little Finale',
          'Fast Crown',
          'Tight Bloom',
          'Micro Parade',
          'Final Spark'
        ]::text[],
        ARRAY[
          'compact comet hits with a neat finale',
          'short peonies and clean mine accents',
          'quick rings for brief music clips',
          'small-yard timing with bright colour',
          'tiny palms and fast silver shimmer',
          'low-budget bursts with clear spacing',
          'snappy crossettes and a crisp close',
          'short blue trails with a tidy lift',
          'one-minute energy with no filler',
          'brief family-friendly colour changes'
        ]::text[],
        ARRAY[
          'comet-default',
          'mine-default',
          'ring-default',
          'pearls-default',
          'peony-azure',
          'strobe-default',
          'crossette-default',
          'whirl-azure'
        ]::text[]
      )
  ) AS section(
    section_key,
    section_label,
    section_phrase,
    sort_base,
    is_featured_section,
    titles,
    themes,
    firework_slugs
  )
),
expanded_seed AS (
  SELECT
    section_key,
    section_label,
    section_phrase,
    sort_base,
    is_featured_section,
    item_order,
    titles[item_order] AS title,
    themes[((item_order - 1) % array_length(themes, 1)) + 1] AS theme,
    firework_slugs,
    (ARRAY['mesh-gradient', 'warp', 'grain-gradient', 'simplex-noise', 'god-rays'])[
      ((item_order - 1) % 5) + 1
    ] AS cover_kind,
    CASE (item_order - 1) % 8
      WHEN 0 THEN ARRAY['#00e5ff', '#3b82f6', '#8b5cf6', '#ff3df2']
      WHEN 1 THEN ARRAY['#33fff5', '#4d9fe8', '#f4f1ea', '#8b5cf6']
      WHEN 2 THEN ARRAY['#ff4d6d', '#ffd166', '#00e5ff', '#2ec487']
      WHEN 3 THEN ARRAY['#8b5cf6', '#ff3df2', '#4d9fe8', '#f5f7fa']
      WHEN 4 THEN ARRAY['#2ec487', '#00e5ff', '#7bc850', '#3b82f6']
      WHEN 5 THEN ARRAY['#e86fa0', '#ffd1e0', '#4d9fe8', '#7bc850']
      WHEN 6 THEN ARRAY['#ffd166', '#f4f1ea', '#4d9fe8', '#8b5cf6']
      ELSE ARRAY['#3b82f6', '#00e5ff', '#33fff5', '#f5f7fa']
    END AS colors
  FROM shelf_seed_sections
  CROSS JOIN generate_series(1, 30) AS item(item_order)
),
seed_with_metrics AS (
  SELECT
    *,
    CASE section_key
      WHEN 'featured' THEN 150 + ((item_order - 1) % 7) * 15
      WHEN 'popular' THEN 120 + ((item_order - 1) % 8) * 12
      WHEN 'hot' THEN 75 + ((item_order - 1) % 8) * 10
      WHEN 'recent' THEN 105 + ((item_order - 1) % 7) * 12
      ELSE 45 + ((item_order - 1) % 6) * 10
    END AS duration_seconds,
    CASE section_key
      WHEN 'featured' THEN 22 + ((item_order - 1) % 9)
      WHEN 'popular' THEN 18 + ((item_order - 1) % 8)
      WHEN 'hot' THEN 20 + ((item_order - 1) % 9)
      WHEN 'recent' THEN 14 + ((item_order - 1) % 8)
      ELSE 8 + ((item_order - 1) % 6)
    END AS effects_count,
    CASE section_key
      WHEN 'featured' THEN 16000 + item_order * 430
      WHEN 'popular' THEN 9500 + item_order * 260
      WHEN 'hot' THEN 8500 + item_order * 240
      WHEN 'recent' THEN 8000 + item_order * 210
      ELSE 3800 + item_order * 120
    END AS budget_cents,
    CASE
      WHEN section_key = 'recent' AND item_order % 3 = 0 THEN 'Dusk'
      WHEN section_key = 'shortest' AND item_order % 2 = 0 THEN 'Dusk'
      ELSE 'Night'
    END AS time_of_day
  FROM expanded_seed
)
INSERT INTO show_presets (
  slug,
  title,
  theme,
  description,
  duration_seconds,
  budget_cents,
  total_cents,
  effects_count,
  time_of_day,
  mood_tags,
  preview_cues,
  is_featured,
  sort_order,
  cover_shader
)
SELECT
  'library-' || section_key || '-' || lpad(item_order::text, 2, '0') || '-' ||
    trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')) AS slug,
  title,
  theme,
  format(
    'A %s library show with %s. Built for quick browsing, preview playback and cloning.',
    section_phrase,
    theme
  ) AS description,
  duration_seconds,
  budget_cents,
  (budget_cents * (0.74 + ((item_order % 6)::numeric * 0.025)))::int AS total_cents,
  effects_count,
  time_of_day,
  ARRAY[
    section_label,
    CASE (item_order - 1) % 5
      WHEN 0 THEN 'Colourful'
      WHEN 1 THEN 'Elegant'
      WHEN 2 THEN 'High energy'
      WHEN 3 THEN 'Cinematic'
      ELSE 'Family friendly'
    END,
    CASE
      WHEN duration_seconds <= 75 THEN 'Short'
      WHEN budget_cents >= 18000 THEN 'Premium'
      ELSE 'Preview ready'
    END
  ]::text[] AS mood_tags,
  preview.preview_cues,
  is_featured_section,
  sort_base + item_order,
  jsonb_build_object('kind', cover_kind, 'colors', to_jsonb(colors)) AS cover_shader
FROM seed_with_metrics
CROSS JOIN LATERAL (
  WITH cue_source AS (
    SELECT
      cue_index,
      firework_slugs[((cue_index - 1) % array_length(firework_slugs, 1)) + 1] AS firework_slug
    FROM generate_series(1, effects_count) AS cue(cue_index)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'timeSeconds',
      greatest(2, floor((duration_seconds::numeric / (effects_count + 1)) * cue_index)::int),
      'fireworkSlug',
      firework_slug,
      'description',
      initcap(replace(split_part(firework_slug, '-', 1), '_', ' ')) || ' cue'
    )
    ORDER BY cue_index
  ) AS preview_cues
  FROM cue_source
) AS preview
ON CONFLICT (slug) DO UPDATE SET
  title = excluded.title,
  theme = excluded.theme,
  description = excluded.description,
  duration_seconds = excluded.duration_seconds,
  budget_cents = excluded.budget_cents,
  total_cents = excluded.total_cents,
  effects_count = excluded.effects_count,
  time_of_day = excluded.time_of_day,
  mood_tags = excluded.mood_tags,
  preview_cues = excluded.preview_cues,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  cover_shader = excluded.cover_shader,
  updated_at = now();
