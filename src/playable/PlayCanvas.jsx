import { useCallback, useEffect, useRef, useState } from 'react'
import { catalog, resolveWord } from './catalog.js'
import {
  addObject, clampPoint, deleteObject, initialInteraction, moveObject,
  OBJECT_SIZE, transitionInteraction, trashContainsPoint,
} from './interaction.js'
import './PlayCanvas.css'

const LIMIT = 24
const makeId = () => `object-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export default function PlayCanvas() {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const drawingRef = useRef(null)
  const [objects, setObjects] = useState([])
  const [interaction, setInteraction] = useState(initialInteraction)
  const [mode, setMode] = useState('type')
  const [editor, setEditor] = useState(null)
  const [word, setWord] = useState('')
  const [resolution, setResolution] = useState(null)
  const [strokes, setStrokes] = useState([])
  const [brush, setBrush] = useState(4)
  const [trashActive, setTrashActive] = useState(false)
  const [notice, setNotice] = useState('')
  const [hasSpawned, setHasSpawned] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const bounds = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight }
  }, [])

  useEffect(() => {
    const onResize = () => {
      const size = bounds()
      setObjects((current) => current.map((object) => ({ ...object, ...clampPoint(object, size) })))
      setEditor((current) => current ? { ...current, ...clampPoint(current, size, 220) } : current)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [bounds])

  const closeEditor = () => {
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
      setDeletingId(null)
      setInteraction((current) => transitionInteraction(current, { type: 'DELETE' }))
      setNotice(`${object.entry.label} sent to trash.`)
    }, 220)
  }

  const submitWord = (value = word) => {
    const result = resolveWord(value)
    if (result.status === 'match') {
      if (spawn(result.entry, editor || { x: bounds().width / 2, y: bounds().height / 2 })) closeEditor()
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
    const trash = canvasRef.current.querySelector('.canvas-trash')
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
    canvasRef.current?.querySelector('.canvas-trash')?.classList.remove('canvas-trash--active')
    if (cancelled) {
      event.currentTarget.style.setProperty('--x', `${drag.origin.x}px`)
      event.currentTarget.style.setProperty('--y', `${drag.origin.y}px`)
      setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' }))
      return
    }
    if (drag.moved && drag.latest) {
      const trash = canvasRef.current.querySelector('.canvas-trash')
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

  const beginCreate = () => {
    if (!strokes.length) { setNotice('Draw something first, then choose Create.'); return }
    setEditor({ ...clampPoint({ x: bounds().width / 2, y: bounds().height / 2 }, bounds(), 220), drawingChoice: true })
    setWord('')
    setResolution({ status: 'unknown', suggestions: catalog.slice(0, 3) })
    setNotice('Choose what you drew from the catalog, or type instead.')
    setInteraction((current) => transitionInteraction(current, { type: 'TYPE' }))
  }

  const selectDrawn = (entry) => {
    const at = { x: bounds().width / 2, y: bounds().height / 2 }
    if (spawn(entry, at)) {
      setStrokes([])
      closeEditor()
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
        closeEditor()
        setStrokes([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor, mode])

  return (
    <section className={`play-canvas play-canvas--${mode}`} ref={canvasRef} onClick={onCanvasClick} aria-label="Play canvas">
      <div className="play-object-layer" aria-label="Canvas objects">
        {objects.map((object) => (
          <button
            className={`play-object${interaction.selectedId === object.id ? ' play-object--selected' : ''}${interaction.mode === 'dragging' && interaction.selectedId === object.id ? ' play-object--dragging' : ''}${deletingId === object.id ? ' play-object--deleting' : ''}`}
            key={object.id} type="button" aria-label={`${object.entry.label}, use arrow keys to move or Delete to remove`}
            style={{ '--x': `${object.x}px`, '--y': `${object.y}px` }}
            onPointerDown={(event) => startDrag(event, object)}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            onKeyDown={(event) => keyDown(event, object.id)}
          >
            <span className="play-object-sprite"><img src={`/objects/${object.entry.id}.svg`} width={OBJECT_SIZE} height={OBJECT_SIZE} alt="" draggable="false" /></span>
          </button>
        ))}
      </div>

      <svg className="draw-board" aria-label="Drawing area" onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd} onPointerCancel={drawEnd}>
        {strokes.map((stroke) => <polyline className="draw-stroke" key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" strokeWidth={stroke.width} />)}
      </svg>

      {editor && <form className="word-editor" style={{ '--x': `${editor.x}px`, '--y': `${editor.y}px` }} onSubmit={(event) => { event.preventDefault(); submitWord() }} onClick={(event) => event.stopPropagation()}>
        <label className="visually-hidden" htmlFor="play-word">Name an object</label>
        <div className="word-editor__row">
          <input autoFocus id="play-word" className="word-editor__input" value={word} maxLength={LIMIT} placeholder="e.g. cat" onChange={(event) => { setWord(event.target.value); setResolution(null); setNotice('') }} onKeyDown={(event) => { if (event.key === 'Escape') closeEditor() }} />
          <button type="submit" aria-label="Create object">Go</button>
          <button type="button" aria-label="Cancel" onClick={closeEditor}>Cancel</button>
        </div>
        {notice && <p className="word-editor__message" role="status">{notice}</p>}
        {resolution && resolution.status !== 'match' && <div className="word-editor__suggestions" role="group" aria-label="Object suggestions">
          <p className="word-editor__message">{resolution.status === 'unknown' ? 'No matching object yet. Try one of these:' : 'Choose a match:'}</p>
          {resolution.suggestions.slice(0, 3).map((entry) => <button type="button" key={entry.id} onClick={() => editor.drawingChoice ? selectDrawn(entry) : chooseSuggestion(entry)}>{entry.label}</button>)}
        </div>}
      </form>}

      {mode === 'draw' && <div className="draw-toolbar" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setStrokes((items) => items.slice(0, -1))}>Undo</button>
        <button type="button" onClick={() => setStrokes([])}>Clear</button>
        <button type="button" aria-pressed={brush === 4} onClick={() => setBrush(4)}>Small brush</button>
        <button type="button" aria-pressed={brush === 7} onClick={() => setBrush(7)}>Large brush</button>
        <button type="button" onClick={beginCreate}>Create</button>
        <button type="button" onClick={() => { closeEditor(); setStrokes([]); setMode('type') }}>Type instead</button>
      </div>}

      <div className="canvas-mode-controls" role="group" aria-label="Canvas mode">
        <button className="canvas-mode-button" type="button" aria-pressed={mode === 'type'} onClick={() => { closeEditor(); setMode('type'); setInteraction((current) => transitionInteraction(current, { type: 'CANCEL' })) }}>Type</button>
        <button className="canvas-mode-button" type="button" aria-pressed={mode === 'draw'} onClick={() => { closeEditor(); setMode('draw'); setInteraction((current) => transitionInteraction(current, { type: 'DRAW' })) }}>Draw</button>
      </div>

      <button className={`canvas-trash${trashActive ? ' canvas-trash--active' : ''}`} type="button" aria-label="Trash. Select an object and press Delete, or drag it here." onClick={() => {
        if (interaction.selectedId) animateDelete(interaction.selectedId)
      }}><span aria-hidden="true"></span></button>
      <span className="play-live-region" aria-live="polite">{notice || (hasSpawned ? '' : 'Click anywhere to name something.')}</span>
    </section>
  )
}
