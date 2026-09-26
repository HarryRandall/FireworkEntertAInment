import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ParticlePool } from '../src/ParticlePool.ts';

const spawn = (pool, x, extra = {}) => pool.new({ x, y: 0, z: 0, life: 10, ...extra });

test('wraparound reuses a dead slot without replacing a live particle', () => {
  for (const compact of [false, true]) {
    const pool = new ParticlePool(3);
    const survivor = spawn(pool, 1);
    spawn(pool, 2).reset();
    spawn(pool, 3).reset();
    if (compact) pool.compactAliveMax();
    const next = spawn(pool, 4);
    assert.notEqual(next, survivor);
    assert.equal(survivor.x, 1);
    assert.equal(survivor.alive, true);
    assert.equal(next.alive, true);
    pool.compactAliveMax();
    assert.equal(pool.aliveCount, 2);
    assert.equal(new Set(pool.aliveIndices.slice(0, pool.aliveCount)).size, 2);
  }
});

test('a full pool declines emissions, then recovers after expiry and reset', () => {
  const pool = new ParticlePool(2);
  const first = spawn(pool, 1);
  const second = spawn(pool, 2);
  for (let i = 0; i < 10; i++) {
    assert.equal(spawn(pool, 3).alive, false);
    assert.deepEqual([first.x, second.x], [1, 2]);
  }
  second.reset();
  pool.compactAliveMax();
  assert.equal(spawn(pool, 4), second);
  assert.equal(first.x, 1);
  pool.reset();
  assert.equal(pool.aliveCount, 0);
  assert.equal(spawn(pool, 5).i, 0);
  assert.equal(spawn(pool, 6).i, 1);
});

test('invalid lifetimes cannot erase a live particle or advance allocation', () => {
  const pool = new ParticlePool(2);
  const first = spawn(pool, 1);
  for (const life of [0, -1, NaN, Infinity]) {
    assert.equal(spawn(pool, 2, { life }).alive, false);
    assert.equal(first.alive, true);
    assert.equal(first.x, 1);
    assert.equal(pool.current, 0);
  }
  assert.equal(spawn(pool, 3).i, 1);
});

test('restored occupancy and cursor make the same subsequent allocation', () => {
  const pool = new ParticlePool(4);
  const original = [spawn(pool, 1), spawn(pool, 2), spawn(pool, 3), spawn(pool, 4)];
  original[1].reset();
  pool.compactAliveMax();
  const indices = Array.from(pool.aliveIndices.slice(0, pool.aliveCount));
  const cursor = pool.current;
  const expected = spawn(pool, 5).i;
  pool.reset();
  for (const index of indices) pool.restore(index, pool.particles[index]);
  pool.current = cursor;
  const next = spawn(pool, 6);
  assert.equal(next.i, expected);
  assert.equal(pool.aliveCount, 4);
  assert.equal(new Set(pool.aliveIndices.slice(0, pool.aliveCount)).size, 4);
});

test('pool capacity is finite and non-zero', () => {
  for (const capacity of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => new ParticlePool(capacity), RangeError);
  }
});
