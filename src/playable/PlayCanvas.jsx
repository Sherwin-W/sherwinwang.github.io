import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { catalog, resolveWord } from './catalog.js'
import { rasterizeStrokes } from './recognitionMath.js'
import {
  addObject, clampPoint, deleteObject, getObjectSize, initialInteraction, moveObject,
  transitionInteraction, trashContainsPoint,
} from './interaction.js'
import './PlayCanvas.css'

const LIMIT = 24
const makeId = () => `object-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const formatModelScore = (score) => score < 0.01 ? '<1%' : `${Math.round(score * 100)}%`
const STARTER_DELETE_KEY = 'playable-portfolio-starter-cat-deleted'

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
  const [objects, setObjects] = useState(initialObjects)
  const [dockHost, setDockHost] = useState(null)
  const [interaction, setInteraction] = useState(initialInteraction)
  const [mode, setMode] = useState('type')
  const [editor, setEditor] = useState(null)
  const [word, setWord] = useState('')
  const [resolution, setResolution] = useState(null)
  const [strokes, setStrokes] = useState([])
  const [drawingPoint, setDrawingPoint] = useState(null)
  const [recognition, setRecognition] = useState({ status: 'idle' })
  const [brush, setBrush] = useState(4)
  const [trashActive, setTrashActive] = useState(false)
  const [notice, setNotice] = useState('')
  const [hasSpawned, setHasSpawned] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const bounds = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight }
  }, [])

  const invalidateRecognition = () => {
    recognitionRequestRef.current += 1
    setRecognition({ status: 'idle' })
  }

  const clearDrawing = () => {
    invalidateRecognition()
    setStrokes([])
    setDrawingPoint(null)
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
      setEditor((current) => current ? { ...current, ...clampPoint(current.drawingPoint || current, size, 220) } : current)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [bounds])

  useEffect(() => () => {
    recognitionRequestRef.current += 1
    recognitionWorkerRef.current?.terminate()
    recognitionWorkerRef.current = null
  }, [])

  const closeEditor = () => {
    clearDrawing()
    setEditor(null)
    setWord('')
    setResolution(null)
    setNotice('')
    setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
  }

  const openEditor = (point) => {
    setEditor(clampPoint(point, bounds(), 220))
    setWord('')
    setResolution(null)
    setNotice('')
    setInteraction((current) => transitionInteraction(current, { type: 'TYPE' }))
  }

  const spawn = (entry, point) => {
    const result = addObject(objects, entry, point, bounds(), makeId())
    if (!result.added) {
      setNotice('The canvas is full. Delete an object to make room.')
      return false
    }
    setObjects(result.objects)
    setHasSpawned(true)
    setInteraction((current) => transitionInteraction(current, { type: 'SPAWN' }))
    return true
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

  const submitWord = (value = word) => {
    const result = resolveWord(value)
    if (result.status === 'match') {
      if (spawn(result.entry, editor?.drawingPoint || editor || { x: bounds().width / 2, y: bounds().height / 2 })) {
        closeEditor()
      }
      return
    }
    setResolution(result)
  }

  const chooseSuggestion = (entry) => {
    if (editor && spawn(entry, editor)) closeEditor()
    else if (!editor) {
      setResolution(null)
      setNotice('Choose what you drew, or type a word instead.')
      setEditor({ ...clampPoint({ x: bounds().width / 2, y: bounds().height / 2 }, bounds(), 220), drawingChoice: true })
      setWord(entry.label)
    }
  }

  const canvasPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onCanvasClick = (event) => {
    if (event.target !== event.currentTarget || mode !== 'type' || interaction.mode === 'dragging') return
    openEditor(canvasPoint(event))
  }

  const startDrag = (event, object) => {
    event.stopPropagation()
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
    const trashRect = trash?.getBoundingClientRect()
    const overTrash = trashContainsPoint({ x: event.clientX, y: event.clientY }, trashRect)
    trash?.classList.toggle('canvas-trash--active', overTrash)
    // Position updates touch only the captured wrapper, keeping the page render-free during movement.
    const element = event.currentTarget
    element.style.setProperty('--x', `${safe.x}px`)
    element.style.setProperty('--y', `${safe.y}px`)
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
      const trash = document.querySelector('.canvas-trash')
      if (drag.latest.overTrash || trashContainsPoint({ x: drag.latest.clientX, y: drag.latest.clientY }, trash?.getBoundingClientRect())) {
        animateDelete(drag.id)
      } else {
        setObjects((current) => moveObject(current, drag.id, drag.latest, bounds()))
        setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
      }
    } else {
      setInteraction((current) => transitionInteraction(current, { type: 'SELECT', id: drag.id }))
    }
  }

  const drawStart = (event) => {
    if (mode !== 'draw' || editor) return
    invalidateRecognition()
    setDrawingPoint(null)
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
    drawingRef.current.points.push(point)
    const current = drawingRef.current.points
    setStrokes((items) => items.map((stroke, index) => index === items.length - 1 ? { ...stroke, points: current } : stroke))
  }

  const drawEnd = (event) => {
    if (drawingRef.current?.pointerId === event.pointerId) drawingRef.current = null
  }

  const getDrawingCenter = (drawingStrokes = strokes) => {
    if (!drawingStrokes.length) return null
    const points = drawingStrokes.flatMap((stroke) => stroke.points)
    return {
      x: (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2,
      y: (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2,
    }
  }

  const chooseManually = () => {
    if (!strokes.length) { setNotice('Draw something first, then choose an object.'); return }
    invalidateRecognition()
    const point = drawingPoint || getDrawingCenter()
    setDrawingPoint(point)
    setEditor({ ...clampPoint({ x: bounds().width / 2, y: bounds().height / 2 }, bounds(), 220), drawingPoint: point, drawingChoice: true })
    setWord('')
    setResolution(null)
    setNotice('')
  }

  const recognizeDrawing = () => {
    if (!strokes.length) {
      invalidateRecognition()
      setRecognition({ status: 'blank' })
      return
    }
    const point = getDrawingCenter()
    setDrawingPoint(point)
    setNotice('')
    setEditor(null)
    const pixels = rasterizeStrokes(strokes)
    if (pixels.every((value) => value === 0)) {
      invalidateRecognition()
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
      if (message.id !== recognitionRequestRef.current || message.id !== requestId) return
      if (message.type === 'status') {
        setRecognition({ status: 'loading', requestId })
      } else if (message.type === 'error') {
        setRecognition({ status: 'error', message: message.message || 'Recognition failed.', requestId })
      } else if (message.type === 'result') {
        setRecognition({ ...message, status: message.blank ? 'blank' : message.isUnsupported ? 'unsupported' : 'result', requestId, elapsedMs: performance.now() - startedAt })
      }
    }
    worker.onerror = (event) => {
      if (requestId !== recognitionRequestRef.current) return
      worker.terminate()
      if (recognitionWorkerRef.current === worker) recognitionWorkerRef.current = null
      setRecognition({ status: 'error', message: event.message || 'Recognition worker failed.', requestId })
    }
    worker.postMessage({ type: 'recognize', id: requestId, pixels }, [pixels.buffer])
  }

  const typeInstead = () => {
    invalidateRecognition()
    setEditor((current) => ({ ...current, drawingChoice: false }))
    setMode('type')
    setWord('')
    setResolution(null)
    setNotice('')
  }

  const selectDrawn = (entry) => {
    const at = editor?.drawingPoint || drawingPoint || { x: bounds().width / 2, y: bounds().height / 2 }
    if (spawn(entry, at)) {
      clearDrawing()
      setMode('type')
      setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
      closeEditor()
    }
  }

  const selectRecognitionSuggestion = (label) => {
    const entry = catalog.find((item) => item.id === label)
    const at = drawingPoint || getDrawingCenter()
    if (entry && at && spawn(entry, at)) {
      clearDrawing()
      setMode('type')
      setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
    }
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
      if (event.key === 'Escape' && (editor || mode === 'draw')) {
        recognitionRequestRef.current += 1
        setRecognition({ status: 'idle' })
        setStrokes([])
        setDrawingPoint(null)
        setEditor(null)
        setWord('')
        setResolution(null)
        setNotice('')
        setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor, mode])

  return (
    <section className={`play-canvas play-canvas--${mode}${hasSpawned ? ' play-canvas--spawned' : ''}`} ref={canvasRef} onClick={onCanvasClick} aria-label="Play canvas">
      <div className="play-object-layer" aria-label="Canvas objects">
        {objects.map((object) => (
          <button
            className={`play-object${interaction.selectedId === object.id ? ' play-object--selected' : ''}${interaction.mode === 'dragging' && interaction.selectedId === object.id ? ' play-object--dragging' : ''}${deletingId === object.id ? ' play-object--deleting' : ''}`}
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

      <svg className="draw-board" aria-label="Drawing area" onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd} onPointerCancel={drawEnd}>
        {strokes.map((stroke) => <polyline className="draw-stroke" key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" strokeWidth={stroke.width} />)}
      </svg>

      {editor?.drawingChoice && <fieldset className="drawing-picker" onClick={(event) => event.stopPropagation()}>
        <legend>What did you draw?</legend>
        <p>Choose an object to replace your drawing. Automatic recognition is a separate experimental option.</p>
        <div className="drawing-picker__objects">
          {catalog.map((entry, index) => <button autoFocus={index === 0} type="button" key={entry.id} onClick={() => selectDrawn(entry)}>{entry.label}</button>)}
        </div>
        <div className="drawing-picker__actions">
          <button type="button" onClick={typeInstead}>Type instead</button>
          <button type="button" onClick={closeEditor}>Cancel</button>
        </div>
      </fieldset>}

      {recognition.status !== 'idle' && !editor?.drawingChoice && <fieldset
        className="recognition-panel"
        data-model-bytes={recognition.modelBytes}
        data-inference-ms={recognition.inferenceMs}
        data-worker-roundtrip-ms={recognition.elapsedMs}
        aria-live="polite"
        onClick={(event) => event.stopPropagation()}
      >
        <legend>Drawing recognition</legend>
        {recognition.status === 'loading' && <p role="status">Loading the local recognizer and analyzing your drawing…</p>}
        {recognition.status === 'blank' && <p role="status">There are no visible strokes to recognize. Draw something or choose an object manually.</p>}
        {recognition.status === 'error' && <p role="alert">Automatic recognition is unavailable: {recognition.message} Your drawing stays on this device. You can retry or choose manually.</p>}
        {recognition.status === 'unsupported' && <p role="status">This drawing may be outside the supported set. Closest supported suggestions:</p>}
        {recognition.status === 'result' && <p role="status">Best guess: {recognition.ranked?.find((item) => item.label !== 'other')?.label}. Choose a suggestion to add it.</p>}
        {(recognition.status === 'result' || recognition.status === 'unsupported') && <>
          <div className="recognition-suggestions" role="group" aria-label="Ranked drawing suggestions">
            {recognition.ranked?.filter((item) => item.label !== 'other').slice(0, 3).map((item, index) => {
              const entry = catalog.find((candidate) => candidate.id === item.label)
              return entry && <button type="button" key={entry.id} onClick={() => selectRecognitionSuggestion(entry.id)}>
                <span>{index + 1}. {entry.label}</span><small>{formatModelScore(item.score)} model score</small>
              </button>
            })}
          </div>
          <p className="recognition-disclaimer">Scores are uncalibrated model outputs, not probabilities of correctness.</p>
        </>}
        {recognition.status === 'blank' && <button type="button" onClick={chooseManually} disabled={!strokes.length}>Choose object</button>}
        {recognition.status === 'error' && <button type="button" onClick={recognizeDrawing}>Retry recognition</button>}
        {recognition.status !== 'blank' && <button type="button" onClick={chooseManually}>Choose object</button>}
        <button type="button" onClick={() => { invalidateRecognition(); setDrawingPoint(null) }}>Cancel</button>
        <button type="button" onClick={clearDrawing}>Clear and redraw</button>
      </fieldset>}

      {editor && !editor.drawingChoice && <form className="word-editor" style={{ '--x': `${editor.x}px`, '--y': `${editor.y}px` }} onSubmit={(event) => { event.preventDefault(); submitWord() }} onClick={(event) => event.stopPropagation()}>
        <label className="visually-hidden" htmlFor="play-word">Name an object</label>
        <div className="word-editor__row">
          <input autoFocus id="play-word" className="word-editor__input" value={word} maxLength={LIMIT} placeholder="e.g. cat" onChange={(event) => { setWord(event.target.value); setResolution(null); setNotice('') }} onKeyDown={(event) => { if (event.key === 'Escape') closeEditor() }} />
          <button type="submit" aria-label="Create object">Go</button>
          <button type="button" aria-label="Cancel" onClick={closeEditor}>Cancel</button>
        </div>
        {notice && <p className="word-editor__message" role="status">{notice}</p>}
        {resolution && resolution.status !== 'match' && <div className="word-editor__suggestions" role="group" aria-label="Object suggestions">
          <p className="word-editor__message">{resolution.status === 'unknown' ? 'No matching object yet. Try one of these:' : 'Choose a match:'}</p>
          {resolution.suggestions.slice(0, 3).map((entry) => <button type="button" key={entry.id} onClick={() => chooseSuggestion(entry)}>{entry.label}</button>)}
        </div>}
      </form>}

      {mode === 'draw' && !editor?.drawingChoice && recognition.status === 'idle' && <div className="draw-toolbar" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => { invalidateRecognition(); setStrokes((items) => items.slice(0, -1)) }}>Undo</button>
        <button type="button" onClick={clearDrawing}>Clear</button>
        <button type="button" aria-label={`Brush size ${brush} pixels; activate to change size`} onClick={() => setBrush((current) => current === 4 ? 7 : 4)}>Brush {brush}px</button>
        <button type="button" onClick={recognizeDrawing}>Recognize</button>
        <button type="button" onClick={chooseManually}>Choose object</button>
      </div>}

      {dockHost && createPortal(<>
        <div className="canvas-mode-controls" role="group" aria-label="Canvas mode">
          <button className="canvas-mode-button" type="button" aria-pressed={mode === 'type'} onClick={() => { closeEditor(); setMode('type'); setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' })) }}>Type</button>
          <button className="canvas-mode-button" type="button" aria-pressed={mode === 'draw'} onClick={() => { closeEditor(); setMode('draw'); setInteraction((current) => transitionInteraction(current, { type: 'DRAW' })) }}>Draw</button>
        </div>
        <button className={`canvas-trash${trashActive ? ' canvas-trash--active' : ''}`} type="button" aria-label="Trash. Select an object and press Delete, or drag it here." onClick={() => {
          if (interaction.selectedId) animateDelete(interaction.selectedId)
        }}><span aria-hidden="true"></span></button>
      </>, dockHost)}
      <span className="play-live-region" aria-live="polite">{notice || (hasSpawned ? '' : 'Click anywhere to name something.')}</span>
    </section>
  )
}
