export const MAX_OBJECTS = 30
export const OBJECT_SIZE = 96
export const getObjectSize = (canvasWidth) => canvasWidth >= 900 ? 120 : OBJECT_SIZE
export const DRAG_THRESHOLD = 4

export const initialInteraction = () => ({ mode: 'idle', selectedId: null })

export function transitionInteraction(state, event) {
  switch (event.type) {
    case 'TYPE': return { ...state, mode: 'typing' }
    case 'DRAW': return { ...state, mode: 'drawing' }
    case 'DRAG_START': return { ...state, mode: 'dragging', selectedId: event.id }
    case 'SELECT': return { ...state, selectedId: event.id }
    case 'CANCEL': return { ...state, mode: 'idle' }
    case 'SPAWN': return { ...state, mode: 'idle', selectedId: event.id ?? state.selectedId }
    case 'DELETE': return { ...state, mode: 'idle', selectedId: null }
    case 'MODAL_OPEN': return { ...state, mode: 'modal-open' }
    case 'MODAL_CLOSE': return { ...state, mode: 'idle' }
    default: return state
  }
}

export function clampPoint(point, bounds, size = getObjectSize(bounds.width)) {
  const half = size / 2
  return {
    x: Math.max(half, Math.min(bounds.width - half, point.x)),
    y: Math.max(half, Math.min(bounds.height - half, point.y)),
  }
}

export function moveObject(objects, id, point, bounds) {
  const object = objects.find((item) => item.id === id)
  if (!object) return objects
  const size = object.size ?? getObjectSize(bounds.width)
  const safePoint = clampPoint(point, bounds, size)
  return objects.map((item) => item.id === id ? { ...item, size, ...safePoint } : item)
}

export function deleteObject(objects, id) {
  return objects.filter((object) => object.id !== id)
}

export function addObject(objects, entry, point, bounds, id = `${entry.id}-${Date.now()}`) {
  if (objects.length >= MAX_OBJECTS) return { objects, added: false }
  const size = getObjectSize(bounds.width)
  return {
    objects: [...objects, { id, entry, size, ...clampPoint(point, bounds, size) }],
    added: true,
  }
}

/** Pick a nearby open grid point for manually adding an object without a sketch. */
export function findOpenSpawnPoint(objects, bounds, size = getObjectSize(bounds.width)) {
  const margin = size / 2
  const step = size * 0.82
  const candidates = []
  for (let y = margin; y <= bounds.height - margin; y += step) {
    for (let x = margin; x <= bounds.width - margin; x += step) {
      const point = clampPoint({ x, y }, bounds, size)
      const distanceFromCenter = Math.hypot(point.x - bounds.width / 2, point.y - bounds.height / 2)
      candidates.push({ ...point, distanceFromCenter })
    }
  }
  candidates.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter)
  const minimumDistance = size * 0.8
  const open = candidates.find((point) => objects.every((object) =>
    Math.hypot(object.x - point.x, object.y - point.y) >= minimumDistance))
  if (open) return { x: open.x, y: open.y }
  const bestAvailable = candidates.reduce((best, point) => {
    const nearest = Math.min(...objects.map((object) => Math.hypot(object.x - point.x, object.y - point.y)), Infinity)
    return nearest > best.nearest ? { ...point, nearest } : best
  }, { ...candidates[0], nearest: -1 })
  return { x: bestAvailable.x, y: bestAvailable.y }
}

export function trashContainsPoint(point, rect) {
  return Boolean(rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom)
}
