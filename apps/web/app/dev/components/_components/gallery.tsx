/** Responsive anchored component catalogue with explicit theme choices. */
'use client';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Select } from '@/ui/primitives/input';
import { FormExamples } from './form-examples';
import { ChoiceExamples } from './choice-examples';
import { FeedbackExamples } from './feedback-examples';
import { NavigationExamples } from './navigation-examples';
import { WorkspaceExamples } from './workspace-examples';
import { ShopperExamples } from './shopper-examples';
import { EditorExamples } from './editor-examples';
import { MotionExamples } from './motion-examples';
import { useGalleryPosters } from './use-gallery-posters';

const groups = [
  'Forms',
  'Choices',
  'Feedback',
  'Navigation',
  'Workspace',
  'Shopper',
  'Editor',
  'Motion',
];
/** Renders every shared kit family as the owner's light/dark and phone review surface. */
export function Gallery() {
  const { theme, setTheme } = useTheme();
  const products = useGalleryPosters();
  return (
    <div className="mx-auto grid max-w-400 lg:grid-cols-[15rem_1fr]">
      <aside className="border-border border-b p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-auto lg:border-r lg:border-b-0">
        <Link href="/dev" className="text-muted-foreground text-xs font-medium">
          ShowCrafter / Developer
        </Link>
        <nav aria-label="Component groups" className="mt-5 flex flex-wrap gap-2 lg:grid">
          {groups.map((group) => (
            <a
              key={group}
              href={`#${group.toLowerCase()}`}
              className="hover:bg-accent rounded-md px-3 py-2 text-sm"
            >
              {group}
            </a>
          ))}
        </nav>
      </aside>
      <main className="grid min-w-0 gap-10 px-4 py-8 sm:px-8">
        <header className="grid gap-4">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            ShowCrafter kit
          </span>
          <h1 className="text-3xl font-semibold">Component gallery</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Every shared piece in one place, with its states, before it goes into pages. Use the
            controls, try the keyboard and compare both themes.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="gallery-theme" className="text-sm">
              Theme
            </label>
            <Select
              id="gallery-theme"
              className="w-36"
              value={theme ?? 'system'}
              onChange={(event) => {
                setTheme(event.target.value);
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
            <Link
              href="/dev/fireworks"
              className="text-primary text-sm underline underline-offset-4"
            >
              Firework previews
            </Link>
          </div>
        </header>
        <FormExamples />
        <ChoiceExamples products={products} />
        <FeedbackExamples />
        <NavigationExamples />
        <WorkspaceExamples />
        <ShopperExamples products={products} />
        <EditorExamples />
        <MotionExamples />
      </main>
    </div>
  );
}
