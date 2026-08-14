export type Tool = 'pen' | 'eraser' | 'select' | 'pan'

const PEN_SIZES = [2, 4, 8, 14]
const PEN_COLORS = ['#1e293b', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']
const BACKGROUND_COLORS = ['#ffffff', '#808080', '#000000']

export function Toolbar({
  tool,
  onToolChange,
  penSize,
  onPenSizeChange,
  penColor,
  onPenColorChange,
  backgroundColor,
  onBackgroundColorChange,
}: {
  tool: Tool
  onToolChange: (tool: Tool) => void
  penSize: number
  onPenSizeChange: (size: number) => void
  penColor: string
  onPenColorChange: (color: string) => void
  backgroundColor: string
  onBackgroundColorChange: (color: string) => void
}) {
  return (
    <div className="toolbar">
      <button className={tool === 'pen' ? 'active' : ''} onClick={() => onToolChange('pen')}>
        Pen
      </button>
      <button className={tool === 'eraser' ? 'active' : ''} onClick={() => onToolChange('eraser')}>
        Eraser
      </button>
      <button className={tool === 'select' ? 'active' : ''} onClick={() => onToolChange('select')}>
        Select
      </button>
      <button className={tool === 'pan' ? 'active' : ''} onClick={() => onToolChange('pan')}>
        Pan
      </button>

      {tool === 'pen' && (
        <>
          <div className="pen-sizes">
            {PEN_SIZES.map((size) => (
              <button
                key={size}
                className={penSize === size ? 'active' : ''}
                onClick={() => onPenSizeChange(size)}
                aria-label={`Pen size ${size}`}
              >
                <span className="pen-dot" style={{ width: size, height: size }} />
              </button>
            ))}
          </div>

          <div className="pen-colors">
            {PEN_COLORS.map((color) => (
              <button
                key={color}
                className={penColor === color ? 'active' : ''}
                onClick={() => onPenColorChange(color)}
                aria-label={`Pen color ${color}`}
              >
                <span className="color-swatch" style={{ background: color }} />
              </button>
            ))}
            <input
              type="color"
              value={penColor}
              onChange={(e) => onPenColorChange(e.target.value)}
              className="color-picker"
              aria-label="Custom pen color"
            />
          </div>
        </>
      )}

      <div className="bg-colors">
        {BACKGROUND_COLORS.map((color) => (
          <button
            key={color}
            className={backgroundColor === color ? 'active' : ''}
            onClick={() => onBackgroundColorChange(color)}
            aria-label={`Background color ${color}`}
          >
            <span className="color-swatch" style={{ background: color }} />
          </button>
        ))}
      </div>
    </div>
  )
}
