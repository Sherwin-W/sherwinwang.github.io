import { predictCnnScores, predictScores, unpackCnnWeights, unpackLayers } from './recognitionMath.js'

const BASE_URL = import.meta.env.BASE_URL
const modelPromises = new Map()

async function loadModel(modelName = 'active') {
  if (!modelPromises.has(modelName)) {
    const folder = modelName === 'baseline-mlp-24' ? 'drawing-recognizer-24-candidate' : 'drawing-recognizer-cnn'
    const root = `${BASE_URL}models/${folder}/`
    const promise = (async () => {
      const manifestResponse = await fetch(`${root}manifest.json`)
      if (!manifestResponse.ok) throw new Error(`Model manifest request failed (${manifestResponse.status})`)
      const manifest = await manifestResponse.json()
      const modelResponse = await fetch(`${root}${manifest.weightFile}`)
      if (!modelResponse.ok) throw new Error(`Model weights request failed (${modelResponse.status})`)
      const bytes = await modelResponse.arrayBuffer()
      if (bytes.byteLength !== manifest.weightBytes || bytes.byteLength % 4 !== 0) {
        throw new Error('Model weights are incomplete or have the wrong format')
      }
      if (globalThis.crypto?.subtle && manifest.sha256) {
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
        if (hash !== manifest.sha256) throw new Error('Model checksum did not match its manifest')
      }
      const weights = new Float32Array(bytes)
      const cnn = manifest.packing ? unpackCnnWeights(weights, manifest.packing) : null
      const layers = cnn ? null : unpackLayers(weights, manifest.layerSizes)
      return { manifest, cnn, layers, modelBytes: bytes.byteLength }
    })().catch((error) => {
      modelPromises.delete(modelName)
      throw error
    })
    modelPromises.set(modelName, promise)
  }
  return modelPromises.get(modelName)
}

self.onmessage = async (event) => {
  const { id, pixels, model = 'active' } = event.data || {}
  if (event.data?.type !== 'recognize') return
  try {
    self.postMessage({ id, type: 'status', status: 'loading' })
    const loadedModel = await loadModel(model)
    const input = pixels instanceof Float32Array ? pixels : new Float32Array(pixels)
    if (input.length !== 784) throw new Error('Drawing raster must contain 784 pixels')
    const ink = input.reduce((sum, value) => sum + value, 0)
    if (ink < 1.5) {
      self.postMessage({ id, type: 'result', blank: true, modelBytes: loadedModel.modelBytes, inferenceMs: 0 })
      return
    }
    const started = performance.now()
    const scores = Array.from(loadedModel.cnn
      ? predictCnnScores(input, loadedModel.cnn)
      : predictScores(input, loadedModel.layers))
    const inferenceMs = performance.now() - started
    const ranked = scores.map((score, index) => ({ label: loadedModel.manifest.labels[index], score }))
      .sort((left, right) => right.score - left.score)
    const topSupportedScore = Math.max(...ranked.filter((item) => item.label !== loadedModel.manifest.otherLabel).map((item) => item.score))
    const autoSpawnMargin = ranked[0]?.score - ranked[1]?.score
    self.postMessage({
      id, type: 'result', ranked,
      isUnsupported: ranked[0]?.label === loadedModel.manifest.otherLabel || topSupportedScore < loadedModel.manifest.unsupportedScoreThreshold,
      autoSpawnAccepted: ranked[0]?.label !== loadedModel.manifest.otherLabel
        && ranked[0]?.score >= loadedModel.manifest.autoSpawnScoreThreshold
        && autoSpawnMargin >= loadedModel.manifest.autoSpawnMarginThreshold
        && loadedModel.manifest.autoSpawnLabels?.includes(ranked[0]?.label) === true,
      autoSpawnMargin,
      modelBytes: loadedModel.modelBytes, inferenceMs,
    })
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : 'Recognition failed' })
  }
}
