'use client';
import { Button } from '@/ui/patterns/Button';
import { validateCatalogueRender } from '@/lib/admin/renderer-validation';
import { fireworkColourMetadata } from '@showcrafter/firework-editor/colour-metadata';

import { useDesignHistory as useDraftHistory } from '@/ui/firework-editor/renderer-design/use-design-history';
import { useDesignTabs } from '@/ui/firework-editor/renderer-design/tabs';
import { DesignPreview } from '@/ui/firework-editor/renderer-design/preview';
import { validateEditorDesign } from '@/lib/renderer-editor/validation';
import {
  restoreFireworkEditorVersion,
  updateFirework,
} from '@/app/(admin)/admin/fireworks/actions';
import type { AdminEditorVersion, AdminFireworkDetail } from '@/lib/admin.types';
import { canApplySavedEditorSnapshot } from '@/lib/admin/editor-save-state';
import { parseFireworkEditorSnapshot } from '@/lib/admin/editor-snapshots';
import type { Json } from '@/lib/database.types';
import { EditorHistoryPanel, JsonReadOnlyPanel } from '@/ui/firework-editor/EditorInspectorPanels';
import {
  FireworkEditorShell,
  type FireworkEditorShellTab,
} from '@/ui/firework-editor/FireworkEditorShell';
import { type JsonRecord } from '@/ui/firework-editor/FireworkRenderControls';
import { usePreviewFullscreen } from '@/ui/firework-editor/previewFullscreen';
import {
  makeOptimisticEditorVersion,
  useEditorHistory,
} from '@/ui/firework-editor/useEditorHistory';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input, Textarea } from '@/ui/patterns/Input';
import { SelectField } from '@/ui/patterns/SelectField';
import { toast } from '@/ui/patterns/toast';
import { useAdminBreadcrumbOverride } from '@/ui/shell/AdminShell';
import { validateFireworkDesign } from '@showcrafter/fireworks/design';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  emptyStyleDefaultIdMap,
  type FireworkStyleDefaultKind,
} from '@showcrafter/fireworks/style-defaults';
import { Braces, CircleDot, History, SlidersHorizontal } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  cloneRecord,
  isEarlierUpdatedAt,
  toSaveStyleDefaultIds,
} from '@/ui/firework-editor/editor-document';

type ParsedJson = { ok: true; value: JsonRecord } | { ok: false; error: string };

function parseJsonObject(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: 'JSON must be an object.' };
    }
    return { ok: true, value: value as JsonRecord };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not parse JSON.' };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function initialStyleDefaultIds(
  firework: AdminFireworkDetail,
): Record<FireworkStyleDefaultKind, string> {
  const ids = emptyStyleDefaultIdMap();
  for (const kind of FIREWORK_STYLE_DEFAULT_KINDS) {
    ids[kind] =
      firework.styleDefaultIds[kind] ?? firework.fireworkStyleDefaultLinks[kind]?.id ?? ids[kind];
  }
  ids.star = firework.starStyleDefaultId ?? ids.star;
  ids.trail = firework.trailStyleDefaultId ?? ids.trail;
  return ids;
}

function fireworkEditorSignature(fields: {
  design: Json | null;
  name: string;
  description: string;
  effectId: string;
  caliber: string;
  durationSeconds: string;
  heightMeters: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
  styleDefaultIds: Record<FireworkStyleDefaultKind, string | null>;
  renderOverridesJson: JsonRecord;
}): string {
  return JSON.stringify({
    design: fields.design,
    name: fields.name,
    description: fields.description,
    effectId: fields.effectId,
    caliber: fields.caliber,
    durationSeconds: fields.durationSeconds,
    heightMeters: fields.heightMeters,
    primaryColor: fields.primaryColor,
    secondaryColor: fields.secondaryColor,
    colorPalette: fields.colorPalette,
    styleDefaultIds: fields.styleDefaultIds,
    renderOverridesJson: fields.renderOverridesJson,
  });
}

type FireworkEditorSavedSnapshot = {
  design: Json | null;
  id: string;
  updatedAt: string;
  name: string;
  description: string;
  effectId: string;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string>;
  caliber: string;
  durationSeconds: string;
  heightMeters: string;
  overridesText: string;
  signature: string;
};

type FireworkEditorSnapshotFields = {
  design: Json | null;
  id: string;
  updatedAt: string;
  name: string;
  description: string | null;
  effectId: string;
  styleDefaultIds: Record<FireworkStyleDefaultKind, string>;
  caliber: string | null;
  durationSeconds: number | null;
  heightMeters: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
  renderOverridesJson: unknown;
};

type UpdateFireworkSuccess = Extract<Awaited<ReturnType<typeof updateFirework>>, { ok: true }>;

function fireworkSavedSnapshotFromFields(
  fields: FireworkEditorSnapshotFields,
): FireworkEditorSavedSnapshot {
  const overrides = isRecord(fields.renderOverridesJson) ? fields.renderOverridesJson : {};
  const {
    primaryColor: mainColor,
    secondaryColor: accentColor,
    colorPalette: palette,
  } = fireworkColourMetadata(overrides);
  const caliber = fields.caliber ?? '';
  const durationSeconds = fields.durationSeconds == null ? '' : String(fields.durationSeconds);
  const heightMeters = fields.heightMeters == null ? '' : String(fields.heightMeters);

  return {
    design: fields.design,
    id: fields.id,
    updatedAt: fields.updatedAt,
    name: fields.name,
    description: fields.description ?? '',
    effectId: fields.effectId,
    styleDefaultIds: fields.styleDefaultIds,
    caliber,
    durationSeconds,
    heightMeters,
    overridesText: JSON.stringify(fields.renderOverridesJson, null, 2),
    signature: fireworkEditorSignature({
      design: fields.design,
      name: fields.name,
      description: fields.description ?? '',
      effectId: fields.effectId,
      caliber,
      durationSeconds,
      heightMeters,
      primaryColor: mainColor,
      secondaryColor: accentColor,
      colorPalette: palette,
      styleDefaultIds: toSaveStyleDefaultIds(fields.styleDefaultIds),
      renderOverridesJson: overrides,
    }),
  };
}

function fireworkSavedSnapshotFromDetail(
  firework: AdminFireworkDetail,
): FireworkEditorSavedSnapshot {
  return fireworkSavedSnapshotFromFields({
    design: firework.design,
    id: firework.id,
    updatedAt: firework.updatedAt,
    name: firework.name,
    description: firework.description,
    effectId: firework.effectId ?? firework.effectOptions[0]?.id ?? '',
    styleDefaultIds: initialStyleDefaultIds(firework),
    caliber: firework.caliber,
    durationSeconds: firework.durationSeconds,
    heightMeters: firework.heightMeters,
    primaryColor: firework.primaryColor,
    secondaryColor: firework.secondaryColor,
    colorPalette: firework.colorPalette,
    renderOverridesJson: firework.renderOverridesJson,
  });
}

/** Edits a complete renderer design using the existing record and version save flow. */
export function FireworkEditor({ firework }: { firework: AdminFireworkDetail }) {
  const setAdminBreadcrumb = useAdminBreadcrumbOverride();
  const { isFullscreen, toggleFullscreen, exitFullscreen } = usePreviewFullscreen();
  const [isPending, startTransition] = useTransition();
  const incomingSavedSnapshot = useMemo(
    () => fireworkSavedSnapshotFromDetail(firework),
    [firework],
  );
  const [error, setError] = useState<string | null>(null);
  const [design, setDesign] = useState<Json | null>(firework.design);
  const [selectedLayer, setSelectedLayer] = useState('');
  const designResult = useMemo(() => validateEditorDesign(design), [design]);
  const [name, setName] = useState(firework.name);
  const [description, setDescription] = useState(firework.description ?? '');
  const [effectId, setEffectId] = useState(
    firework.effectId ?? firework.effectOptions[0]?.id ?? '',
  );
  const [styleDefaultIds, setStyleDefaultIds] = useState(() => initialStyleDefaultIds(firework));
  const [caliber, setCaliber] = useState(firework.caliber ?? '');
  const [durationSeconds, setDurationSeconds] = useState(
    firework.durationSeconds == null ? '' : String(firework.durationSeconds),
  );
  const [heightMeters, setHeightMeters] = useState(
    firework.heightMeters == null ? '' : String(firework.heightMeters),
  );
  const [overridesText, setOverridesText] = useState(
    JSON.stringify(firework.renderOverridesJson, null, 2),
  );
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(firework.updatedAt);
  const [savedSignature, setSavedSignature] = useState(() => incomingSavedSnapshot.signature);
  const savedSnapshotRef = useRef<FireworkEditorSavedSnapshot>(incomingSavedSnapshot);
  const [savedPreviewSnapshot, setSavedPreviewSnapshot] = useState(incomingSavedSnapshot);
  const savedSignatureRef = useRef(savedSignature);
  const editorTargetIdRef = useRef(firework.id);
  const [activeTab, setActiveTab] = useState('colour');
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const editorHistory = useEditorHistory({
    targetKey: firework.id,
    initialVersions: firework.history,
  });

  const parsedOverrides = useMemo(() => parseJsonObject(overridesText), [overridesText]);
  const overridesRecord = useMemo<JsonRecord>(
    () => (parsedOverrides.ok ? parsedOverrides.value : {}),
    [parsedOverrides],
  );

  const {
    primaryColor: mainColor,
    secondaryColor: accentColor,
    colorPalette: palette,
  } = useMemo(() => fireworkColourMetadata(overridesRecord), [overridesRecord]);
  function copySelectedStyleDefaultsIntoOverrides(source: JsonRecord): JsonRecord {
    return cloneRecord(source);
  }

  const saveStyleDefaultIds = useMemo(
    () => toSaveStyleDefaultIds(styleDefaultIds),
    [styleDefaultIds],
  );
  const currentSignature = useMemo(
    () =>
      fireworkEditorSignature({
        design,
        name,
        description,
        effectId,
        caliber,
        durationSeconds,
        heightMeters,
        primaryColor: mainColor,
        secondaryColor: accentColor,
        colorPalette: palette,
        styleDefaultIds: saveStyleDefaultIds,
        renderOverridesJson: overridesRecord,
      }),
    [
      design,
      accentColor,
      caliber,
      description,
      durationSeconds,
      effectId,
      heightMeters,
      mainColor,
      overridesRecord,
      name,
      palette,
      saveStyleDefaultIds,
    ],
  );
  const currentSignatureRef = useRef(currentSignature);
  const isDirty = savedSignature !== null && currentSignature !== savedSignature;

  useLayoutEffect(() => {
    currentSignatureRef.current = currentSignature;
    savedSignatureRef.current = savedSignature;
    editorTargetIdRef.current = firework.id;
  }, [currentSignature, firework.id, savedSignature]);

  useEffect(() => {
    const incomingSnapshot = incomingSavedSnapshot;
    const savedSnapshot = savedSnapshotRef.current;
    const sameFirework = incomingSnapshot.id === savedSnapshot.id;
    if (sameFirework && incomingSnapshot.updatedAt === savedSnapshot.updatedAt) return;
    if (sameFirework && isEarlierUpdatedAt(incomingSnapshot.updatedAt, savedSnapshot.updatedAt)) {
      return;
    }
    if (sameFirework && currentSignatureRef.current !== savedSignatureRef.current) return;

    savedSnapshotRef.current = incomingSnapshot;
    setSavedPreviewSnapshot(incomingSnapshot);
    savedSignatureRef.current = incomingSnapshot.signature;
    setDesign(incomingSnapshot.design);
    setName(incomingSnapshot.name);
    setDescription(incomingSnapshot.description);
    setEffectId(incomingSnapshot.effectId);
    setStyleDefaultIds({ ...incomingSnapshot.styleDefaultIds });
    setCaliber(incomingSnapshot.caliber);
    setDurationSeconds(incomingSnapshot.durationSeconds);
    setHeightMeters(incomingSnapshot.heightMeters);
    setOverridesText(incomingSnapshot.overridesText);
    setLastSavedUpdatedAt(incomingSnapshot.updatedAt);
    setRestoringVersionId(null);
    setSavedSignature(incomingSnapshot.signature);
  }, [incomingSavedSnapshot]);

  const renderResult = useMemo(
    () =>
      validateCatalogueRender({
        kind: 'firework',
        recordId: firework.id,
        settings: parsedOverrides.ok ? parsedOverrides.value : null,
      }),
    [firework.id, parsedOverrides],
  );

  // Invalid settings remain editable, but never become preview particles.
  const renderError = !parsedOverrides.ok
    ? parsedOverrides.error
    : !renderResult.ok
      ? renderResult.diagnostics
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')
      : null;

  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    setAdminBreadcrumb({ label: name || firework.name });
    return () => setAdminBreadcrumb(null);
  }, [firework.name, name, setAdminBreadcrumb]);

  function handleEffectIdChange(nextEffectId: string) {
    if (nextEffectId === effectId) return;
    const model = firework.effectModels[nextEffectId];
    if (!model) {
      setError('This effect has no render settings and cannot be applied.');
      return;
    }
    const copied = validateFireworkDesign({ baseModel: model });
    if (!copied.ok) {
      setError(copied.diagnostics.map((issue) => issue.message).join('; '));
      return;
    }
    setError(null);
    setEffectId(nextEffectId);
    setStyleDefaultIds(emptyStyleDefaultIdMap());
    setOverridesText(JSON.stringify(copied.design, null, 2));
  }

  async function persistFirework(args: {
    targetId: string;
    styleDefaultIdsMap: Record<FireworkStyleDefaultKind, string | null>;
    overrides: JsonRecord;
    historyVersionId: string;
  }): Promise<UpdateFireworkSuccess | null> {
    let result: Awaited<ReturnType<typeof updateFirework>>;
    try {
      result = await updateFirework({
        design,
        id: firework.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
        name,
        description,
        fireworkEffectId: effectId,
        caliber,
        durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
        heightMeters: heightMeters === '' ? null : Number(heightMeters),
        primaryColor: mainColor,
        secondaryColor: accentColor,
        colorPalette: palette,
        starStyleDefaultId: args.styleDefaultIdsMap.star ?? null,
        trailStyleDefaultId: args.styleDefaultIdsMap.trail ?? null,
        styleDefaultIds: args.styleDefaultIdsMap,
        renderOverridesJson: JSON.stringify(args.overrides, null, 2),
        historyVersionId: args.historyVersionId,
      });
    } catch {
      if (editorTargetIdRef.current === args.targetId) {
        setError('Could not save the firework. Try again.');
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

  function currentLocalSnapshot(): FireworkEditorSavedSnapshot {
    return {
      design,
      id: firework.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      effectId,
      styleDefaultIds: { ...styleDefaultIds },
      caliber,
      durationSeconds,
      heightMeters,
      overridesText,
      signature: currentSignature,
    };
  }

  function applySnapshot(snapshot: FireworkEditorSavedSnapshot) {
    setDesign(snapshot.design);
    setName(snapshot.name);
    setDescription(snapshot.description);
    setEffectId(snapshot.effectId);
    setStyleDefaultIds({ ...snapshot.styleDefaultIds });
    setCaliber(snapshot.caliber);
    setDurationSeconds(snapshot.durationSeconds);
    setHeightMeters(snapshot.heightMeters);
    setOverridesText(snapshot.overridesText);
  }

  function beginOptimisticMutation(
    optimisticSnapshot: FireworkEditorSavedSnapshot,
    action: 'update' | 'restore',
  ) {
    const historyVersionId = crypto.randomUUID();
    const localSnapshot = currentLocalSnapshot();
    currentSignatureRef.current = optimisticSnapshot.signature;
    applySnapshot(optimisticSnapshot);
    editorHistory.begin(
      makeOptimisticEditorVersion({
        id: historyVersionId,
        targetKind: 'firework',
        targetId: firework.id,
        action,
      }),
    );
    return {
      targetId: firework.id,
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

  function save() {
    if (isPending) return;
    setError(null);
    if (renderError || !parsedOverrides.ok) {
      setError(renderError ?? (!parsedOverrides.ok ? parsedOverrides.error : null));
      return;
    }
    if (!effectId) {
      setError('Choose a base effect.');
      return;
    }
    const copiedOverrides = copySelectedStyleDefaultsIntoOverrides(overridesRecord);
    const clearedStyleDefaultIds = emptyStyleDefaultIdMap();
    const clearedSaveMap = toSaveStyleDefaultIds(clearedStyleDefaultIds);
    const optimisticSnapshot = fireworkSavedSnapshotFromFields({
      design,
      id: firework.id,
      updatedAt: lastSavedUpdatedAt,
      name,
      description,
      effectId,
      styleDefaultIds: clearedStyleDefaultIds,
      caliber: caliber || null,
      durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
      heightMeters: heightMeters === '' ? null : Number(heightMeters),
      primaryColor: mainColor,
      secondaryColor: accentColor,
      colorPalette: palette,
      renderOverridesJson: copiedOverrides,
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'update');
    startTransition(async () => {
      const persisted = await persistFirework({
        targetId: mutation.targetId,
        styleDefaultIdsMap: clearedSaveMap,
        overrides: copiedOverrides,
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
      const savedSnapshot = fireworkSavedSnapshotFromFields({
        ...persisted.saved,
        effectId: persisted.saved.fireworkEffectId,
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
        toast.success('Firework saved');
      } else {
        toast.success('Firework saved; newer edits remain unsaved');
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
    const snapshot = parseFireworkEditorSnapshot(version.snapshotJson);
    if (!snapshot || snapshot.id !== firework.id) {
      setError('That version cannot be restored.');
      return;
    }
    const optimisticSnapshot = fireworkSavedSnapshotFromFields({
      design: snapshot.design ?? design,
      id: snapshot.id,
      updatedAt: lastSavedUpdatedAt,
      name: snapshot.name,
      description: snapshot.description,
      effectId: snapshot.fireworkEffectId,
      styleDefaultIds: emptyStyleDefaultIdMap(),
      caliber: snapshot.caliber,
      durationSeconds: snapshot.durationSeconds,
      heightMeters: snapshot.heightMeters,
      primaryColor: snapshot.primaryColor,
      secondaryColor: snapshot.secondaryColor,
      colorPalette: snapshot.colorPalette,
      renderOverridesJson: snapshot.renderOverridesJson,
    });
    const mutation = beginOptimisticMutation(optimisticSnapshot, 'restore');
    setRestoringVersionId(version.id);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof restoreFireworkEditorVersion>>;
      try {
        result = await restoreFireworkEditorVersion({
          fireworkId: firework.id,
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
      const restoredSnapshot = fireworkSavedSnapshotFromFields({
        ...result.saved,
        effectId: result.saved.fireworkEffectId,
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
        toast.success('Version restored; newer firework edits remain unsaved');
      }
    });
  }

  const effectOptions = firework.effectOptions.map((option) => ({
    value: option.id,
    label: option.name,
  }));
  const savedDesignResult = useMemo(
    () => validateEditorDesign(savedPreviewSnapshot.design),
    [savedPreviewSnapshot.design],
  );
  const preview = designResult.ok ? (
    <div className="relative h-full">
      <DesignPreview
        document={showSaved && savedDesignResult.ok ? savedDesignResult.value : designResult.value}
      />
      <Button
        variant="secondary"
        onClick={toggleFullscreen}
        className="absolute top-3 right-3 z-10 h-8"
      >
        {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      </Button>
    </div>
  ) : (
    <p role="alert" className="text-status-danger p-4 text-sm">
      {designResult.error}
    </p>
  );

  const detailsContent = (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="fw-name">Name</FieldLabel>
        <Input id="fw-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel>Base effect</FieldLabel>
        <SelectField
          value={effectId}
          onChange={handleEffectIdChange}
          options={effectOptions}
          ariaLabel="Base effect"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="fw-caliber">Calibre</FieldLabel>
          <Input
            id="fw-caliber"
            placeholder="30mm"
            value={caliber}
            onChange={(e) => setCaliber(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="fw-duration">Duration (s)</FieldLabel>
          <Input
            id="fw-duration"
            inputMode="decimal"
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="fw-height">Height (m)</FieldLabel>
          <Input
            id="fw-height"
            inputMode="decimal"
            value={heightMeters}
            onChange={(e) => setHeightMeters(e.target.value)}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="fw-description">Description</FieldLabel>
        <Textarea
          id="fw-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
    </div>
  );
  const designTabs = useDesignTabs({
    value: design,
    onChange: (next) => setDesign(JSON.parse(JSON.stringify(next))),
    selected: selectedLayer,
    onSelect: setSelectedLayer,
    disabled: isPending,
    reset: () => {
      const result = validateEditorDesign(firework.effectDesigns[effectId]);
      if (result.ok) {
        setDesign(JSON.parse(JSON.stringify(result.value)));
        setError(null);
      } else setError(result.error);
    },
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
      title: 'Render overrides JSON',
      content: <JsonReadOnlyPanel value={design} />,
    },
  ];

  const draftHistory = useDraftHistory({
    recordKey: firework.id,
    value: currentLocalSnapshot(),
    signature: currentSignature,
    restore: applySnapshot,
  });

  return (
    <FireworkEditorShell
      history={draftHistory}
      comparison={{ saved: showSaved, onChange: setShowSaved }}
      title={name || firework.name}
      chips={[{ label: 'Calibre', value: caliber.trim() || firework.caliber, icon: CircleDot }]}
      dirty={isDirty}
      saving={isPending}
      saveLabel="Save"
      saveDisabled={!designResult.ok || Boolean(renderError) || isPending}
      revertDisabled={!isDirty || isPending}
      onSave={save}
      onRevert={revertLocalChanges}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      tabs={tabs}
      preview={preview}
      transport={null}
      transportPlaying={false}
      error={error}
      renderDiagnostics={{
        recordId: firework.id,
        issues: !parsedOverrides.ok
          ? [{ path: [], message: parsedOverrides.error }]
          : !renderResult.ok
            ? renderResult.diagnostics
            : [],
      }}
      fullscreen={isFullscreen}
      onExitFullscreen={exitFullscreen}
    />
  );
}
