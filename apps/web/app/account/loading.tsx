/** Account loading feedback within the shared workspace landmark. */
import { Spinner } from '@/ui/kit/feedback';
/** Announces account reads while the owned records are loading. */
export default function Loading() {
  return <Spinner label="Loading your account" />;
}
