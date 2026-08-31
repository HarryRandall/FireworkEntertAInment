import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APP_LINKS,
  SETTINGS_LINKS,
  formatPathSegment,
  getAppBreadcrumbs,
  getPendingRouteKind,
  isActivePath,
  normaliseAppPath,
} from '../../components/shell/app-shell-navigation.ts';

function breadcrumbDetails(pathname) {
  return getAppBreadcrumbs(pathname).map(({ label, href }) => ({ label, href }));
}

test('app navigation exposes only shipped destinations in the intended order', () => {
  assert.deepEqual(
    APP_LINKS.map(({ href, label }) => ({ href, label })),
    [
      { href: '/home', label: 'Home' },
      { href: '/shows', label: 'My shows' },
      { href: '/library', label: 'Explore' },
      { href: '/catalogue', label: 'Catalogue' },
      { href: '/exports', label: 'Exports' },
      { href: '/safety', label: 'Safety' },
      { href: '/admin', label: 'Admin' },
    ],
  );
  assert.equal(APP_LINKS.find(({ href }) => href === '/admin')?.permission, 'admin.view');
  assert.deepEqual(
    SETTINGS_LINKS.map(({ href }) => href),
    [
      '/settings/profile',
      '/settings/notifications',
      '/settings/billing',
      '/settings/usage',
      '/settings/security',
    ],
  );
});

test('route matching excludes show creation from the existing-show section', () => {
  assert.equal(isActivePath('/shows', '/shows'), true);
  assert.equal(isActivePath('/shows/example', '/shows'), true);
  assert.equal(isActivePath('/shows/new', '/shows'), false);
  assert.equal(isActivePath('/shows/new/step', '/shows'), false);
  assert.equal(isActivePath('/settings/security', '/settings'), true);
});

test('breadcrumbs are derived safely from normalised route segments', () => {
  assert.equal(normaliseAppPath('/library/?sort=liked'), '/library');
  assert.equal(formatPathSegment('shopping-list'), 'Shopping List');
  assert.equal(formatPathSegment('%E0%A4%A'), '%E0%A4%A');

  assert.deepEqual(breadcrumbDetails('/shows/new'), [
    { label: 'My shows', href: '/shows' },
    { label: 'New show', href: undefined },
  ]);
  assert.deepEqual(breadcrumbDetails('/shows/midnight-pulse/shopping-list'), [
    { label: 'My shows', href: '/shows' },
    { label: 'Midnight Pulse', href: '/shows/midnight-pulse' },
    { label: 'Shopping list', href: undefined },
  ]);
  assert.deepEqual(breadcrumbDetails('/library/staff-picks'), [
    { label: 'Explore', href: '/library' },
    { label: 'Staff Picks', href: undefined },
  ]);
});

test('pending skeletons are limited to routes with stable shell previews', () => {
  assert.equal(getPendingRouteKind('/home'), 'home');
  assert.equal(getPendingRouteKind('/library?sort=liked'), 'library');
  assert.equal(getPendingRouteKind('/shows'), null);
});
