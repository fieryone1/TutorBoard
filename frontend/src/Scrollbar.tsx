import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

export function Scrollbar({
  orientation,
  viewport,
  world,
  offset,
  onScroll,
}: {
  orientation: 'horizontal' | 'vertical'
  viewport: number
  world: number
  offset: number
  onScroll: (offset: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const maxOffset = Math.max(0, world - viewport)

  if (maxOffset === 0) return null

  const trackSize =
    (orientation === 'horizontal' ? trackRef.current?.clientWidth : trackRef.current?.clientHeight) ??
    viewport
  const thumbSize = Math.min(trackSize, Math.max(30, (viewport / world) * trackSize))
  const thumbOffset = (offset / maxOffset) * (trackSize - thumbSize)

  const onThumbPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startClient = orientation === 'horizontal' ? e.clientX : e.clientY
    const startOffset = offset
    const range = trackSize - thumbSize || 1

    const onMove = (ev: PointerEvent) => {
      const client = orientation === 'horizontal' ? ev.clientX : ev.clientY
      const deltaOffset = ((client - startClient) / range) * maxOffset
      onScroll(Math.min(maxOffset, Math.max(0, startOffset + deltaOffset)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={trackRef} className={`scrollbar scrollbar-${orientation}`}>
      <div
        className="scrollbar-thumb"
        onPointerDown={onThumbPointerDown}
        style={
          orientation === 'horizontal'
            ? { width: thumbSize, left: thumbOffset }
            : { height: thumbSize, top: thumbOffset }
        }
      />
    </div>
  )
}
