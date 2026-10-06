/** One-frame profiling keeps GPU queries asynchronous and discards disjoint measurements. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameProfiler } from '../src/view/frame-profile.ts';
import { UploadTimer } from '../src/view/upload-timer.ts';
class Context {
  TIME_ELAPSED_EXT = 1;
  GPU_DISJOINT_EXT = 2;
  QUERY_RESULT_AVAILABLE = 3;
  QUERY_RESULT = 4;
  available = false;
  disjoint = false;
  lost = false;
  deleted = [];
  active = null;
  created = 0;
  uploads = 0;
  getExtension() {
    return this;
  }
  createQuery() {
    return { id: ++this.created };
  }
  beginQuery(_target, query) {
    assert.equal(this.active, null);
    this.active = query;
  }
  endQuery() {
    this.active = null;
  }
  getParameter() {
    return this.disjoint;
  }
  isContextLost() {
    return this.lost;
  }
  getQueryParameter(_query, parameter) {
    if (parameter === this.QUERY_RESULT_AVAILABLE) return this.available;
    assert.equal(this.available, true, 'never block on an unavailable timer result');
    return 2_000_000;
  }
  deleteQuery(query) {
    this.deleted.push(query);
  }
  bufferData() {
    this.uploads++;
  }
  bufferSubData() {}
  texImage2D() {}
  texSubImage2D() {}
  texStorage2D() {}
}
test('profile accounts for nested spray work, restores upload APIs and waits for timer availability', () => {
  const gl = new Context();
  const original = gl.bufferData;
  const profiler = new FrameProfiler(gl);
  profiler.request();
  profiler.begin(14);
  profiler.sprayPhase(true);
  profiler.sprayPhase(false);
  profiler.simulation(2);
  profiler.pass('draw', () => gl.bufferData());
  profiler.pass('output', () => {});
  assert.equal(gl.bufferData, original);
  assert.equal(gl.uploads, 1);
  assert.equal(profiler.result.storageAllocations, 1);
  assert.equal(profiler.waiting, true);
  profiler.poll();
  assert.equal(profiler.result.gpuStatus, 'pending');
  assert.equal(profiler.result.drawGpuMs, null);
  gl.available = true;
  profiler.poll();
  assert.equal(profiler.result.gpuStatus, 'ready');
  assert.equal(profiler.result.drawGpuMs, 2);
  assert.equal(profiler.result.outputGpuMs, 2);
  assert.equal(profiler.waiting, false);
  assert.ok(profiler.result.sprayMs >= 0);
  assert.ok(profiler.result.uploadSubmitMs >= 0);
  assert.equal(gl.deleted.length, 2);
});
test('disjoint and context loss discard both GPU phases and retire pending queries', () => {
  for (const reason of ['disjoint', 'lost']) {
    const gl = new Context();
    const profiler = new FrameProfiler(gl);
    profiler.begin(14);
    profiler.pass('draw', () => {});
    profiler.pass('output', () => {});
    gl[reason] = true;
    profiler.poll();
    assert.equal(profiler.result.gpuStatus, 'disjoint');
    assert.equal(profiler.result.drawGpuMs, null);
    assert.equal(profiler.result.outputGpuMs, null);
    assert.equal(gl.deleted.length, 2);
    assert.equal(profiler.waiting, false);
  }
});
test('unsupported GPU timers retain CPU timings and new samples release previous queries', () => {
  const gl = new Context();
  gl.getExtension = () => null;
  const unsupported = new FrameProfiler(gl);
  unsupported.begin(5);
  unsupported.pass('draw', () => {});
  assert.equal(unsupported.result.gpuStatus, 'unsupported');
  assert.equal(unsupported.waiting, false);
  const supported = new FrameProfiler(new Context());
  supported.begin(5);
  supported.pass('draw', () => {});
  supported.request();
  assert.equal(supported.waiting, false);
  assert.equal(supported.result, null);
  assert.equal(supported.requested, true);
});
test('driver upload interception restores original descriptors after a thrown draw', () => {
  const gl = new Context();
  const original = gl.bufferData;
  const profiler = new UploadTimer(gl);
  assert.throws(
    () =>
      profiler.measure(() => {
        gl.bufferData();
        throw new Error('draw failed');
      }),
    /draw failed/,
  );
  assert.equal(gl.bufferData, original);
  assert.equal(Object.hasOwn(gl, 'bufferData'), false);
  assert.equal(gl.uploads, 1);
});

test('storage counters distinguish allocations from updates and reset each sample', () => {
  const gl = new Context();
  const profiler = new FrameProfiler(gl);
  profiler.begin(1);
  profiler.pass('draw', () => {
    gl.bufferData();
    gl.texStorage2D();
    gl.texImage2D();
    gl.bufferSubData();
    gl.texSubImage2D();
  });
  assert.equal(profiler.result.storageAllocations, 3);
  profiler.begin(2);
  profiler.pass('draw', () => {
    gl.bufferSubData();
    gl.texSubImage2D();
  });
  assert.equal(profiler.result.storageAllocations, 0);
});
