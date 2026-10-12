import { redirect } from 'next/navigation';

/** The homepage now covers this page's content, so old links land there. */
export default function Page() {
  redirect('/');
}
