/**
 * Static preview data for retailer-admin sections that have no backend yet
 * (Overview, Usage, Credits — see FIR-166). Assortments are real, account-scoped
 * data now (see _lib/assortments.server.ts). Every page that imports from
 * here must show the "preview data" notice so admins don't mistake these
 * numbers for a real retailer account.
 */

export const DUMMY_CREDIT_BALANCE = 2480;

export const DUMMY_OVERVIEW_STATS = {
  creditsRemaining: DUMMY_CREDIT_BALANCE,
  creditsRemainingHint: '~12 days at this rate',
  showsToday: 34,
  showsTodayHint: '+6 vs yesterday',
  activeAssortments: 5,
  activeAssortmentsHint: 'live in-store',
  avgCreditsPerShow: 6.2,
  avgCreditsPerShowHint: 'fast planner',
};

export const DUMMY_SHOWS_LAST_14_DAYS = [
  52, 64, 44, 76, 60, 70, 50, 82, 58, 66, 74, 62, 80, 100,
];

export const DUMMY_RECENT_ACTIVITY = [
  { text: 'Show generated · Comet Trail Assortment', amount: '6cr', time: '5m' },
  { text: 'Assortment updated · Backyard Bash', amount: null, time: '1h' },
  { text: 'Credits topped up', amount: '+1,000', time: 'Yesterday' },
  { text: 'Product added · Gold Willow Single Shot', amount: null, time: '2d' },
];

export const DUMMY_USAGE_LAST_7_DAYS = [45, 60, 38, 70, 55, 65, 90];

export const DUMMY_USAGE_STATS = {
  showsThisWeek: 212,
  creditsSpentThisWeek: 1384,
};

export const DUMMY_TOP_ASSORTMENTS_BY_USAGE = [
  { name: 'Comet Trail Assortment', shows: 84, credits: 512 },
  { name: 'Backyard Bash', shows: 61, credits: 378 },
  { name: 'Sparkler Starter', shows: 44, credits: 264 },
  { name: 'Grand Finale Pack', shows: 23, credits: 230 },
];

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
