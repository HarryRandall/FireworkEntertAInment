/** Breadcrumb and editor actions shared by workspace frame variants. */
import Link from 'next/link';
import { Menu, MoreHorizontal } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { ActionMenu } from '@/ui/kit/overlays';
import type { AreaConfig } from './config/types';
import type { EditorFrameOptions } from './workspace-shell';

/** Renders route chrome with optional editor status, centred tools and lifecycle actions. */
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
  const hasEditorTools = editorFrame?.centre !== undefined;
  return (
    <header className={`sc-shell-header ${hasEditorTools ? 'sc-shell-editor-header' : ''}`}>
      <Button
        className="sc-shell-mobile-menu"
        variant="ghost"
        size="icon-sm"
        aria-label="Open navigation"
        onClick={openNavigation}
      >
        <Menu />
      </Button>
      <div className="sc-shell-header-identity min-w-0">
        <ShellBreadcrumb config={config} title={title} editorFrame={editorFrame} />
        {editorFrame?.status}
      </div>
      {editorFrame?.centre}
      {editorFrame !== undefined && <EditorActions editorFrame={editorFrame} />}
    </header>
  );
}
function ShellBreadcrumb({
  config,
  title,
  editorFrame,
}: {
  config: AreaConfig;
  title: string;
  editorFrame?: EditorFrameOptions;
}) {
  return (
    <nav aria-label="Breadcrumb" className="sc-shell-breadcrumb">
      <Link href={editorFrame?.breadcrumb?.href ?? config.href}>
        {editorFrame?.breadcrumb?.label ?? config.label}
      </Link>
      <span aria-hidden="true">/</span>
      {editorFrame?.centre !== undefined ? (
        <h1 aria-current="page">{title}</h1>
      ) : (
        <span aria-current="page">{title}</span>
      )}
    </nav>
  );
}
function EditorActions({ editorFrame }: { editorFrame: EditorFrameOptions }) {
  return (
    <div className="sc-shell-editor-actions ml-auto flex shrink-0 items-center gap-2">
      {editorFrame.controls}
      {editorFrame.controls === undefined && (
        <Button
          disabled={editorFrame.saving === true || editorFrame.saveDisabled === true}
          onClick={editorFrame.onSave}
        >
          {editorFrame.saving === true ? 'Saving...' : 'Save'}
        </Button>
      )}
      <ActionMenu
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Editor actions">
            <MoreHorizontal />
          </Button>
        }
        actions={editorFrame.actions}
      />
    </div>
  );
}
