import type { ShowStyleKey } from './show-styles';

type CreativeDensity = 'sparse' | 'balanced' | 'dense';

/** Song sections a brief can address directly. */
type DirectionSection = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';

export type CreativeDirection = {
  style: ShowStyleKey;
  /**
   * Density asked for across the whole show. A request aimed at named
   * sections ("keep the verses sparse") does not set this; it lands in
   * `sectionDensity`, so a sparse intro never thins the choruses.
   */
  density: CreativeDensity;
  /** Per-section density requests, overriding `density` for that section. */
  sectionDensity: Partial<Record<DirectionSection, CreativeDensity>>;
  precise: boolean;
  surprise: boolean;
  quietMiddle: boolean;
  softEnding: boolean;
  bigEnding: boolean;
};

const SPARSE_PHRASES = [
  'minimalist',
  'minimal',
  'sparse',
  'restrained',
  'understated',
  'room to breathe',
  'breathing room',
  'quieter',
  'light touch',
  'hold back',
  'held back',
  'stripped back',
  'stripped-back',
];

const DENSE_PHRASES = [
  'relentless',
  'nonstop',
  'non-stop',
  'dense',
  'high energy',
  'full sky',
  'all out',
  'fuller',
  'busier',
  'bigger',
  'heavier',
  'energetic',
  'wall of fireworks',
];

const SECTION_ALIASES: Record<DirectionSection, string[]> = {
  intro: ['intro', 'introduction', 'opening', 'opener', 'beginning'],
  verse: ['verse'],
  chorus: ['chorus', 'refrain', 'hook', 'drop'],
  bridge: ['bridge', 'breakdown', 'middle eight', 'middle 8'],
  outro: ['outro', 'coda'],
};

// A density word preceded by one of these within a few words is a request
// for the opposite, or no request at all ("not too sparse", "avoid a wall").
const NEGATIONS = [
  'not',
  'no',
  'never',
  'avoid',
  'without',
  "don't",
  'dont',
  'nothing',
  'rather than',
];
const NEGATION_LOOKBACK_WORDS = 4;

// Clause boundaries inside a sentence. A density word scopes to the sections
// named in its own clause, so "sparse ... so the choruses land" stays global.
const CLAUSE_BREAK =
  /,|;|:|\bbut\b|\bwhile\b|\bwhereas\b|\bthen\b|\bso that\b|\bso\b|\bbecause\b|\band (?=(?:the|a|an|in|for|during|on|at)\b)/;
// "sparse except the chorus": the head is global, the named sections are exempt.
const EXCEPTION_BREAK =
  /\bexcept(?: for| in)?\b|\bapart from\b|\bother than\b|\baside from\b|\bsave for\b|\bbut not\b/;
// "In the verses, keep it sparse": a short scoping clause lends its sections to the next.
const SCOPE_LEAD = /^\s*(?:in|for|during|throughout|through|over|on|at|across)\b/;
const SCOPE_LEAD_MAX_WORDS = 6;
const BARE_SECTION_MAX_WORDS = 3;

type Clause = { text: string; exception: boolean };

/** Deterministic interpretation shared by fast planning and focused tests. */
export function parseCreativeDirection(text: string, style: ShowStyleKey): CreativeDirection {
  const normalised = text.toLowerCase();
  const { density, sectionDensity } = parseDensity(normalised);
  return {
    style,
    density,
    sectionDensity,
    precise: includesAny(normalised, [
      'precise',
      'on beat',
      'on-beat',
      'beat synced',
      'beat-synced',
      'exact on beat',
      'exact on the beat',
      'synchronised',
      'synchronized',
    ]),
    surprise: includesAny(normalised, ['surprise', 'unexpected', 'false ending', 'fake ending']),
    quietMiddle: includesAny(normalised, [
      'quiet midpoint',
      'quiet middle',
      'quiet moment',
      'moment of quiet',
      'midpoint pause',
      'moment of silence',
    ]),
    softEnding: includesAny(normalised, ['soft ending', 'gentle ending', 'fade out', 'taper out']),
    bigEnding: includesAny(normalised, [
      'big finale',
      'huge finale',
      'massive finale',
      'crackling finale',
      'fills the sky',
      'all-out finale',
    ]),
  };
}

/** Resolve the request for a canonical analysed section, preserving the global default. */
export function densityForSection(direction: CreativeDirection, section: string): CreativeDensity {
  switch (section) {
    case 'intro':
    case 'verse':
    case 'chorus':
    case 'bridge':
    case 'outro':
      return direction.sectionDensity?.[section] ?? direction.density;
    case 'drop':
      return direction.sectionDensity?.chorus ?? direction.density;
    default:
      return direction.density;
  }
}

/** Global and per-section density from scoped, negation-aware phrase matching. */
function parseDensity(normalised: string): Pick<CreativeDirection, 'density' | 'sectionDensity'> {
  let globalSparse = false;
  let globalDense = false;
  const sectionDensity: Partial<Record<DirectionSection, CreativeDensity>> = {};
  for (const sentence of normalised.split(/[.!?\n]+/)) {
    // Sections named by a clause that lends its scope to the next one.
    let carried: DirectionSection[] = [];
    // The last scoped request, so "sparse in the intro and the bridge" reaches the bridge.
    let lastScoped: CreativeDensity | null = null;
    let exempt: DirectionSection[] = [];
    for (const clause of splitClauses(sentence)) {
      const named = sectionsIn(clause.text);
      const requested = densityIn(clause.text);
      if (clause.exception) exempt = exempt.concat(named);
      if (requested === null) {
        if (named.length > 0 && lastScoped !== null && isBareSectionReference(clause.text)) {
          for (const section of named) sectionDensity[section] = lastScoped;
        }
        carried = named.length > 0 && (clause.exception || isScopeLead(clause.text)) ? named : [];
        continue;
      }
      const scope = named.length > 0 ? named : carried;
      carried = [];
      lastScoped = scope.length > 0 ? requested : null;
      // An unscoped request inside an exception clause names no section to
      // apply to, so it is dropped rather than promoted to the whole show.
      if (scope.length === 0 && !clause.exception) {
        if (requested === 'sparse') globalSparse = true;
        else globalDense = true;
      }
      for (const section of scope) sectionDensity[section] = requested;
    }
    for (const section of exempt) sectionDensity[section] ??= 'balanced';
  }
  return {
    density: globalSparse ? 'sparse' : globalDense ? 'dense' : 'balanced',
    sectionDensity,
  };
}

function splitClauses(sentence: string): Clause[] {
  const clauses: Clause[] = [];
  for (const [index, part] of sentence.split(EXCEPTION_BREAK).entries()) {
    for (const text of part.split(CLAUSE_BREAK)) {
      if (text.trim()) clauses.push({ text, exception: index > 0 });
    }
  }
  return clauses;
}

function isScopeLead(clause: string): boolean {
  return SCOPE_LEAD.test(clause) && wordCount(clause) <= SCOPE_LEAD_MAX_WORDS;
}

/** "the bridge", "and the choruses": a clause that only names sections. */
function isBareSectionReference(clause: string): boolean {
  return wordCount(clause) <= BARE_SECTION_MAX_WORDS;
}

function wordCount(clause: string): number {
  return clause.trim().split(/\s+/).length;
}

function sectionsIn(clause: string): DirectionSection[] {
  const found: DirectionSection[] = [];
  for (const [section, aliases] of Object.entries(SECTION_ALIASES) as [
    DirectionSection,
    string[],
  ][]) {
    if (aliases.some((alias) => new RegExp(`\\b${alias}(?:e?s)?\\b`).test(clause)))
      found.push(section);
  }
  return found;
}

/** The density a clause asks for, with sparse winning a tie as it always has; null when none. */
function densityIn(clause: string): CreativeDensity | null {
  if (SPARSE_PHRASES.some((phrase) => affirmed(clause, phrase))) return 'sparse';
  if (DENSE_PHRASES.some((phrase) => affirmed(clause, phrase))) return 'dense';
  return null;
}

/** Whether `phrase` occurs in the clause without a negation just before it. */
function affirmed(clause: string, phrase: string): boolean {
  let at = clause.indexOf(phrase);
  while (at !== -1) {
    const lead = clause.slice(0, at).trim().split(/\s+/).slice(-NEGATION_LOOKBACK_WORDS).join(' ');
    if (!NEGATIONS.some((negation) => new RegExp(`\\b${negation}\\b`).test(lead))) return true;
    at = clause.indexOf(phrase, at + phrase.length);
  }
  return false;
}

function includesAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase));
}
