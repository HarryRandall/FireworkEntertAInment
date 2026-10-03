/** The header's history, checks and publication controls share the current editor session. */
import { Button } from '@/ui/primitives/button';
import { StudioHistoryControls } from './studio-toolbar';
import { StudioChecksPopover } from './studio-checks';
import { StudioLifecycle } from './studio-lifecycle';

/** Keeps lifecycle dialogs and checks anchored to the shared shell's action region. */
export function StudioHeaderActions({
  history,
  checks,
  lifecycle,
  historyBusy,
}: {
  history: Parameters<typeof StudioHistoryControls>[0];
  checks: Parameters<typeof StudioChecksPopover>[0];
  lifecycle: Parameters<typeof StudioLifecycle>[0];
  historyBusy: boolean;
}) {
  return (
    <>
      <StudioHistoryControls {...history} />
      <StudioChecksPopover {...checks} />
      <Button variant="ghost" disabled={historyBusy} onClick={lifecycle.versions.show}>
        Versions
      </Button>
      <StudioLifecycle {...lifecycle} />
    </>
  );
}
