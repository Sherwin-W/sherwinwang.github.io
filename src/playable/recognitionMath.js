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

/** Unpack the small CNN's named, contiguous tensor blocks from its manifest. */
export function unpackCnnWeights(weights, packing) {
  return Object.fromEntries(Object.entries(packing).map(([name, part]) => [
    name,
    weights.subarray(part.offsetFloats, part.offsetFloats + part.lengthFloats),
  ]))
}

function convolve(input, inputSize, inputChannels, outputChannels, weights, bias) {
  const output = new Float32Array(outputChannels * inputSize * inputSize)
  for (let channel = 0; channel < outputChannels; channel += 1) {
    for (let y = 0; y < inputSize; y += 1) {
      for (let x = 0; x < inputSize; x += 1) {
        let sum = bias[channel]
        for (let source = 0; source < inputChannels; source += 1) {
          for (let ky = -1; ky <= 1; ky += 1) {
            const sourceY = y + ky
            if (sourceY < 0 || sourceY >= inputSize) continue
            for (let kx = -1; kx <= 1; kx += 1) {
              const sourceX = x + kx
              if (sourceX < 0 || sourceX >= inputSize) continue
              const inputIndex = source * inputSize * inputSize + sourceY * inputSize + sourceX
              const weightIndex = channel * inputChannels * 9 + source * 9 + (ky + 1) * 3 + kx + 1
              sum += input[inputIndex] * weights[weightIndex]
            }
          }
        }
        output[channel * inputSize * inputSize + y * inputSize + x] = Math.max(0, sum)
      }
    }
  }
  return output
}

function maxPool2(input, channels, inputSize) {
  const outputSize = inputSize / 2
  const output = new Float32Array(channels * outputSize * outputSize)
  for (let channel = 0; channel < channels; channel += 1) {
    for (let y = 0; y < outputSize; y += 1) {
      for (let x = 0; x < outputSize; x += 1) {
        const source = channel * inputSize * inputSize + (y * 2) * inputSize + x * 2
        output[channel * outputSize * outputSize + y * outputSize + x] = Math.max(
          input[source], input[source + 1], input[source + inputSize], input[source + inputSize + 1],
        )
      }
    }
  }
  return output
}

function dense(input, weights, bias, outputSize, relu) {
  const output = new Float32Array(outputSize)
  for (let target = 0; target < outputSize; target += 1) {
    let sum = bias[target]
    for (let source = 0; source < input.length; source += 1) {
      sum += input[source] * weights[source * outputSize + target]
    }
    output[target] = relu ? Math.max(0, sum) : sum
  }
  return output
}

/** Run the fixed 28x28 conv8/conv16/dense64 browser candidate. */
export function predictCnnScores(input, model) {
  if (input.length !== 784) throw new Error('Drawing input has the wrong size')
  const first = maxPool2(convolve(input, 28, 1, 8, model.conv1Weights, model.conv1Bias), 8, 28)
  const second = maxPool2(convolve(first, 14, 8, 16, model.conv2Weights, model.conv2Bias), 16, 14)
  const hidden = dense(second, model.dense1Weights, model.dense1Bias, 64, true)
  const logits = dense(hidden, model.dense2Weights, model.dense2Bias, 25, false)
  let max = -Infinity
  for (const value of logits) max = Math.max(max, value)
  const exponential = logits.map((value) => Math.exp(value - max))
  const total = exponential.reduce((sum, value) => sum + value, 0)
  return exponential.map((value) => value / total)
}
