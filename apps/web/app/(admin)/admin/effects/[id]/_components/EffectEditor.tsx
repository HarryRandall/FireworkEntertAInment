'use client';
import { validateCatalogueRender } from '@/lib/admin/renderer-validation';

import { useDesignHistory as useDraftHistory } from '@/ui/firework-editor/renderer-design/use-design-history';
import { useDesignTabs } from '@/ui/firework-editor/renderer-design/tabs';
import { DesignPreview } from '@/ui/firework-editor/renderer-design/preview';
import { validateEditorDesign } from '@/lib/renderer-editor/validation';
import { restoreEffectEditorVersion, updateEffect } from '@/app/(admin)/admin/effects/actions';
import type { AdminEditorVersion, AdminEffectDetail } from '@/lib/admin.types';
import { canApplySavedEditorSnapshot } from '@/lib/admin/editor-save-state';
import { parseEffectEditorSnapshot } from '@/lib/admin/editor-snapshots';
import type { Json } from '@/lib/database.types';
import { EditorHistoryPanel, JsonReadOnlyPanel } from '@/ui/firework-editor/EditorInspectorPanels';
import {
  FireworkEditorShell,
  type FireworkEditorShellTab,
} from '@/ui/firework-editor/FireworkEditorShell';
import { usePreviewFullscreen } from '@/ui/firework-editor/previewFullscreen';
import {
  makeOptimisticEditorVersion,
  useEditorHistory,
} from '@/ui/firework-editor/useEditorHistory';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input, Textarea } from '@/ui/patterns/Input';

import { toast } from '@/ui/patterns/toast';
import { useAdminBreadcrumbOverride } from '@/ui/shell/AdminShell';
import { canonicaliseEffectModelJson, validateFireworkDesign } from '@showcrafter/fireworks/design';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  emptyStyleDefaultIdMap,
  type FireworkStyleDefaultKind,
} from '@showcrafter/fireworks/style-defaults';
import { Braces, History, SlidersHorizontal } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  cloneRecord,
  isEarlierUpdatedAt,
  toSaveStyleDefaultIds,
} from '@/ui/firework-editor/editor-document';

type ParsedJson = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };
type JsonRecord = Record<string, unknown>;

// Effects are colourless shapes, so the preview uses a neutral cyan.
const PREVIEW_COLOR = '#22d3ee';

function parseJsonObject(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: 'JSON must be an object.' };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not parse JSON.',
    };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function effectEditorSignature(fields: {
  design: Json | null;
  name: string;
  description: string;
  patternKey: string;
  sortOrder: number;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string | null>;
  modelJson: JsonRecord | string;
}): string {
  return JSON.stringify({
    design: fields.design,
    name: fields.name,
    description: fields.description,
    patternKey: fields.patternKey,
    sortOrder: fields.sortOrder,
    styleDefaultIds: fields.styleDefaultIds,
    modelJson: fields.modelJson,
  });
}

function hasConcreteRendererColor(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const defaults = isRecord(value.renderDefaults) ? value.renderDefaults : {};
  const color = defaults.color ?? value.color;
  return color !== undefined && color !== 'random';
}

function initialStyleDefaultIds(
  effect: AdminEffectDetail,
): Record<FireworkStyleDefaultKind, string> {
  const ids = emptyStyleDefaultIdMap();
  for (const kind of FIREWORK_STYLE_DEFAULT_KINDS) {
    ids[kind] = effect.styleDefaultIds[kind] ?? effect.styleDefaultLinks[kind]?.id ?? ids[kind];
  }
  ids.star = effect.starStyleDefaultId ?? ids.star;
  ids.trail = effect.trailStyleDefaultId ?? ids.trail;
  return ids;
}

type EffectEditorSavedSnapshot = {
  design: Json | null;
  id: string;
  updatedAt: string;
  name: string;
  description: string;
  patternKey: string;
  sortOrder: string;
  modelText: string;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string>;
  signature: string;
};

type EffectEditorSnapshotFields = {
  design: Json | null;
  id: string;
  updatedAt: string;
  name: string;
  description: string | null;
  patternKey: string;
  sortOrder: number;
  modelJson: unknown;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string>;
};

type UpdateEffectSuccess = Extract<Awaited<ReturnType<typeof updateEffect>>, { ok: true }>;

function effectSavedSnapshotFromFields(
  fields: EffectEditorSnapshotFields,
): EffectEditorSavedSnapshot {
  const modelJson = canonicaliseEffectModelJson(fields.modelJson);
  const sortOrder = String(fields.sortOrder);
  return {
    design: fields.design,
    id: fields.id,
    updatedAt: fields.updatedAt,
    name: fields.name,
    description: fields.description ?? '',
    patternKey: fields.patternKey,
    sortOrder,
    modelText: JSON.stringify(
      validateCatalogueRender({ kind: 'effect', recordId: fields.id, settings: fields.modelJson })
        .ok
        ? modelJson
        : fields.modelJson,
      null,
      2,
    ),
    styleDefaultIds: fields.styleDefaultIds,
    signature: effectEditorSignature({
      design: fields.design,
      name: fields.name,
      description: fields.description ?? '',
      patternKey: fields.patternKey,
      sortOrder: fields.sortOrder,
      styleDefaultIds: toSaveStyleDefaultIds(fields.styleDefaultIds),
      modelJson,
    }),
  };
}

function effectSavedSnapshotFromDetail(effect: AdminEffectDetail): EffectEditorSavedSnapshot {
  return effectSavedSnapshotFromFields({
    design: effect.design,
    id: effect.id,
    updatedAt: effect.updatedAt,
    name: effect.name,
    description: effect.description,
    patternKey: effect.patternKey,
    sortOrder: effect.sortOrder,
    modelJson: effect.modelJson,
    styleDefaultIds: initialStyleDefaultIds(effect),
  });
}

/** Edits a complete renderer design using the existing record and version save flow. */
export function EffectEditor({ effect }: { effect: AdminEffectDetail }) {
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const [isPending, startTransition] = useTransition();
  const incomingSavedSnapshot = useMemo(() => effectSavedSnapshotFromDetail(effect), [effect]);
  const [design, setDesign] = useState<Json | null>(effect.design);
  const [selectedLayer, setSelectedLayer] = useState('');
  const designResult = useMemo(() => validateEditorDesign(design), [design]);
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? '');
  const [patternKey, setPatternKey] = useState(effect.patternKey);
  const [sortOrder, setSortOrder] = useState(String(effect.sortOrder));
  const [modelText, setModelText] = useState(() => incomingSavedSnapshot.modelText);
  const [styleDefaultIds, setStyleDefaultIds] = useState(() => initialStyleDefaultIds(effect));
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(effect.updatedAt);
  const [savedSignature, setSavedSignature] = useState(() => incomingSavedSnapshot.signature);
  const savedSnapshotRef = useRef<EffectEditorSavedSnapshot>(incomingSavedSnapshot);
  const [savedPreviewSnapshot, setSavedPreviewSnapshot] = useState(incomingSavedSnapshot);
  const savedSignatureRef = useRef(savedSignature);
  const editorTargetIdRef = useRef(effect.id);
  const [activeTab, setActiveTab] = useState('details');
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const editorHistory = useEditorHistory({ targetKey: effect.id, initialVersions: effect.history });
  const [error, setError] = useState<string | null>(null);
  const parsedModel = useMemo(() => parseJsonObject(modelText), [modelText]);
  const baseModel = useMemo(
    () =>
      parsedModel.ok
        ? canonicaliseEffectModelJson(parsedModel.value)
        : canonicaliseEffectModelJson(effect.modelJson),
    [effect.modelJson, parsedModel],
  );
  function copySelectedStyleDefaultsIntoModel(source: JsonRecord): JsonRecord {
    return cloneRecord(canonicaliseEffectModelJson(source));
  }

  const saveStyleDefaultIds = useMemo(
    () => toSaveStyleDefaultIds(styleDefaultIds),
    [styleDefaultIds],
  );
  const sortOrderNumber = Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0;
  const currentSignature = useMemo(
    () =>
      effectEditorSignature({
        design,
        name,
        description,
        patternKey,
        sortOrder: sortOrderNumber,
        styleDefaultIds: saveStyleDefaultIds,
        modelJson: parsedModel.ok ? baseModel : modelText,
      }),
    [
      design,
      baseModel,
      description,
      modelText,
      name,
      parsedModel.ok,
      patternKey,
      saveStyleDefaultIds,
      sortOrderNumber,
    ],
  );
  const currentSignatureRef = useRef(currentSignature);
  const isDirty = savedSignature !== null && currentSignature !== savedSignature;

  useLayoutEffect(() => {
    currentSignatureRef.current = currentSignature;
    savedSignatureRef.current = savedSignature;
    editorTargetIdRef.current = effect.id;
  }, [currentSignature, effect.id, savedSignature]);

  useEffect(() => {
    const incomingSnapshot = incomingSavedSnapshot;
    const savedSnapshot = savedSnapshotRef.current;
    const sameEffect = incomingSnapshot.id === savedSnapshot.id;
    if (sameEffect && incomingSnapshot.updatedAt === savedSnapshot.updatedAt) return;
    if (sameEffect && isEarlierUpdatedAt(incomingSnapshot.updatedAt, savedSnapshot.updatedAt))
      return;
    if (sameEffect && currentSignatureRef.current !== savedSignatureRef.current) return;

    savedSnapshotRef.current = incomingSnapshot;
    setSavedPreviewSnapshot(incomingSnapshot);
    savedSignatureRef.current = incomingSnapshot.signature;
    setDesign(incomingSnapshot.design);
    setName(incomingSnapshot.name);
    setDescription(incomingSnapshot.description);
    setPatternKey(incomingSnapshot.patternKey);
    setSortOrder(incomingSnapshot.sortOrder);
    setModelText(incomingSnapshot.modelText);
    setStyleDefaultIds({ ...incomingSnapshot.styleDefaultIds });
    setLastSavedUpdatedAt(incomingSnapshot.updatedAt);
    setRestoringVersionId(null);
    setSavedSignature(incomingSnapshot.signature);
  }, [incomingSavedSnapshot]);

  const modelHasColour = hasConcreteRendererColor(baseModel);

  useEffect(() => {
    setAdminBreadcrumb({ label: name || effect.name });
    return () => setAdminBreadcrumb(null);
  }, [effect.name, name, setAdminBreadcrumb]);
  const renderResult = useMemo(() => {
    const source = validateCatalogueRender({
      kind: 'effect',
      recordId: effect.id,
      settings: parsedModel.ok ? parsedModel.value : null,
    });
    return source.ok
      ? validateFireworkDesign({ baseModel, primaryColor: modelHasColour ? null : PREVIEW_COLOR })
      : source;
  }, [effect.id, parsedModel, baseModel, modelHasColour]);

  // Invalid settings remain editable, but never become preview particles.
  const renderError = !parsedModel.ok
    ? parsedModel.error
    : !renderResult.ok
      ? renderResult.diagnostics
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')
      : null;

  const [showSaved, setShowSaved] = useState(false);

  async function persistEffect(args: {
    targetId: string;
    styleDefaultIdsMap: Record<FireworkStyleDefaultKind, string | null>;
    modelJson: string;
    historyVersionId: string;
  }): Promise<UpdateEffectSuccess | null> {
    let result: Awaited<ReturnType<typeof updateEffect>>;
    try {
      result = await updateEffect({
        design,
        id: effect.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
        name,
        description,
        patternKey,
        sortOrder: sortOrderNumber,
        starStyleDefaultId: args.styleDefaultIdsMap.star ?? null,
        trailStyleDefaultId: args.styleDefaultIdsMap.trail ?? null,
        styleDefaultIds: args.styleDefaultIdsMap,
        modelJson: args.modelJson,
        historyVersionId: args.historyVersionId,
      });
    } catch {
      if (editorTargetIdRef.current === args.targetId) {
        setError('Could not save the effect. Try again.');
      }
      return null;
    }
    if (editorTargetIdRef.current !== args.targetId) return null;
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setLastSavedUpdatedAt(result.saved.updatedAt);
    return result;
  }

  function currentLocalSnapshot(): EffectEditorSavedSnapshot {
    return {
      design,
      id: effect.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      patternKey,
      sortOrder,
      modelText,
      styleDefaultIds: { ...styleDefaultIds },
      signature: currentSignature,
    };
  }

  function applySnapshot(snapshot: EffectEditorSavedSnapshot) {
    setDesign(snapshot.design);
    setName(snapshot.name);
    setDescription(snapshot.description);
    setPatternKey(snapshot.patternKey);
    setSortOrder(snapshot.sortOrder);
    setStyleDefaultIds({ ...snapshot.styleDefaultIds });
    setModelText(snapshot.modelText);
  }

  function beginOptimisticMutation(
    optimisticSnapshot: EffectEditorSavedSnapshot,
    action: 'update' | 'restore',
  ) {
    const historyVersionId = crypto.randomUUID();
    const localSnapshot = currentLocalSnapshot();
    currentSignatureRef.current = optimisticSnapshot.signature;
    applySnapshot(optimisticSnapshot);
    editorHistory.begin(
      makeOptimisticEditorVersion({
        id: historyVersionId,
        targetKind: 'effect',
        targetId: effect.id,
        action,
      }),
    );
    return {
      targetId: effect.id,
      historyVersionId,
      localSnapshot,
      optimisticSnapshot,
    };
  }

  function rollbackOptimisticMutation(mutation: ReturnType<typeof beginOptimisticMutation>) {
    if (editorTargetIdRef.current !== mutation.targetId) return;
    editorHistory.discard(mutation.historyVersionId);
    if (currentSignatureRef.current === mutation.optimisticSnapshot.signature) {
      currentSignatureRef.current = mutation.localSnapshot.signature;
      applySnapshot(mutation.localSnapshot);
    }
  }

  function saveEffect() {
    if (isPending) return;
    setError(null);
    if (renderError || !parsedModel.ok) {
      setError(renderError ?? (!parsedModel.ok ? parsedModel.error : null));
      return;
    }
    const savedModel = copySelectedStyleDefaultsIntoModel(parsedModel.value);
    const savedModelText = JSON.stringify(savedModel, null, 2);
    const clearedStyleDefaultIds = emptyStyleDefaultIdMap();
    const clearedSaveMap = toSaveStyleDefaultIds(clearedStyleDefaultIds);
    const optimisticSnapshot = effectSavedSnapshotFromFields({
      design,
      id: effect.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      patternKey,
      sortOrder: sortOrderNumber,
      modelJson: savedModel,
      styleDefaultIds: clearedStyleDefaultIds,
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'update');
    startTransition(async () => {
      const persisted = await persistEffect({
        targetId: mutation.targetId,
        styleDefaultIdsMap: clearedSaveMap,
        modelJson: savedModelText,
        historyVersionId: mutation.historyVersionId,
      });
      if (!persisted) {
        rollbackOptimisticMutation(mutation);
        return;
      }
      const applySavedSnapshot = canApplySavedEditorSnapshot(
        mutation.optimisticSnapshot.signature,
        currentSignatureRef.current,
      );
      const savedSnapshot = effectSavedSnapshotFromFields({
        ...persisted.saved,
        styleDefaultIds: clearedStyleDefaultIds,
      });
      savedSnapshotRef.current = savedSnapshot;
      setSavedPreviewSnapshot(savedSnapshot);
      savedSignatureRef.current = savedSnapshot.signature;
      setSavedSignature(savedSnapshot.signature);
      editorHistory.settle({
        optimisticId: mutation.historyVersionId,
        persistedVersion: persisted.historyVersion,
        recorded: persisted.historyRecorded,
      });
      if (applySavedSnapshot) {
        currentSignatureRef.current = savedSnapshot.signature;
        applySnapshot(savedSnapshot);
        toast.success('Effect saved');
      } else {
        toast.success('Effect saved; newer edits remain unsaved');
      }
    });
  }

  function revertLocalChanges() {
    const savedSnapshot = savedSnapshotRef.current;
    applySnapshot(savedSnapshot);
    setLastSavedUpdatedAt(savedSnapshot.updatedAt);
    setError(null);
    savedSignatureRef.current = savedSnapshot.signature;
    setSavedSignature(savedSnapshot.signature);
  }

  function restoreVersion(version: AdminEditorVersion) {
    if (isPending) return;
    setError(null);
    const snapshot = parseEffectEditorSnapshot(version.snapshotJson);
    if (!snapshot || snapshot.id !== effect.id) {
      setError('That version cannot be restored.');
      return;
    }
    const optimisticSnapshot = effectSavedSnapshotFromFields({
      design: snapshot.design ?? design,
      id: snapshot.id,
      updatedAt: lastSavedUpdatedAt,
      name: snapshot.name,
      description: snapshot.description,
      patternKey: snapshot.patternKey,
      sortOrder: snapshot.sortOrder,
      modelJson: snapshot.modelJson,
      styleDefaultIds: emptyStyleDefaultIdMap(),
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'restore');
    setRestoringVersionId(version.id);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof restoreEffectEditorVersion>>;
      try {
        result = await restoreEffectEditorVersion({
          effectId: effect.id,
          versionId: version.id,
          expectedUpdatedAt: lastSavedUpdatedAt,
          historyVersionId: mutation.historyVersionId,
        });
      } catch {
        rollbackOptimisticMutation(mutation);
        if (editorTargetIdRef.current === mutation.targetId) {
          setRestoringVersionId(null);
          setError('Could not restore that version. Try again.');
        }
        return;
      }
      if (editorTargetIdRef.current !== mutation.targetId) return;
      setRestoringVersionId(null);
      if (!result.ok) {
        rollbackOptimisticMutation(mutation);
        setError(result.error);
        return;
      }
      const restoredSnapshot = effectSavedSnapshotFromFields({
        ...result.saved,
        styleDefaultIds: emptyStyleDefaultIdMap(),
      });
      const applyRestoredSnapshot = canApplySavedEditorSnapshot(
        mutation.optimisticSnapshot.signature,
        currentSignatureRef.current,
      );
      savedSnapshotRef.current = restoredSnapshot;
      setSavedPreviewSnapshot(restoredSnapshot);
      savedSignatureRef.current = restoredSnapshot.signature;
      setLastSavedUpdatedAt(restoredSnapshot.updatedAt);
      setSavedSignature(restoredSnapshot.signature);
      editorHistory.settle({
        optimisticId: mutation.historyVersionId,
        persistedVersion: result.historyVersion,
        recorded: result.historyRecorded,
      });
      if (applyRestoredSnapshot) {
        currentSignatureRef.current = restoredSnapshot.signature;
        applySnapshot(restoredSnapshot);
        toast.success('Version restored');
      } else {
        toast.success('Version restored; newer effect edits remain unsaved');
      }
    });
  }

  const savedDesignResult = useMemo(
    () => validateEditorDesign(savedPreviewSnapshot.design),
    [savedPreviewSnapshot.design],
  );
  const preview = designResult.ok ? (
    <div className="relative h-full">
      <DesignPreview
        fullscreen={isFullscreen}
        onFullscreenToggle={toggleFullscreen}
        document={showSaved && savedDesignResult.ok ? savedDesignResult.value : designResult.value}
      />
    </div>
  ) : (
    <p role="alert" className="text-status-danger p-4 text-sm">
      {designResult.error}
    </p>
  );
  const detailsContent = (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="fx-name">Name</FieldLabel>
        <Input id="fx-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="fx-description">Description</FieldLabel>
        <Textarea
          id="fx-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="fx-pattern">Pattern key</FieldLabel>
          <Input
            id="fx-pattern"
            value={patternKey}
            onChange={(event) => setPatternKey(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="fx-sort">Sort order</FieldLabel>
          <Input
            id="fx-sort"
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );

  const designTabs = useDesignTabs({
    value: design,
    onChange: (next) => setDesign(JSON.parse(JSON.stringify(next))),
    selected: selectedLayer,
    onSelect: setSelectedLayer,
    disabled: isPending,
  });
  const tabs: FireworkEditorShellTab[] = [
    {
      id: 'details',
      label: 'Details',
      icon: SlidersHorizontal,
      eyebrow: 'Catalogue',
      title: 'Details',
      content: detailsContent,
    },
    ...designTabs,
    {
      id: 'history',
      label: 'History',
      icon: History,
      eyebrow: 'Versions',
      title: 'Version history',
      content: (
        <EditorHistoryPanel
          versions={editorHistory.versions}
          pendingVersionIds={editorHistory.pendingIds}
          warning={editorHistory.warning}
          restoringVersionId={restoringVersionId}
          mutationPending={isPending}
          onRestore={restoreVersion}
        />
      ),
    },
    {
      id: 'json',
      label: 'JSON',
      icon: Braces,
      eyebrow: 'Advanced',
      title: 'Canonical model JSON',
      content: <JsonReadOnlyPanel value={design} />,
    },
  ];

  const draftHistory = useDraftHistory({
    recordKey: effect.id,
    value: currentLocalSnapshot(),
    signature: currentSignature,
    restore: applySnapshot,
  });

  return (
    <FireworkEditorShell
      history={draftHistory}
      comparison={{ saved: showSaved, onChange: setShowSaved }}
      title={name || effect.name}
      dirty={isDirty}
      saving={isPending}
      saveLabel="Save"
      saveDisabled={!designResult.ok || Boolean(renderError) || isPending}
      revertDisabled={!isDirty || isPending}
      onSave={saveEffect}
      onRevert={revertLocalChanges}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      tabs={tabs}
      preview={preview}
      transport={null}
      transportPlaying={false}
      error={error}
      renderDiagnostics={{
        recordId: effect.id,
        issues: !parsedModel.ok
          ? [{ path: [], message: parsedModel.error }]
          : !renderResult.ok
            ? renderResult.diagnostics
            : [],
      }}
      fullscreen={isFullscreen}
      onExitFullscreen={exitFullscreen}
    />
  );
}
