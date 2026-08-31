/**
 * Compatibility re-export of the new `lib/admin/*` module set.
 *
 * The original file (~900 lines) was split into focused modules in
 * `lib/admin/`. This barrel preserves the `@/lib/admin.server`
 * import path so existing call-sites don't need to change. New code should
 * import directly from `@/lib/admin/<submodule>`.
 */
import 'server-only';

export * from '@/lib/admin/index';
