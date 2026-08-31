/**
 * Barrel export for the admin server module.
 *
 * The original `lib/admin.server.ts` file re-exports from here so existing
 * `@/lib/admin.server` imports keep working. Prefer importing from
 * `@/lib/admin/<submodule>` in new code.
 */
import 'server-only';

export * from './cache-keys';
export {
  asPermissionKey,
  asProfileStatus,
  asRoleKey,
  asThemePreference,
  isRecord,
  mapImportJob,
  mapImportOutput,
  mapMediaAsset,
  mapPermission,
  mapRole,
  mapShowTemplate,
  parseTemplateCues,
  unique,
} from './mappers';
export { getCurrentProfile, requirePermission } from './current-user.server';
export { listPermissions, listRolePermissionMatrix, listRoles } from './roles.server';
export {
  getAdminUserById,
  getUserActivity,
  listAdminUsers,
  type UserActivity,
} from './users.server';
export { getAdminOverviewMetrics, type AdminOverviewMetrics } from './overview.server';
export { listSuppliers } from './suppliers.server';
export { getImportJobDetail, listImportJobs } from './imports.server';
export { listCatalogueProducts } from './catalogue.server';
export { getAdminEffectById, listAdminEffects } from './effects.server';
export {
  getAdminStyleDefaultById,
  listAdminStyleDefaultOptions,
  listAdminStyleDefaults,
} from './style-defaults.server';
export { getAdminFireworkById, listAdminFireworks, listEffectOptions } from './fireworks.server';
export { getMultishotById, listFireworkOptions, listMultishots } from './multishots.server';
export {
  getAdminPromptControlData,
  getAdminShowGenerationSetting,
  listAdminPromptConfigs,
} from './prompts.server';
export {
  getAdminShowPresetById,
  getCurrentShowPresetLikeState,
  getShowTemplateBySlug,
  listAdminShowPresetImportShows,
  listAdminShowPresets,
  listShowTemplates,
} from './templates.server';
