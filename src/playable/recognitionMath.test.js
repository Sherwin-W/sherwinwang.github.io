import test from 'node:test'
import assert from 'node:assert/strict'
import { predictScores, rasterizeStrokes, unpackLayers } from './recognitionMath.js'

test('rasterizer handles blank, single-point and multi-stroke drawings', () => {
  assert.equal(rasterizeStrokes([]).every((pixel) => pixel === 0), true)
  const dot = rasterizeStrokes([{ width: 4, points: [{ x: 10, y: 10 }] }])
  assert.ok(dot.some((pixel) => pixel > 0))
  assert.equal(dot.length, 784)
  const line = rasterizeStrokes([
    { width: 4, points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
    { width: 4, points: [{ x: 100, y: 0 }, { x: 0, y: 100 }] },
  ])
  assert.ok(line.some((pixel) => pixel > 0))
  assert.ok(line.every((pixel) => pixel >= 0 && pixel <= 1))
})

test('small dense model unpacking and softmax ranking are deterministic', () => {
  // 2 inputs -> 2 ReLU units -> 2 output scores, packed as input-major weights then bias.
  const packed = new Float32Array([
    1, 0, 0, 1, 0, 0,
    1, 0, -1, 0,
    0, 0,
  ])
  const layers = unpackLayers(packed, [2, 2, 2])
  const scores = predictScores(new Float32Array([1, 0]), layers)
  assert.ok(scores[0] > scores[1])
  assert.ok(Math.abs(scores[0] + scores[1] - 1) < 1e-6)
  assert.throws(() => unpackLayers(new Float32Array([1]), [2, 2]))
})
