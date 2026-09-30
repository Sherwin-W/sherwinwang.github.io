import { predictScores, unpackLayers } from './recognitionMath.js'

const BASE_URL = import.meta.env.BASE_URL
let modelPromise

async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const root = `${BASE_URL}models/drawing-recognizer/`
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
      const layers = unpackLayers(weights, manifest.layerSizes)
      return { manifest, layers, modelBytes: bytes.byteLength }
    })().catch((error) => {
      modelPromise = null
      throw error
    })
  }
  return modelPromise
}

self.onmessage = async (event) => {
  const { id, pixels } = event.data || {}
  if (event.data?.type !== 'recognize') return
  try {
    self.postMessage({ id, type: 'status', status: 'loading' })
    const model = await loadModel()
    const input = pixels instanceof Float32Array ? pixels : new Float32Array(pixels)
    if (input.length !== 784) throw new Error('Drawing raster must contain 784 pixels')
    const ink = input.reduce((sum, value) => sum + value, 0)
    if (ink < 1.5) {
      self.postMessage({ id, type: 'result', blank: true, modelBytes: model.modelBytes, inferenceMs: 0 })
      return
    }
    const started = performance.now()
    const scores = Array.from(predictScores(input, model.layers))
    const inferenceMs = performance.now() - started
    const ranked = scores.map((score, index) => ({ label: model.manifest.labels[index], score }))
      .sort((left, right) => right.score - left.score)
    const topSupportedScore = Math.max(...ranked.filter((item) => item.label !== model.manifest.otherLabel).map((item) => item.score))
    self.postMessage({
      id, type: 'result', ranked,
      isUnsupported: ranked[0]?.label === model.manifest.otherLabel || topSupportedScore < model.manifest.unsupportedScoreThreshold,
      modelBytes: model.modelBytes, inferenceMs,
    })
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : 'Recognition failed' })
  }
}
