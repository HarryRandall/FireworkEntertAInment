/** Loading fallback for `/shows/new`; renders the wizard-shaped skeleton. */

import { WizardLoading } from '@/app/(app)/shows/_components/WizardLoading';

export default function NewShowLoading() {
  return <WizardLoading />;
}
