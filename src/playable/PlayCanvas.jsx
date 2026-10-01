import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { catalog } from './catalog.js'
import { rasterizeStrokes } from './recognitionMath.js'
import {
  addObject, clampPoint, deleteObject, getObjectSize, initialInteraction, moveObject,
  transitionInteraction, trashContainsPoint,
} from './interaction.js'
import './PlayCanvas.css'

const makeId = () => `object-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const formatModelScore = (score) => score < 0.01 ? '<1%' : `${Math.round(score * 100)}%`
const STARTER_DELETE_KEY = 'playable-portfolio-starter-cat-deleted'
const PAUSE_BEFORE_RECOGNITION_MS = 1500
const INK_TRANSITION_MS = 440

function initialObjects() {
  const bounds = { width: window.innerWidth, height: window.innerHeight }
  if (window.sessionStorage.getItem(STARTER_DELETE_KEY) === 'true') return []
  const size = getObjectSize(bounds.width)
  const point = { x: bounds.width * 0.68, y: bounds.height * 0.58 }
  return [{ id: 'starter-cat', entry: catalog.find((entry) => entry.id === 'cat'), size, starter: true, ...clampPoint(point, bounds, size) }]
}

export default function PlayCanvas() {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const drawingRef = useRef(null)
  const recognitionWorkerRef = useRef(null)
  const recognitionRequestRef = useRef(0)
  const drawingRevisionRef = useRef(0)
  const autoTimerRef = useRef(null)
  const transitionTimerRef = useRef(null)
  const suppressAutoRef = useRef(false)
  const creationLockRef = useRef(false)
  const appliedRequestsRef = useRef(new Set())
  const [objects, setObjects] = useState(initialObjects)
  const [dockHost, setDockHost] = useState(null)
  const [interaction, setInteraction] = useState(initialInteraction)
  const [mode, setMode] = useState('select')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [strokes, setStrokes] = useState([])
  const [recognition, setRecognition] = useState({ status: 'idle' })
  const [brush, setBrush] = useState(4)
  const [trashActive, setTrashActive] = useState(false)
  const [notice, setNotice] = useState('')
  const [hasSpawned, setHasSpawned] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [transformation, setTransformation] = useState(null)
  const [inkTransforming, setInkTransforming] = useState(false)

  const bounds = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight }
  }, [])

  const cancelTimer = useCallback(() => {
    if (autoTimerRef.current !== null) window.clearTimeout(autoTimerRef.current)
    autoTimerRef.current = null
  }, [])

  const invalidateRecognition = useCallback((suppressAuto = false) => {
    cancelTimer()
    recognitionRequestRef.current += 1
    if (suppressAuto) suppressAutoRef.current = true
    setRecognition({ status: 'idle' })
  }, [cancelTimer])

  const clearDrawing = () => {
    invalidateRecognition(true)
    drawingRef.current = null
    drawingRevisionRef.current += 1
    creationLockRef.current = false
    setStrokes([])
    setTransformation(null)
    setInkTransforming(false)
    setNotice('')
  }

  useEffect(() => {
    setDockHost(document.getElementById('play-dock-controls'))
  }, [])

  useEffect(() => {
    const onResize = () => {
      const size = bounds()
      setObjects((current) => current.map((object) => {
        const objectSize = getObjectSize(size.width)
        return { ...object, size: objectSize, ...clampPoint(object, size, objectSize) }
      }))
    }
    const onPortfolioSheet = () => {
      invalidateRecognition(true)
      drawingRef.current = null
      drawingRevisionRef.current += 1
      setPickerOpen(false)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('portfolio:sheet-open', onPortfolioSheet)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('portfolio:sheet-open', onPortfolioSheet)
      cancelTimer()
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
      recognitionRequestRef.current += 1
      recognitionWorkerRef.current?.terminate()
      recognitionWorkerRef.current = null
    }
  }, [bounds, cancelTimer, invalidateRecognition])

  const spawn = (entry, point) => {
    const result = addObject(objects, entry, point, bounds(), makeId())
    if (!result.added) {
      setNotice('The canvas is full. Delete an object to make room.')
      return null
    }
    const added = result.objects.find((object) => !objects.some((current) => current.id === object.id))
    setObjects(result.objects)
    setHasSpawned(true)
    setInteraction((current) => transitionInteraction(current, { type: 'SPAWN' }))
    return added
  }

  const animateDelete = (id) => {
    const object = objects.find((item) => item.id === id)
    if (!object || deletingId) return
    setDeletingId(id)
    window.setTimeout(() => {
      setObjects((current) => deleteObject(current, id))
      if (object.starter) window.sessionStorage.setItem(STARTER_DELETE_KEY, 'true')
      setDeletingId(null)
      setInteraction((current) => transitionInteraction(current, { type: 'DELETE' }))
      setNotice(`${object.entry.label} sent to trash.`)
    }, 220)
  }

  const canvasPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const getDrawingCenter = (drawingStrokes = strokes) => {
    const points = drawingStrokes.flatMap((stroke) => stroke.points)
    if (!points.length) return null
    return {
      x: (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2,
      y: (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2,
    }
  }

  const performTransformation = (entry, source, requestId = null, workerMetrics = {}) => {
    if (creationLockRef.current || (requestId !== null && appliedRequestsRef.current.has(requestId))) return false
    creationLockRef.current = true
    const original = strokes
    const center = getDrawingCenter(original) || { x: bounds().width / 2, y: bounds().height / 2 }
    const created = spawn(entry, center)
    if (!created) {
      creationLockRef.current = false
      return false
    }
    if (requestId !== null) appliedRequestsRef.current.add(requestId)
    cancelTimer()
    setTransformation({ objectId: created.id, objectLabel: entry.label, original, source })
    setInkTransforming(true)
    setRecognition({ status: 'transformed', objectLabel: entry.label, ...workerMetrics })
    setPickerOpen(false)
    setNotice('')
    setMode('select')
    setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = window.setTimeout(() => {
      setStrokes([])
      setInkTransforming(false)
      transitionTimerRef.current = null
    }, INK_TRANSITION_MS)
    return true
  }

  const chooseCatalogObject = (entry) => {
    invalidateRecognition(true)
    if (strokes.length) {
      performTransformation(entry, 'manual')
      return
    }
    const created = spawn(entry, { x: bounds().width / 2, y: bounds().height / 2 })
    if (created) {
      setPickerOpen(false)
      setMode('select')
      creationLockRef.current = false
    }
  }

  const startDrag = (event, object) => {
    event.stopPropagation()
    if (mode !== 'select') return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = canvasPoint(event)
    dragRef.current = { id: object.id, pointerId: event.pointerId, start: point, origin: { x: object.x, y: object.y }, moved: false }
    setInteraction((current) => transitionInteraction(current, { type: 'DRAG_START', id: object.id }))
  }

  const moveDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = canvasPoint(event)
    if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 2) drag.moved = true
    if (!drag.moved) return
    const safe = clampPoint(point, bounds())
    const trash = document.querySelector('.canvas-trash')
    const overTrash = trashContainsPoint({ x: event.clientX, y: event.clientY }, trash?.getBoundingClientRect())
    trash?.classList.toggle('canvas-trash--active', overTrash)
    event.currentTarget.style.setProperty('--x', `${safe.x}px`)
    event.currentTarget.style.setProperty('--y', `${safe.y}px`)
    drag.latest = { ...safe, clientX: event.clientX, clientY: event.clientY, overTrash }
  }

  const endDrag = (event, cancelled = false) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setTrashActive(false)
    document.querySelector('.canvas-trash')?.classList.remove('canvas-trash--active')
    if (cancelled) {
      event.currentTarget.style.setProperty('--x', `${drag.origin.x}px`)
      event.currentTarget.style.setProperty('--y', `${drag.origin.y}px`)
      setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
      return
    }
    if (drag.moved && drag.latest) {
      if (drag.latest.overTrash || trashContainsPoint({ x: drag.latest.clientX, y: drag.latest.clientY }, document.querySelector('.canvas-trash')?.getBoundingClientRect())) {
        animateDelete(drag.id)
      } else {
        setObjects((current) => moveObject(current, drag.id, drag.latest, bounds()))
        setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
      }
    } else setInteraction((current) => transitionInteraction(current, { type: 'SELECT', id: drag.id }))
  }

  const recognizeDrawing = (explicit = false, expectedRevision = drawingRevisionRef.current) => {
    cancelTimer()
    if (drawingRef.current || expectedRevision !== drawingRevisionRef.current) return
    if (suppressAutoRef.current && !explicit) return
    const currentStrokes = strokes
    if (!currentStrokes.length) {
      setRecognition({ status: 'blank' })
      return
    }
    const pixels = rasterizeStrokes(currentStrokes)
    if (pixels.every((value) => value === 0)) {
      setRecognition({ status: 'blank' })
      return
    }
    let worker = recognitionWorkerRef.current
    try {
      if (!worker) {
        worker = new Worker(new URL('./recognizer.worker.js', import.meta.url), { type: 'module' })
        recognitionWorkerRef.current = worker
      }
    } catch (error) {
      setRecognition({ status: 'error', message: error instanceof Error ? error.message : 'Recognition could not start.' })
      return
    }
    const requestId = ++recognitionRequestRef.current
    const startedAt = performance.now()
    setRecognition({ status: 'loading', requestId })
    worker.onmessage = (event) => {
      const message = event.data
      if (message.id !== recognitionRequestRef.current || message.id !== requestId || expectedRevision !== drawingRevisionRef.current || drawingRef.current) return
      if (message.type === 'status') {
        setRecognition({ status: 'loading', requestId })
      } else if (message.type === 'error') {
        setRecognition({ status: 'error', message: message.message || 'Recognition failed.', requestId })
      } else if (message.type === 'result') {
        const ranked = message.ranked || []
        const bestSupported = ranked.find((item) => item.label !== 'other')
        const bestEntry = bestSupported && catalog.find((entry) => (entry.recognitionLabel || entry.id) === bestSupported.label)
        if (message.autoSpawnAccepted && bestEntry && (explicit || !suppressAutoRef.current)) {
          performTransformation(bestEntry, 'automatic', requestId, {
            elapsedMs: performance.now() - startedAt,
            inferenceMs: message.inferenceMs,
            modelBytes: message.modelBytes,
            ranked: message.ranked,
            autoSpawnAccepted: message.autoSpawnAccepted,
            autoSpawnMargin: message.autoSpawnMargin,
          })
          return
        }
        setRecognition({
          ...message,
          status: message.blank ? 'blank' : message.isUnsupported ? 'unsupported' : 'uncertain',
          requestId,
          elapsedMs: performance.now() - startedAt,
        })
      }
    }
    worker.onerror = (event) => {
      if (requestId !== recognitionRequestRef.current || expectedRevision !== drawingRevisionRef.current) return
      worker.terminate()
      if (recognitionWorkerRef.current === worker) recognitionWorkerRef.current = null
      setRecognition({ status: 'error', message: event.message || 'Recognition worker failed.', requestId })
    }
    worker.postMessage({ type: 'recognize', id: requestId, pixels }, [pixels.buffer])
  }

  const scheduleRecognition = (revision) => {
    cancelTimer()
    if (suppressAutoRef.current || drawingRef.current) return
    autoTimerRef.current = window.setTimeout(() => {
      autoTimerRef.current = null
      recognizeDrawing(false, revision)
    }, PAUSE_BEFORE_RECOGNITION_MS)
  }

  const drawStart = (event) => {
    if (mode !== 'brush' || pickerOpen) return
    cancelTimer()
    recognitionRequestRef.current += 1
    setRecognition({ status: 'idle' })
    suppressAutoRef.current = false
    creationLockRef.current = false
    setTransformation(null)
    setInkTransforming(false)
    drawingRevisionRef.current += 1
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = canvasPoint(event)
    drawingRef.current = { pointerId: event.pointerId, points: [point] }
    setStrokes((current) => [...current, { id: makeId(), points: [point], width: brush }])
  }

  const drawMove = (event) => {
    if (!drawingRef.current || drawingRef.current.pointerId !== event.pointerId) return
    event.preventDefault()
    const point = canvasPoint(event)
    const current = [...(drawingRef.current.points || []), point]
    drawingRef.current.points = current
    setStrokes((items) => items.map((stroke, index) => index === items.length - 1 ? { ...stroke, points: current } : stroke))
  }

  const drawEnd = (event) => {
    if (drawingRef.current?.pointerId !== event.pointerId) return
    drawingRef.current = null
    scheduleRecognition(drawingRevisionRef.current)
  }

  const cancelDraw = (event) => {
    if (drawingRef.current?.pointerId !== event.pointerId) return
    drawingRef.current = null
    invalidateRecognition(true)
    drawingRevisionRef.current += 1
  }

  const undoStroke = () => {
    invalidateRecognition(true)
    drawingRef.current = null
    drawingRevisionRef.current += 1
    creationLockRef.current = false
    setStrokes((current) => current.slice(0, -1))
    setTransformation(null)
    setInkTransforming(false)
  }

  const undoTransformation = () => {
    if (!transformation) return
    cancelTimer()
    recognitionRequestRef.current += 1
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = null
    setObjects((current) => deleteObject(current, transformation.objectId))
    setStrokes(transformation.original)
    setTransformation(null)
    setInkTransforming(false)
    setRecognition({ status: 'restored' })
    setMode('brush')
    suppressAutoRef.current = true
    creationLockRef.current = false
    drawingRevisionRef.current += 1
    setNotice('Sketch restored. It will stay unchanged until you edit it or retry recognition.')
  }

  const changeMode = useCallback((nextMode) => {
    if (nextMode === mode) return
    invalidateRecognition(true)
    if (drawingRef.current) drawingRef.current = null
    drawingRevisionRef.current += 1
    setPickerOpen(false)
    setMode(nextMode)
    setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
  }, [invalidateRecognition, mode])

  const openPicker = () => {
    invalidateRecognition(true)
    if (drawingRef.current) drawingRef.current = null
    drawingRevisionRef.current += 1
    setPickerOpen(true)
  }

  const acceptSuggestion = (label) => {
    const entry = catalog.find((item) => item.id === label)
    if (entry) performTransformation(entry, 'suggested', recognition.requestId)
  }

  const keyDown = (event, id) => {
    const object = objects.find((item) => item.id === id)
    if (!object) return
    const deltas = { ArrowUp: [0, -8], ArrowDown: [0, 8], ArrowLeft: [-8, 0], ArrowRight: [8, 0] }
    if (deltas[event.key]) {
      event.preventDefault()
      const [dx, dy] = deltas[event.key]
      setObjects((current) => moveObject(current, id, { x: object.x + dx, y: object.y + dy }, bounds()))
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      animateDelete(id)
    }
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        if (pickerOpen) setPickerOpen(false)
        else if (recognition.status !== 'idle') invalidateRecognition(true)
        else if (mode === 'brush') changeMode('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [changeMode, invalidateRecognition, mode, pickerOpen, recognition.status])

  return (
    <section className={`play-canvas play-canvas--${mode}${hasSpawned ? ' play-canvas--spawned' : ''}${inkTransforming ? ' play-canvas--transforming' : ''}`} ref={canvasRef} aria-label="Play canvas">
      <div className="play-object-layer" aria-label="Canvas objects">
        {objects.map((object) => (
          <button
            className={`play-object${interaction.selectedId === object.id ? ' play-object--selected' : ''}${interaction.mode === 'dragging' && interaction.selectedId === object.id ? ' play-object--dragging' : ''}${deletingId === object.id ? ' play-object--deleting' : ''}${transformation?.objectId === object.id ? ' play-object--transformed' : ''}`}
            key={object.id} type="button" aria-label={`${object.entry.label}, use arrow keys to move or Delete to remove`}
            style={{ '--x': `${object.x}px`, '--y': `${object.y}px`, '--object-size': `${object.size}px` }}
            onPointerDown={(event) => startDrag(event, object)}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            onKeyDown={(event) => keyDown(event, object.id)}
          >
            <span className="play-object-sprite"><img src={`/objects/${object.entry.id}.svg`} width={object.size} height={object.size} alt="" draggable="false" /></span>
          </button>
        ))}
      </div>

      <svg className="draw-board" aria-label="Drawing surface" onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd} onPointerCancel={cancelDraw}>
        {strokes.map((stroke) => <g key={stroke.id} className={inkTransforming ? 'draw-stroke-group draw-stroke-group--transforming' : 'draw-stroke-group'}>
          <polyline className="draw-stroke-glow" points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" strokeWidth={stroke.width * 3.5} />
          <polyline className="draw-stroke-core" points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" strokeWidth={stroke.width} />
        </g>)}
      </svg>

      {mode === 'brush' && !pickerOpen && recognition.status === 'idle' && <div className="draw-toolbar" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={undoStroke} disabled={!strokes.length}>Undo stroke</button>
        <button type="button" onClick={clearDrawing}>Clear</button>
        <button type="button" aria-label={`Brush size ${brush} pixels; activate to change size`} onClick={() => setBrush((current) => current === 4 ? 7 : 4)}>Size {brush}px</button>
        <button type="button" onClick={openPicker}>Choose object</button>
      </div>}

      {pickerOpen && <fieldset className="drawing-picker" onPointerDown={(event) => event.stopPropagation()}>
        <legend>Choose an object</legend>
        <p>{strokes.length ? 'Choose an object to replace your sketch.' : 'Choose an object to add to the canvas.'}</p>
        <div className="drawing-picker__objects">
          {catalog.map((entry) => <button type="button" key={entry.id} onClick={() => chooseCatalogObject(entry)}>{entry.label}</button>)}
        </div>
        <div className="drawing-picker__actions"><button type="button" onClick={() => setPickerOpen(false)}>Cancel</button></div>
      </fieldset>}

      {recognition.status !== 'idle' && !pickerOpen && <fieldset className="recognition-panel"
        data-model-bytes={recognition.modelBytes} data-inference-ms={recognition.inferenceMs} data-worker-roundtrip-ms={recognition.elapsedMs}
        data-ranked-labels={recognition.ranked?.map((item) => item.label).join(',')}
        aria-live="polite" onPointerDown={(event) => event.stopPropagation()}>
        <legend>{recognition.status === 'transformed' ? 'Sketch transformed' : recognition.status === 'restored' ? 'Sketch restored' : 'Drawing recognition'}</legend>
        {recognition.status === 'loading' && <p role="status">Your drawing is paused. Recognizing it on this device…</p>}
        {recognition.status === 'error' && <p role="alert">Automatic recognition is unavailable: {recognition.message} Your drawing stays on this device.</p>}
        {recognition.status === 'blank' && <p role="status">There are no visible strokes. Draw something or choose an object.</p>}
        {recognition.status === 'uncertain' && <p role="status">Not sure what you drew. Choose a suggestion or open the object picker.</p>}
        {recognition.status === 'unsupported' && <p role="status">This may be outside the supported set. Your drawing is preserved; choose a suggestion or another object.</p>}
        {recognition.status === 'transformed' && <p role="status">{recognition.objectLabel} added at the center of your sketch.</p>}
        {recognition.status === 'restored' && <p role="status">Your original sketch is back. It will not be checked again unless you edit it or retry.</p>}
        {(recognition.status === 'uncertain' || recognition.status === 'unsupported') && <>
          <div className="recognition-suggestions" role="group" aria-label="Ranked drawing suggestions">
            {recognition.ranked?.filter((item) => item.label !== 'other').slice(0, 3).map((item, index) => {
              const entry = catalog.find((candidate) => (candidate.recognitionLabel || candidate.id) === item.label)
              return entry && <button type="button" key={entry.id} onClick={() => acceptSuggestion(entry.id)}>
                <span>{index + 1}. {entry.label}</span><small>{formatModelScore(item.score)} model score</small>
              </button>
            })}
          </div>
          <p className="recognition-disclaimer">Model scores are uncalibrated and are not probabilities of correctness.</p>
        </>}
        {recognition.status === 'transformed' && <button type="button" onClick={undoTransformation}>Undo transformation</button>}
        {recognition.status === 'restored' && <button type="button" onClick={() => recognizeDrawing(true)}>Retry recognition</button>}
        {recognition.status === 'error' && <button type="button" onClick={() => recognizeDrawing(true)}>Retry recognition</button>}
        {(recognition.status === 'uncertain' || recognition.status === 'unsupported' || recognition.status === 'error' || recognition.status === 'blank') && <button type="button" onClick={openPicker}>Choose object</button>}
        {recognition.status === 'loading' && <button type="button" onClick={() => invalidateRecognition(true)}>Cancel</button>}
        {recognition.status !== 'transformed' && <button type="button" onClick={clearDrawing}>Clear</button>}
        {recognition.status === 'transformed' && <button type="button" onClick={() => { setRecognition({ status: 'idle' }); setTransformation(null); }}>Keep object</button>}
      </fieldset>}

      {dockHost && createPortal(<>
        <div className="canvas-mode-controls" role="group" aria-label="Canvas mode">
          <button className="canvas-mode-button" type="button" aria-pressed={mode === 'select'} onClick={() => changeMode('select')}>Select</button>
          <button className="canvas-mode-button canvas-mode-button--brush" type="button" aria-pressed={mode === 'brush'} onClick={() => changeMode('brush')}>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 19 1.4-4.2L16.8 4.4a1.7 1.7 0 0 1 2.4 2.4L8.8 17.2 5 19Z"/><path d="m14.8 6.4 2.8 2.8M5 19l3.8-1.8"/></svg>Brush
          </button>
          <button className="canvas-mode-button" type="button" onClick={openPicker}>Objects</button>
        </div>
        <button className={`canvas-trash${trashActive ? ' canvas-trash--active' : ''}`} type="button" aria-label="Trash. Select an object and press Delete, or drag it here." onClick={() => {
          if (interaction.selectedId) animateDelete(interaction.selectedId)
        }}><span aria-hidden="true"></span></button>
      </>, dockHost)}
      <span className="play-live-region" aria-live="polite">{notice || (hasSpawned ? '' : 'Select and drag objects, or switch to Brush to draw.')}</span>
    </section>
  )
}
