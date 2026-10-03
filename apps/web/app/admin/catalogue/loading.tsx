/** Pending catalogue reads preserve the shared workspace shell. */
import { Spinner } from '@/ui/kit/feedback';
/** Announces the server catalogue read while its route streams. */
export default function Loading() {
  return <Spinner label="Loading catalogue..." />;
}
