/** Local clip loading owns its object URL and keeps media decoding failures visible. */
'use client';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Viewer } from '@showcrafter/fireworks/view';
import { referenceTime, measuredShotTimes } from '@/lib/studio/reference';

const SYNC_TOLERANCE_S = 0.08; // Seconds, visual judgement: correct drift beyond two phone video frames.
/** Connects validated measured shot times to the reference clock; local clips start at zero. */
function useMeasuredShotTimes(shots?: unknown): number[] {
  return shots === undefined ? [] : measuredShotTimes(shots);
}
/** Loads only local video files and follows the draft's firing-relative clock, without uploading. */
export function ReferenceVideo({
  leader,
  measuredShots,
}: {
  leader: RefObject<Viewer | null>;
  measuredShots?: unknown;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [failure, setFailure] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const onsetS = useMeasuredShotTimes(measuredShots).at(0) ?? 0;
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  useEffect(() => {
    const active = leader.current;
    const clip = video.current;
    if (!active || !clip) return;
    const sync = () => {
      syncVideo(clip, active, onsetS, setFailure);
    };
    const unsubscribe = active.on(sync);
    clip.addEventListener('loadedmetadata', sync);
    return () => {
      unsubscribe();
      clip.pause();
      clip.removeEventListener('loadedmetadata', sync);
    };
  }, [leader, url, onsetS]);
  const choose = (candidate?: File) => {
    if (!candidate) return;
    if (!candidate.type.startsWith('video/')) {
      setFailure('Choose a video clip.');
      return;
    }
    setFailure('');
    setFile(candidate);
  };
  return (
    <div
      className="sc-studio-reference"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        choose(event.dataTransfer.files[0]);
      }}
    >
      <h2>Reference</h2>
      <label className="grid gap-2 p-3 text-sm">
        {file?.name ?? 'Drop a clip of the real firework'}
        <input
          type="file"
          aria-label="Reference video clip"
          accept="video/*"
          onChange={(event) => {
            choose(event.target.files?.[0]);
          }}
        />
      </label>
      <p className="px-3 text-xs">
        Local video only. Nothing is uploaded. Both previews follow the scrubber.
      </p>
      {url !== '' && (
        <video
          ref={video}
          src={url}
          muted
          playsInline
          preload="auto"
          aria-label="Reference clip"
          onError={() => {
            setFailure('This clip could not be decoded. Choose another video.');
          }}
        />
      )}
      {failure !== '' && (
        <p role="alert" className="p-3">
          {failure}
        </p>
      )}
    </div>
  );
}
function syncVideo(
  clip: HTMLVideoElement,
  active: Viewer,
  onsetS: number,
  fail: (message: string) => void,
) {
  if (!Number.isFinite(clip.duration)) return;
  const target = referenceTime(active.t, clip.duration, onsetS);
  if (!active.playing || Math.abs(clip.currentTime - target) > SYNC_TOLERANCE_S)
    clip.currentTime = target;
  if (active.playing && target < clip.duration) {
    if (clip.paused)
      void clip.play().catch((error: unknown) => {
        // A seek, pause or clip replacement can deliberately interrupt pending playback.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        fail('The clip could not play. Use the scrubber or choose another video.');
      });
  } else clip.pause();
}
