const clamp01 = (value) => Math.max(0, Math.min(1, value))

/** Rasterize SVG pointer strokes to the centered 28×28 Quick, Draw! convention. */
export function rasterizeStrokes(strokes, side = 28) {
  const points = strokes.flatMap((stroke) => stroke.points || []).filter((point) =>
    Number.isFinite(point.x) && Number.isFinite(point.y))
  const pixels = new Float32Array(side * side)
  if (!points.length) return pixels

  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxX = Math.max(...points.map((point) => point.x))
  const maxY = Math.max(...points.map((point) => point.y))
  const extent = Math.max(maxX - minX, maxY - minY, 1)
  const scale = (side - 4) / extent
  const offsetX = (side - (maxX - minX) * scale) / 2
  const offsetY = (side - (maxY - minY) * scale) / 2
  const stamp = (x, y, radius) => {
    const fromX = Math.max(0, Math.floor(x - radius - 1))
    const toX = Math.min(side - 1, Math.ceil(x + radius + 1))
    const fromY = Math.max(0, Math.floor(y - radius - 1))
    const toY = Math.min(side - 1, Math.ceil(y + radius + 1))
    for (let py = fromY; py <= toY; py += 1) {
      for (let px = fromX; px <= toX; px += 1) {
        const distance = Math.hypot(px + 0.5 - x, py + 0.5 - y)
        const coverage = clamp01(radius + 0.65 - distance)
        const index = py * side + px
        if (coverage > pixels[index]) pixels[index] = coverage
      }
    }
  }

  for (const stroke of strokes) {
    const local = (stroke.points || []).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .map((point) => ({ x: (point.x - minX) * scale + offsetX, y: (point.y - minY) * scale + offsetY }))
    const radius = Math.max(0.5, Math.min(1.25, ((stroke.width || 4) * scale) / 2))
    if (local.length === 1) {
      stamp(local[0].x, local[0].y, radius)
      continue
    }
    for (let i = 1; i < local.length; i += 1) {
      const start = local[i - 1]
      const end = local[i]
      const distance = Math.hypot(end.x - start.x, end.y - start.y)
      const steps = Math.max(1, Math.ceil(distance * 2))
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps
        stamp(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t, radius)
      }
    }
  }
  return pixels
}

/** Decode row-major input×output float weights followed by bias for each layer. */
export function unpackLayers(weights, sizes) {
  const layers = []
  let offset = 0
  for (let index = 0; index < sizes.length - 1; index += 1) {
    const inputSize = sizes[index]
    const outputSize = sizes[index + 1]
    const weightCount = inputSize * outputSize
    const layerWeights = weights.subarray(offset, offset + weightCount)
    offset += weightCount
    const bias = weights.subarray(offset, offset + outputSize)
    offset += outputSize
    layers.push({ inputSize, outputSize, weights: layerWeights, bias, relu: index < sizes.length - 2 })
  }
  if (offset !== weights.length) throw new Error(`Model has ${weights.length - offset} unexpected float values`)
  return layers
}

export function predictScores(input, layers) {
  let values = input
  for (const layer of layers) {
    if (values.length !== layer.inputSize) throw new Error('Drawing input has the wrong size')
    const output = new Float32Array(layer.outputSize)
    for (let out = 0; out < layer.outputSize; out += 1) {
      let sum = layer.bias[out]
      for (let i = 0; i < layer.inputSize; i += 1) {
        sum += values[i] * layer.weights[i * layer.outputSize + out]
      }
      output[out] = layer.relu ? Math.max(0, sum) : sum
    }
    values = output
  }

  let max = -Infinity
  for (const value of values) max = Math.max(max, value)
  const exponentials = values.map((value) => Math.exp(value - max))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  return exponentials.map((value) => value / total)
}
