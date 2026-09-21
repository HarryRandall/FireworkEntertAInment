'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  AdminEditorVersion,
  AdminEditorVersionAction,
  AdminEditorVersionTargetKind,
} from '@/lib/admin.types';

const HISTORY_LIMIT = 24;

function sortVersions(versions: AdminEditorVersion[]): AdminEditorVersion[] {
  return [...versions]
    .sort((first, second) => {
      const firstTime = Date.parse(first.createdAt);
      const secondTime = Date.parse(second.createdAt);
      if (Number.isFinite(firstTime) && Number.isFinite(secondTime)) return secondTime - firstTime;
      return second.createdAt.localeCompare(first.createdAt);
    })
    .slice(0, HISTORY_LIMIT);
}

export function makeOptimisticEditorVersion({
  id,
  targetKind,
  targetId,
  action,
}: {
  id: string;
  targetKind: AdminEditorVersionTargetKind;
  targetId: string;
  action: AdminEditorVersionAction;
}): AdminEditorVersion {
  return {
    id,
    targetKind,
    fireworkId: targetKind === 'firework' ? targetId : null,
    fireworkEffectId: targetKind === 'effect' ? targetId : null,
    fireworkStyleDefaultId: targetKind === 'style_default' ? targetId : null,
    action,
    summary: action === 'restore' ? 'Restoring saved version' : 'Saving editor changes',
    snapshotJson: {},
    previousSnapshotJson: null,
    changesJson: {},
    createdBy: null,
    createdByLabel: 'You',
    createdAt: new Date().toISOString(),
  };
}

export function useEditorHistory({
  targetKey,
  initialVersions,
}: {
  targetKey: string;
  initialVersions: AdminEditorVersion[];
}) {
  const [versions, setVersions] = useState(initialVersions);
  const pendingIdsRef = useRef(new Set<string>());
  const localIdsRef = useRef(new Set<string>());
  const stateTargetKeyRef = useRef(targetKey);
  const latestTargetKeyRef = useRef(targetKey);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [warning, setWarning] = useState<string | null>(null);

  useLayoutEffect(() => {
    latestTargetKeyRef.current = targetKey;
  }, [targetKey]);

  useEffect(() => {
    if (stateTargetKeyRef.current !== targetKey) {
      stateTargetKeyRef.current = targetKey;
      pendingIdsRef.current.clear();
      localIdsRef.current.clear();
      setPendingIds(new Set());
      setVersions(initialVersions);
      setWarning(null);
      return;
    }

    const incomingIds = new Set(initialVersions.map((version) => version.id));
    for (const id of incomingIds) {
      pendingIdsRef.current.delete(id);
      localIdsRef.current.delete(id);
    }
    setPendingIds(new Set(pendingIdsRef.current));
    setVersions((current) => {
      const local = current.filter(
        (version) => localIdsRef.current.has(version.id) && !incomingIds.has(version.id),
      );
      return sortVersions([
        ...local,
        ...initialVersions.filter((version) => !local.some((item) => item.id === version.id)),
      ]);
    });
  }, [initialVersions, targetKey]);

  const begin = useCallback(
    (version: AdminEditorVersion) => {
      if (latestTargetKeyRef.current !== targetKey) return;
      setWarning(null);
      localIdsRef.current.add(version.id);
      pendingIdsRef.current.add(version.id);
      setPendingIds(new Set(pendingIdsRef.current));
      setVersions((current) =>
        sortVersions([version, ...current.filter((item) => item.id !== version.id)]),
      );
    },
    [targetKey],
  );

  const discard = useCallback(
    (versionId: string) => {
      if (latestTargetKeyRef.current !== targetKey) return;
      pendingIdsRef.current.delete(versionId);
      localIdsRef.current.delete(versionId);
      setPendingIds(new Set(pendingIdsRef.current));
      setVersions((current) => current.filter((version) => version.id !== versionId));
    },
    [targetKey],
  );

  const settle = useCallback(
    ({
      optimisticId,
      persistedVersion,
      recorded,
    }: {
      optimisticId: string;
      persistedVersion: AdminEditorVersion;
      recorded: boolean;
    }) => {
      if (latestTargetKeyRef.current !== targetKey) return;
      pendingIdsRef.current.delete(optimisticId);
      setPendingIds(new Set(pendingIdsRef.current));

      if (!recorded) {
        localIdsRef.current.delete(optimisticId);
        setVersions((current) => current.filter((version) => version.id !== optimisticId));
        setWarning('Version history was not recorded. Your editor changes are still saved.');
        return;
      }

      localIdsRef.current.add(persistedVersion.id);
      setWarning(null);
      setVersions((current) =>
        sortVersions([
          persistedVersion,
          ...current.filter(
            (version) => version.id !== optimisticId && version.id !== persistedVersion.id,
          ),
        ]),
      );
    },
    [targetKey],
  );

  return {
    versions,
    pendingIds,
    warning,
    begin,
    discard,
    settle,
  };
}
