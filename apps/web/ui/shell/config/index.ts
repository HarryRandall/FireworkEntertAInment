/** Shared lookup for the four route-owned workspace configurations. */
import { retailerConfig } from './retailer';
import { adminConfig } from './admin';
import { supplierConfig } from './supplier';
import { accountConfig } from './account';
import type { WorkspaceArea, AreaConfig } from './types';

/** Configurations keyed by the same area names as access policies. */
export const areaConfigs: Record<WorkspaceArea, AreaConfig> = {
  retailer: retailerConfig,
  admin: adminConfig,
  supplier: supplierConfig,
  account: accountConfig,
};
