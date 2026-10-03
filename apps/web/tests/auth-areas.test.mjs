/** Behavioural guard checks cover all roles, inactive identities and redirect boundaries. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessArea, landingArea, safeDestination } from '../lib/auth/areas.ts';
const shopper = {
  status: 'active',
  anonymous: false,
  staffRole: null,
  retailerRoles: [],
  supplierRoles: [],
};
test('each membership persona reaches its workspace and is refused unrelated workspaces', () => {
  for (const role of ['owner', 'manager', 'staff']) {
    const identity = { ...shopper, retailerRoles: [role] };
    assert.equal(canAccessArea('retailer', identity), true);
    assert.equal(canAccessArea('admin', identity), false);
    assert.equal(canAccessArea('supplier', identity), false);
    assert.equal(landingArea(identity), '/retailer');
  }
  for (const role of ['owner', 'member']) {
    const identity = { ...shopper, supplierRoles: [role] };
    assert.equal(canAccessArea('supplier', identity), true);
    assert.equal(canAccessArea('admin', identity), false);
    assert.equal(canAccessArea('retailer', identity), false);
    assert.equal(landingArea(identity), '/supplier');
  }
  assert.equal(landingArea(shopper), '/account');
  for (const area of ['admin', 'retailer', 'supplier'])
    assert.equal(canAccessArea(area, shopper), false);
});
test('table-backed staff can inspect workspaces and all permanent users retain a shopper account', () => {
  for (const role of ['super_admin', 'catalogue_editor', 'reviewer', 'support', 'finance']) {
    const identity = { ...shopper, staffRole: role };
    for (const area of ['admin', 'retailer', 'supplier', 'account'])
      assert.equal(canAccessArea(area, identity), true);
    assert.equal(landingArea(identity), '/admin');
  }
  assert.equal(canAccessArea('account', shopper), true);
});
test('anonymous, inactive and unrecognised roles fail closed', () => {
  for (const override of [
    { anonymous: true },
    { status: 'suspended' },
    { status: 'deactivated' },
  ]) {
    const identity = {
      ...shopper,
      staffRole: 'super_admin',
      retailerRoles: ['owner'],
      supplierRoles: ['owner'],
      ...override,
    };
    for (const area of ['admin', 'retailer', 'supplier', 'account'])
      assert.equal(canAccessArea(area, identity), false);
    assert.equal(landingArea(identity), '/access-denied');
  }
  const unknown = {
    ...shopper,
    staffRole: 'invented',
    retailerRoles: ['invented'],
    supplierRoles: ['invented'],
  };
  for (const area of ['admin', 'retailer', 'supplier'])
    assert.equal(canAccessArea(area, unknown), false);
});
test('callback destinations cannot escape the app origin', () => {
  for (const path of [
    null,
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/\nevil.test',
    'javascript:alert(1)',
  ])
    assert.equal(safeDestination(path), '/account');
  assert.equal(safeDestination('/auth/invite?token=abc'), '/auth/invite?token=abc');
  assert.equal(safeDestination('/retailer/../admin'), '/admin');
});
