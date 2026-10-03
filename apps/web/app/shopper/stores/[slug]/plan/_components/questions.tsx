/** Five prototype questions use the shared kit's keyboard-operable controls. */
'use client';
import { RadioCards, Chips } from '@/ui/kit/choices';
import { Slider } from '@/ui/kit/number-controls';
import { formatPrice } from '@/lib/shopper/paths';
import {
  PLANNER_LIMITS,
  shopperAnswersSchema,
  type ShopperAnswers,
} from '@/lib/shopper/planner/contracts';

const NOISE_QUESTION = 3; // Zero-based prototype question index.
const OCCASIONS = ['Bonfire Night', 'New Year', 'Diwali', 'Birthday', 'Wedding', 'Just because'];
const LOOKS = ['Gold', 'Colour', 'Silver', 'Crackle', 'Willow', 'Comets', 'Shapes', 'Rockets'];
const GARDENS = [
  { value: 'small', title: 'Small garden' },
  { value: 'medium', title: 'Medium garden' },
  { value: 'large', title: 'Field or large garden' },
];
const NOISE = [
  { value: 'quiet', title: 'Quiet', description: 'No bangs, crackle or whistles.' },
  { value: 'normal', title: 'Normal', description: 'Some crackle and a few bangs.' },
  { value: 'loud', title: 'Go big', description: 'Crackle, bangs and a loud finale.' },
];
/** Prototype headings describe each question without hiding the safety implications. */
export const QUESTION_TITLES = [
  "What's the occasion?",
  'How much space do you have?',
  "What's your budget?",
  'How loud?',
  'What do you love?',
];
/** Edits only the displayed answer; distances come from the store's market reference bands. */
export function QuestionControls({
  question,
  answers,
  bands,
  onChange,
}: {
  question: number;
  answers: ShopperAnswers;
  bands: readonly { band: string; max_distance_m: number }[];
  onChange: (answers: ShopperAnswers) => void;
}) {
  switch (question) {
    case 0:
      return (
        <RadioCards
          label="Occasion"
          items={OCCASIONS.map((title) => ({ value: title, title }))}
          value={answers.occasion}
          onChange={(occasion) => {
            onChange(shopperAnswersSchema.parse({ ...answers, occasion }));
          }}
        />
      );
    case 1:
      return (
        <RadioCards
          label="Garden size"
          items={GARDENS.map((item) => ({
            ...item,
            description: `You can keep people at least ${String(bands.find((band) => band.band === item.value)?.max_distance_m)} m away.`,
          }))}
          value={answers.garden}
          onChange={(garden) => {
            if (garden === 'small' || garden === 'medium' || garden === 'large')
              onChange({ ...answers, garden });
          }}
        />
      );
    case 2:
      return (
        <Slider
          label="Up to"
          value={answers.budget_minor}
          min={PLANNER_LIMITS.budgetMin}
          max={PLANNER_LIMITS.budgetMax}
          step={PLANNER_LIMITS.budgetStep}
          format={(value) => formatPrice(value, answers.currency)}
          onChange={(budget_minor) => {
            onChange({ ...answers, budget_minor });
          }}
        />
      );
    case NOISE_QUESTION:
      return (
        <RadioCards
          label="Noise"
          items={NOISE}
          value={answers.noise}
          onChange={(noise) => {
            if (noise === 'quiet' || noise === 'normal' || noise === 'loud')
              onChange({ ...answers, noise });
          }}
        />
      );
    default:
      return (
        <div className="grid gap-6">
          <Chips
            label="Favourite looks"
            items={LOOKS}
            value={answers.looks}
            onChange={(looks) => {
              onChange(shopperAnswersSchema.parse({ ...answers, looks }));
            }}
          />
          <Slider
            label="How long?"
            value={answers.length_min}
            min={PLANNER_LIMITS.lengthMin}
            max={PLANNER_LIMITS.lengthMax}
            format={(value) => `${String(value)} min`}
            onChange={(length_min) => {
              onChange({ ...answers, length_min });
            }}
          />
          <p className="text-muted-foreground text-sm">
            Pick as many looks as you like. Length is a target; stock, safety and your budget come
            first.
          </p>
        </div>
      );
  }
}
