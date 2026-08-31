/**
 * Static preview data for retailer-admin sections that have no backend yet
 * (Overview's credit/show stats, Credits — see FIR-166). Assortments are
 * real, shared data from FIR-178's /admin/assortments (see
 * @/lib/admin/assortments.server), and Overview's "active assortments" stat
 * and recent-activity feed are derived from that real data rather than
 * faked. Every page that imports from here must show the "preview data"
 * notice so admins don't mistake the remaining numbers for real usage.
 */

export const DUMMY_CREDIT_BALANCE = 2480;

export const DUMMY_OVERVIEW_STATS = {
  creditsRemaining: DUMMY_CREDIT_BALANCE,
  creditsRemainingHint: '~12 days at this rate',
  showsToday: 34,
  showsTodayHint: '+6 vs yesterday',
  avgCreditsPerShow: 6.2,
  avgCreditsPerShowHint: 'fast planner',
};

export const DUMMY_SHOWS_LAST_14_DAYS = [52, 64, 44, 76, 60, 70, 50, 82, 58, 66, 74, 62, 80, 100];

export type DummyCreditTier = {
  credits: number;
  price: string;
  popular?: boolean;
};

export const DUMMY_CREDIT_TIERS: DummyCreditTier[] = [
  { credits: 500, price: '$45' },
  { credits: 2000, price: '$160', popular: true },
  { credits: 10000, price: '$700' },
];
