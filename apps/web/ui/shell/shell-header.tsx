/** Breadcrumb and editor actions shared by workspace frame variants. */
import Link from 'next/link';
import { Menu, MoreHorizontal } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { ActionMenu } from '@/ui/kit/overlays';
import type { AreaConfig } from './config/types';
import type { EditorFrameOptions } from './workspace-shell';

/** Renders a breadcrumb and Save/overflow actions without a back arrow. */
export function ShellHeader({
  config,
  title,
  editorFrame,
  openNavigation,
}: {
  config: AreaConfig;
  title: string;
  editorFrame?: EditorFrameOptions;
  openNavigation: () => void;
}) {
  return (
    <header className="sc-shell-header">
      <Button
        className="sc-shell-mobile-menu"
        variant="ghost"
        size="icon-sm"
        aria-label="Open navigation"
        onClick={openNavigation}
      >
        <Menu />
      </Button>
      <nav aria-label="Breadcrumb" className="sc-shell-breadcrumb">
        <Link href={config.href}>{config.label}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{title}</span>
      </nav>
      {editorFrame !== undefined && (
        <div className="ml-auto flex shrink-0 gap-2">
          <Button
            disabled={editorFrame.saving === true || editorFrame.saveDisabled === true}
            onClick={editorFrame.onSave}
          >
            {editorFrame.saving === true ? 'Saving...' : 'Save'}
          </Button>
          <ActionMenu
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Editor actions">
                <MoreHorizontal />
              </Button>
            }
            actions={editorFrame.actions}
          />
        </div>
      )}
    </header>
  );
}
