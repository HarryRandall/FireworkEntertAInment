'use client';

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Save } from 'lucide-react';
import {
  updatePromptConfigAction,
  type PromptConfigActionState,
} from '@/app/actions/admin-prompts';
import { Button } from '@/components/design-system/Button';
import { InlineAlert } from '@/components/design-system/Feedback';

const INITIAL_STATE: PromptConfigActionState = {
  status: 'idle',
  message: null,
};

type PromptConfigFormContextValue = {
  isPending: boolean;
  resetVersion: number;
};

const PromptConfigFormContext = createContext<PromptConfigFormContextValue>({
  isPending: false,
  resetVersion: 0,
});

export function usePromptConfigFormState() {
  return useContext(PromptConfigFormContext);
}

export function PromptConfigForm({ children }: { children: ReactNode }) {
  const [state, formAction, isPending] = useActionState(updatePromptConfigAction, INITIAL_STATE);
  const [resetVersion, setResetVersion] = useState(0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Calling the action manually keeps React from resetting uncontrolled
    // fields before the database confirms the write. Failed saves therefore
    // leave the operator's draft intact and ready to retry.
    startTransition(() => formAction(formData));
  }

  return (
    <PromptConfigFormContext.Provider value={{ isPending, resetVersion }}>
      <form
        action={formAction}
        onSubmit={submit}
        onReset={() => setResetVersion((version) => version + 1)}
        aria-busy={isPending || undefined}
        className="flex flex-col gap-4"
      >
        <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-4">
          {children}
        </fieldset>

        {state.status !== 'idle' && state.message ? (
          <InlineAlert
            tone={state.status === 'success' ? 'success' : 'danger'}
            title={state.status === 'success' ? 'Prompt saved' : 'Prompt not saved'}
          >
            {state.message}
          </InlineAlert>
        ) : null}
      </form>
    </PromptConfigFormContext.Provider>
  );
}

export function PromptSaveButton() {
  const { isPending } = usePromptConfigFormState();

  return (
    <Button type="submit" loading={isPending}>
      {isPending ? null : <Save aria-hidden size={16} />}
      {isPending ? 'Saving' : 'Save'}
    </Button>
  );
}
