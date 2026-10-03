/** Per-phase diagnostics for an explicitly sampled finale frame. */
import type { FrameProfile } from '@showcrafter/fireworks/view';
// Three decimal places retain sub-millisecond CPU and GPU phase differences.
const TIMING_DECIMALS = 3;
/** Displays milliseconds from CPU boundaries and optional asynchronous GPU timer queries. */
export function FrameProfileReadout({ profile }: { profile: FrameProfile | null }) {
  if (!profile)
    return <p className="text-muted-foreground text-sm">Pause and seek, then profile one frame.</p>;
  const rows = [
    ['Non-spray simulation and frame writing', profile.simulationMs, null],
    ['Spray scheduling, birth sampling and packing', profile.sprayMs, null],
    ['Attribute packing and upload staging', profile.packingMs, null],
    ['Driver buffer and texture uploads', profile.uploadSubmitMs, null],
    ['Scene draw (GPU includes uploads)', profile.drawSubmitMs, profile.drawGpuMs],
    ['Output pass', profile.outputSubmitMs, profile.outputGpuMs],
  ] as const;
  return (
    <div data-testid="phase-profile" className="grid gap-2 text-sm">
      <p>
        Frame at {profile.time_s.toFixed(TIMING_DECIMALS)} s · GPU timers: {profile.gpuStatus}
      </p>
      <table className="w-full text-left">
        <caption className="sr-only">One frame's CPU and GPU phase times</caption>
        <thead>
          <tr>
            <th>Phase</th>
            <th>CPU ms</th>
            <th>GPU ms</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, cpu, gpu]) => (
            <tr key={name}>
              <th scope="row" className="font-normal">
                {name}
              </th>
              <td>{cpu.toFixed(TIMING_DECIMALS)}</td>
              <td>{gpu === null ? 'Unavailable' : gpu.toFixed(TIMING_DECIMALS)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground">
        Bloom: absent (0 passes). CPU times measure synchronous work, not GPU completion. Driver
        uploads happen lazily inside the scene draw. GPU results arrive asynchronously and are
        discarded on a disjoint. CPU spray mode includes the reference spark kernel in the spray
        phase. Profiling adds timing overhead.
      </p>
    </div>
  );
}
