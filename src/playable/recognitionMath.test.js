import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
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

test('JavaScript inference matches Python reference scores for the committed model', () => {
  const fixture = JSON.parse(readFileSync('scripts/drawing-recognition/fixtures/model-parity.json', 'utf8'))
  const manifest = JSON.parse(readFileSync('public/models/drawing-recognizer/manifest.json', 'utf8'))
  const bytes = readFileSync('public/models/drawing-recognizer/weights.f32')
  const packed = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  assert.equal(fixture.modelSha256, manifest.sha256)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256)
  const layers = unpackLayers(packed, manifest.layerSizes)
  for (const sample of fixture.fixtures) {
    const actual = predictScores(Float32Array.from(sample.input), layers)
    assert.equal(actual.length, sample.expectedScores.length, `${sample.name}: output count`)
    for (let index = 0; index < actual.length; index += 1) {
      assert.ok(
        Math.abs(actual[index] - sample.expectedScores[index]) <= fixture.tolerance,
        `${sample.name}, ${manifest.labels[index]} differs: JS=${actual[index]} Python=${sample.expectedScores[index]} tolerance=${fixture.tolerance}`,
      )
    }
  }
})

test('JavaScript inference matches Python reference scores for all 25 batch-24 outputs', () => {
  const fixture = JSON.parse(readFileSync('scripts/drawing-recognition/fixtures/model-parity-24.json', 'utf8'))
  const manifest = JSON.parse(readFileSync('public/models/drawing-recognizer-24-candidate/manifest.json', 'utf8'))
  const bytes = readFileSync('public/models/drawing-recognizer-24-candidate/weights.f32')
  const packed = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  assert.equal(fixture.modelSha256, manifest.sha256)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256)
  const layers = unpackLayers(packed, manifest.layerSizes)
  for (const sample of fixture.fixtures) {
    const actual = predictScores(Float32Array.from(sample.input), layers)
    assert.equal(actual.length, sample.expectedScores.length, `${sample.name}: output count`)
    for (let index = 0; index < actual.length; index += 1) {
      assert.ok(
        Math.abs(actual[index] - sample.expectedScores[index]) <= fixture.tolerance,
        `${sample.name}, ${manifest.labels[index]} differs: JS=${actual[index]} Python=${sample.expectedScores[index]} tolerance=${fixture.tolerance}`,
      )
    }
  }
})
