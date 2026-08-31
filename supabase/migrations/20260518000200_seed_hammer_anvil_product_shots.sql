-- Seed product_shots for Hammer & Anvil products that had none.
-- Shot counts are estimated from duration (~1 shot per 1.7s for 30mm, 1.5s for 25mm, 1.3s for 20mm).
-- Effect specs are mapped from product color/name. Timings are evenly spaced from 0 to duration_seconds.

WITH config (part_number, caliber, effect_spec_slug, n_shots) AS (
  VALUES
    ('CS642401 A',  '1.87in',  'fib-blue',     1),
    ('CS642401 B',  '1.87in',  'wave-purple',   1),
    ('CS642401 C',  '1.87in',  'fib-red',       1),
    ('CS642401 D',  '1.87in',  'strobe-white',  1),
    ('CS642401 E',  '1.87in',  'fib-red',       1),
    ('CS642401 F',  '1.87in',  'fib-blue',      1),
    ('CS642401 G',  '1.87in',  'fib-blue',      1),
    ('CS642401 H',  '1.87in',  'fib-red',       1),
    ('CS642401 I',  '1.87in',  'fib-red',       1),
    ('CS642401 J',  '1.87in',  'fib-blue',      1),
    ('CS642401 K',  '1.87in',  'fib-red',       1),
    ('CS642401 L',  '1.87in',  'fib-green',     1),
    ('HAC201602',   '30mm',    'fib-gold',      16),
    ('HAC201605',   '30mm',    'wave-purple',   16),
    ('HAC201606',   '30mm',    'fib-gold',      16),
    ('HAC201607',   '30mm',    'strobe-white',  16),
    ('HAC201608',   '30mm',    'strobe-mixed',  16),
    ('HAC201609',   '30mm',    'fib-red',       16),
    ('HAC202301',   '20mm',    'wave-rainbow',  18),
    ('HAC202302',   '30mm',    'wave-rainbow',   9),
    ('HAC203201',   '30mm',    'wave-rainbow',  15),
    ('HAC501101',   '30mm',    'wave-rainbow',  24),
    ('HAC502403',   '30mm',    'strobe-mixed',  14),
    ('HAC502404',   '30mm',    'strobe-mixed',  19),
    ('HAC502405',   '30mm',    'fib-red',       10),
    ('HAC502406',   '25mm',    'wave-rainbow',  13),
    ('HAC502407',   '30mm',    'strobe-white',  20),
    ('HAC502408',   '25mm',    'strobe-mixed',  12),
    ('HAC502409',   '25mm',    'wave-rainbow',  17),
    ('HAC502501',   '30mm',    'strobe-mixed',  25),
    ('HAC502502',   '30mm',    'wave-rainbow',  12),
    ('HAC502701',   '30mm',    'wave-rainbow',  27),
    ('HAC503001',   '30mm',    'strobe-mixed',  15),
    ('HAC503002',   '25mm',    'strobe-mixed',  19),
    ('HAC503301',   '30mm',    'wave-rainbow',  23),
    ('HAC503401',   '30mm',    'wave-rainbow',  14),
    ('HAC503601',   '30mm',    'wave-rainbow',  17),
    ('HAC503602',   '30mm',    'wave-rainbow',  11),
    ('HAC504001',   '30mm',    'fib-red',       16),
    ('HAC504601',   '30mm',    'strobe-mixed',  17),
    ('HAC505101',   '30mm',    'wave-rainbow',  21),
    ('HAC505201',   '30mm',    'wave-rainbow',  17),
    ('HAC508001',   '1.8in',   'wave-purple',    8),
    ('HAC5A1A',     '25mm',    'fib-blue',      25),
    ('HAC5A1B',     '25mm',    'fib-blue',      24),
    ('HAC5A1C',     '25mm',    'strobe-white',  23)
)
INSERT INTO product_shots (product_id, shot_index, caliber, time_offset_seconds, effect_spec_id, pan_degrees)
SELECT
  p.id,
  gs.i AS shot_index,
  c.caliber,
  ROUND(((gs.i - 1)::numeric * p.duration_seconds / c.n_shots), 3) AS time_offset_seconds,
  es.id AS effect_spec_id,
  0 AS pan_degrees
FROM config c
JOIN products p ON p.part_number = c.part_number
JOIN effect_specs es ON es.slug = c.effect_spec_slug
CROSS JOIN generate_series(1, c.n_shots) AS gs(i)
WHERE NOT EXISTS (
  SELECT 1 FROM product_shots ps WHERE ps.product_id = p.id
);
