import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Line, Image as KonvaImage, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import * as Y from 'yjs'
import { useYjs } from './useYjs'
import { Toolbar, type Tool } from './Toolbar'
import { Scrollbar } from './Scrollbar'

type StrokeElement = {
  kind: 'stroke'
  id: string
  points: number[]
  color: string
  size: number
}

type ImageElement = {
  kind: 'image'
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
}

type CanvasElement = StrokeElement | ImageElement

const HIT_THRESHOLD = 8
const SCROLLBAR_SIZE = 14
const MAX_PASTED_IMAGE_DIM = 400

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function distanceToStroke(px: number, py: number, points: number[]): number {
  let min = Infinity
  for (let i = 0; i < points.length - 2; i += 2) {
    min = Math.min(min, distanceToSegment(px, py, points[i], points[i + 1], points[i + 2], points[i + 3]))
  }
  return min
}

function hitElement(px: number, py: number, el: CanvasElement): boolean {
  if (el.kind === 'stroke') {
    return distanceToStroke(px, py, el.points) < HIT_THRESHOLD + el.size / 2
  }
  return px >= el.x && px <= el.x + el.width && py >= el.y && py <= el.y + el.height
}

function pointInPolygon(px: number, py: number, poly: number[]): boolean {
  let inside = false
  const n = poly.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2]
    const yi = poly[i * 2 + 1]
    const xj = poly[j * 2]
    const yj = poly[j * 2 + 1]
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function elementsInLasso(elements: CanvasElement[], lasso: number[]): string[] {
  const ids: string[] = []
  for (const el of elements) {
    if (el.kind === 'stroke') {
      for (let i = 0; i < el.points.length; i += 2) {
        if (pointInPolygon(el.points[i], el.points[i + 1], lasso)) {
          ids.push(el.id)
          break
        }
      }
    } else {
      const corners: Array<[number, number]> = [
        [el.x, el.y],
        [el.x + el.width, el.y],
        [el.x, el.y + el.height],
        [el.x + el.width, el.y + el.height],
        [el.x + el.width / 2, el.y + el.height / 2],
      ]
      if (corners.some(([cx, cy]) => pointInPolygon(cx, cy, lasso))) ids.push(el.id)
    }
  }
  return ids
}

function boundingBoxOf(elements: CanvasElement[], ids: Set<string>) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of elements) {
    if (!ids.has(el.id)) continue
    if (el.kind === 'stroke') {
      for (let i = 0; i < el.points.length; i += 2) {
        minX = Math.min(minX, el.points[i])
        maxX = Math.max(maxX, el.points[i])
        minY = Math.min(minY, el.points[i + 1])
        maxY = Math.max(maxY, el.points[i + 1])
      }
    } else {
      minX = Math.min(minX, el.x)
      maxX = Math.max(maxX, el.x + el.width)
      minY = Math.min(minY, el.y)
      maxY = Math.max(maxY, el.y + el.height)
    }
  }
  return { minX, minY, maxX, maxY }
}

function useHtmlImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    const image = new window.Image()
    image.onload = () => setImg(image)
    image.src = src
    return () => {
      image.onload = null
    }
  }, [src])
  return img
}

function StrokeShape({
  el,
  selected,
  onNodeRef,
  onTransformEnd,
}: {
  el: StrokeElement
  selected?: boolean
  onNodeRef?: (node: Konva.Line | null) => void
  onTransformEnd?: (node: Konva.Node) => void
}) {
  return (
    <>
      {selected && (
        <Line
          points={el.points}
          stroke="#3b82f6"
          strokeWidth={el.size + 10}
          lineCap="round"
          lineJoin="round"
          opacity={0.3}
          listening={false}
        />
      )}
      <Line
        ref={onNodeRef}
        points={el.points}
        stroke={el.color}
        strokeWidth={el.size}
        lineCap="round"
        lineJoin="round"
        onTransformEnd={(e) => onTransformEnd?.(e.target)}
      />
    </>
  )
}

function ImageShape({
  el,
  selected,
  onNodeRef,
  onTransformEnd,
}: {
  el: ImageElement
  selected?: boolean
  onNodeRef?: (node: Konva.Image | null) => void
  onTransformEnd?: (node: Konva.Node) => void
}) {
  const img = useHtmlImage(el.src)
  if (!img) return null
  return (
    <>
      <KonvaImage
        ref={onNodeRef}
        image={img}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        onTransformEnd={(e) => onTransformEnd?.(e.target)}
      />
      {selected && (
        <Rect
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}
    </>
  )
}

export default function Whiteboard({ room }: { room: string }) {
  const yjs = useYjs(room)
  const yElements = useMemo(() => yjs?.ydoc.getArray<CanvasElement>('elements') ?? null, [yjs])
  const yMeta = useMemo(() => yjs?.ydoc.getMap<string>('meta') ?? null, [yjs])
  const awareness = yjs?.provider.awareness ?? null
  const ydoc = yjs?.ydoc ?? null

  const [elements, setElements] = useState<CanvasElement[]>([])
  const [peerStrokes, setPeerStrokes] = useState<StrokeElement[]>([])
  const [localStroke, setLocalStroke] = useState<StrokeElement | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [penSize, setPenSize] = useState(4)
  const [penColor, setPenColor] = useState('#1e293b')
  const [backgroundColor, setBackgroundColorState] = useState('#ffffff')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lassoPreview, setLassoPreview] = useState<number[]>([])
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [undoManager, setUndoManager] = useState<Y.UndoManager | null>(null)

  const drawing = useRef(false)
  const currentStroke = useRef<StrokeElement | null>(null)
  const dragState = useRef<{ start: { x: number; y: number }; originals: Map<string, CanvasElement> } | null>(
    null,
  )
  const lassoPoints = useRef<number[]>([])
  const lassoing = useRef(false)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const shapeRefs = useRef(new Map<string, Konva.Node>())

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const worldWidth = viewportWidth * 3
  const worldHeight = viewportHeight * 3

  // Committed elements: synced via the Yjs CRDT doc (persists, replays for new peers).
  useEffect(() => {
    if (!yElements) return
    const sync = () => setElements(yElements.toArray())
    sync()
    yElements.observe(sync)
    return () => yElements.unobserve(sync)
  }, [yElements])

  // Board background color: shared via the Yjs doc so every peer sees the same one.
  useEffect(() => {
    if (!yMeta) return
    const sync = () => setBackgroundColorState((yMeta.get('backgroundColor') as string) ?? '#ffffff')
    sync()
    yMeta.observe(sync)
    return () => yMeta.unobserve(sync)
  }, [yMeta])

  const setBackgroundColor = (color: string) => yMeta?.set('backgroundColor', color)

  // In-progress pen strokes: broadcast via awareness (ephemeral, no history needed).
  useEffect(() => {
    if (!awareness) return
    const onChange = () => {
      const strokes = Array.from(awareness.getStates().entries())
        .filter(([clientID]) => clientID !== awareness.clientID)
        .map(([, state]) => state.stroke as StrokeElement | undefined)
        .filter((stroke): stroke is StrokeElement => Boolean(stroke))
      setPeerStrokes(strokes)
    }
    awareness.on('change', onChange)
    return () => awareness.off('change', onChange)
  }, [awareness])

  // Undo/redo tracks local edits only (remote peer edits use a different transaction origin).
  useEffect(() => {
    if (!yElements) {
      setUndoManager(null)
      return
    }
    const um = new Y.UndoManager(yElements)
    setUndoManager(um)
    return () => um.destroy()
  }, [yElements])

  // Keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y redo, Delete/Backspace removes selection.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement) return
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z' && undoManager) {
        e.preventDefault()
        undoManager.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y' && undoManager) {
        e.preventDefault()
        undoManager.redo()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && yElements && ydoc) {
        ydoc.transact(() => {
          elements
            .map((el, i) => (selectedIds.has(el.id) ? i : -1))
            .filter((i) => i !== -1)
            .sort((a, b) => b - a)
            .forEach((i) => yElements.delete(i, 1))
        })
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedIds, elements, yElements, ydoc, undoManager])

  // Paste an image from the OS clipboard onto the canvas.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!yElements || !awareness) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()

        const reader = new FileReader()
        reader.onload = () => {
          const src = reader.result as string
          const probe = new window.Image()
          probe.onload = () => {
            const scale = Math.min(1, MAX_PASTED_IMAGE_DIM / Math.max(probe.width, probe.height))
            const width = probe.width * scale
            const height = probe.height * scale
            const pos = stageRef.current?.getRelativePointerPosition() ?? {
              x: viewportWidth / 2 - stagePos.x,
              y: viewportHeight / 2 - stagePos.y,
            }
            const newElement: ImageElement = {
              kind: 'image',
              id: `${awareness.clientID}-${Date.now()}`,
              src,
              x: pos.x - width / 2,
              y: pos.y - height / 2,
              width,
              height,
            }
            yElements.push([newElement])
          }
          probe.src = src
        }
        reader.readAsDataURL(file)
        break
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [yElements, awareness, viewportWidth, viewportHeight, stagePos])

  // Cursor hint per active tool.
  useEffect(() => {
    const container = stageRef.current?.container()
    if (!container) return
    container.style.cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair'
  }, [tool])

  // Board background color (the canvas is transparent, so this shows through it).
  useEffect(() => {
    const container = stageRef.current?.container()
    if (!container) return
    container.style.backgroundColor = backgroundColor
  }, [backgroundColor])

  // Attach resize handles to the single selected element (Select tool only).
  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    if (tool === 'select' && selectedIds.size === 1) {
      const node = shapeRefs.current.get(Array.from(selectedIds)[0])
      tr.nodes(node ? [node] : [])
    } else {
      tr.nodes([])
    }
    tr.getLayer()?.batchDraw()
  }, [selectedIds, tool, elements])

  const handleTransformEnd = (id: string, node: Konva.Node) => {
    if (!yElements || !ydoc) return
    const idx = elements.findIndex((el) => el.id === id)
    if (idx === -1) return
    const el = elements[idx]
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const nx = node.x()
    const ny = node.y()

    let updated: CanvasElement
    if (el.kind === 'stroke') {
      updated = {
        ...el,
        points: el.points.map((v, i) => (i % 2 === 0 ? v * scaleX + nx : v * scaleY + ny)),
        size: Math.max(1, el.size * ((scaleX + scaleY) / 2)),
      }
      node.x(0)
      node.y(0)
    } else {
      updated = {
        ...el,
        x: nx,
        y: ny,
        width: Math.max(10, el.width * scaleX),
        height: Math.max(10, el.height * scaleY),
      }
    }
    node.scaleX(1)
    node.scaleY(1)

    ydoc.transact(() => {
      yElements.delete(idx, 1)
      yElements.insert(idx, [updated])
    })
  }

  const getPos = () => stageRef.current?.getRelativePointerPosition() ?? null

  const eraseAt = (pos: { x: number; y: number }) => {
    if (!yElements) return
    for (let i = elements.length - 1; i >= 0; i--) {
      if (hitElement(pos.x, pos.y, elements[i])) {
        yElements.delete(i, 1)
        break
      }
    }
  }

  const clampStagePos = (pos: { x: number; y: number }) => {
    const minX = -(worldWidth - viewportWidth)
    const minY = -(worldHeight - viewportHeight)
    return {
      x: Math.min(0, Math.max(minX, pos.x)),
      y: Math.min(0, Math.max(minY, pos.y)),
    }
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    let dx = e.evt.deltaX
    let dy = e.evt.deltaY
    if (e.evt.shiftKey) {
      // Shift+wheel: a plain mouse wheel only reports deltaY, so treat that as horizontal scroll.
      if (dx === 0) dx = dy
      dy = 0
    }
    setStagePos((prev) => clampStagePos({ x: prev.x - dx, y: prev.y - dy }))
  }

  const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (e.target.getParent()?.className === 'Transformer') return
    const pos = getPos()
    if (!pos) return

    if (tool === 'pen' && awareness) {
      drawing.current = true
      currentStroke.current = {
        kind: 'stroke',
        id: `${awareness.clientID}-${Date.now()}`,
        points: [pos.x, pos.y],
        color: penColor,
        size: penSize,
      }
      awareness.setLocalStateField('stroke', currentStroke.current)
      setLocalStroke(currentStroke.current)
    } else if (tool === 'eraser') {
      drawing.current = true
      eraseAt(pos)
    } else if (tool === 'select') {
      if (selectedIds.size > 0) {
        const box = boundingBoxOf(elements, selectedIds)
        if (pos.x >= box.minX && pos.x <= box.maxX && pos.y >= box.minY && pos.y <= box.maxY) {
          const originals = new Map(elements.filter((el) => selectedIds.has(el.id)).map((el) => [el.id, el]))
          dragState.current = { start: pos, originals }
          return
        }
      }
      setSelectedIds(new Set())
      lassoPoints.current = [pos.x, pos.y]
      setLassoPreview(lassoPoints.current)
      lassoing.current = true
    }
  }

  const handlePointerMove = () => {
    const pos = getPos()
    if (!pos) return

    if (tool === 'pen' && drawing.current && currentStroke.current && awareness) {
      currentStroke.current = {
        ...currentStroke.current,
        points: [...currentStroke.current.points, pos.x, pos.y],
      }
      awareness.setLocalStateField('stroke', currentStroke.current)
      setLocalStroke(currentStroke.current)
    } else if (tool === 'eraser' && drawing.current) {
      eraseAt(pos)
    } else if (tool === 'select' && dragState.current) {
      const { start, originals } = dragState.current
      const dx = pos.x - start.x
      const dy = pos.y - start.y
      setElements((prev) =>
        prev.map((el) => {
          const orig = originals.get(el.id)
          if (!orig) return el
          if (orig.kind === 'stroke') {
            return { ...orig, points: orig.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)) }
          }
          return { ...orig, x: orig.x + dx, y: orig.y + dy }
        }),
      )
    } else if (tool === 'select' && lassoing.current) {
      lassoPoints.current = [...lassoPoints.current, pos.x, pos.y]
      setLassoPreview(lassoPoints.current)
    }
  }

  const handlePointerUp = () => {
    if (tool === 'pen' && drawing.current && currentStroke.current && yElements && awareness) {
      yElements.push([currentStroke.current])
      currentStroke.current = null
      awareness.setLocalStateField('stroke', null)
      setLocalStroke(null)
    } else if (tool === 'select' && dragState.current && yElements && ydoc) {
      const ids = new Set(dragState.current.originals.keys())
      const moved = elements.filter((el) => ids.has(el.id))
      ydoc.transact(() => {
        elements
          .map((el, i) => (ids.has(el.id) ? i : -1))
          .filter((i) => i !== -1)
          .sort((a, b) => b - a)
          .forEach((i) => yElements.delete(i, 1))
        yElements.push(moved)
      })
    } else if (tool === 'select' && lassoing.current) {
      const lasso = lassoPoints.current
      setSelectedIds(lasso.length >= 6 ? new Set(elementsInLasso(elements, lasso)) : new Set())
      lassoPoints.current = []
      setLassoPreview([])
    }
    drawing.current = false
    dragState.current = null
    lassoing.current = false
  }

  if (!yjs) {
    return <div className="connecting">Connecting…</div>
  }

  return (
    <>
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        penSize={penSize}
        onPenSizeChange={setPenSize}
        penColor={penColor}
        onPenColorChange={setPenColor}
        backgroundColor={backgroundColor}
        onBackgroundColorChange={setBackgroundColor}
      />
      <Stage
        ref={stageRef}
        width={viewportWidth}
        height={viewportHeight}
        x={stagePos.x}
        y={stagePos.y}
        draggable={tool === 'pan'}
        dragBoundFunc={clampStagePos}
        onDragMove={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <Layer>
          {elements.map((el) => (
            <Fragment key={el.id}>
              {el.kind === 'stroke' ? (
                <StrokeShape
                  el={el}
                  selected={selectedIds.has(el.id)}
                  onNodeRef={(node) => {
                    if (node) shapeRefs.current.set(el.id, node)
                    else shapeRefs.current.delete(el.id)
                  }}
                  onTransformEnd={(node) => handleTransformEnd(el.id, node)}
                />
              ) : (
                <ImageShape
                  el={el}
                  selected={selectedIds.has(el.id)}
                  onNodeRef={(node) => {
                    if (node) shapeRefs.current.set(el.id, node)
                    else shapeRefs.current.delete(el.id)
                  }}
                  onTransformEnd={(node) => handleTransformEnd(el.id, node)}
                />
              )}
            </Fragment>
          ))}
          {peerStrokes.map((s) => (
            <StrokeShape key={s.id} el={s} />
          ))}
          {localStroke && <StrokeShape key={localStroke.id} el={localStroke} />}
          {lassoPreview.length >= 4 && (
            <Line
              points={lassoPreview}
              stroke="#3b82f6"
              strokeWidth={1.5}
              dash={[6, 4]}
              closed
              opacity={0.8}
              fill="rgba(59,130,246,0.08)"
              listening={false}
            />
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            boundBoxFunc={(oldBox, newBox) =>
              Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10 ? oldBox : newBox
            }
          />
        </Layer>
      </Stage>
      <Scrollbar
        orientation="horizontal"
        viewport={viewportWidth}
        world={worldWidth}
        offset={-stagePos.x}
        onScroll={(offset) => setStagePos((p) => ({ ...p, x: -offset }))}
      />
      <Scrollbar
        orientation="vertical"
        viewport={viewportHeight}
        world={worldHeight}
        offset={-stagePos.y}
        onScroll={(offset) => setStagePos((p) => ({ ...p, y: -offset }))}
      />
      <div className="scrollbar-corner" style={{ width: SCROLLBAR_SIZE, height: SCROLLBAR_SIZE }} />
    </>
  )
}
