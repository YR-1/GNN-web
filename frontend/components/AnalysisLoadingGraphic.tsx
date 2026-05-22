import { Brain } from 'lucide-react'

/**
 * Animated brain-connectivity-graph shown on the analysis loading screen.
 *
 * Pure SVG plus CSS keyframe animations (defined in globals.css) — no state,
 * no JS animation loop — so it stays cheap to render. It respects the global
 * `prefers-reduced-motion` rule.
 */

/** Centre hub of the connectome (sits behind the brain icon). */
const HUB = { cx: 100, cy: 100 }

/** Seven outer regions ("nodes") of the connectivity graph. */
const NODES: { cx: number; cy: number; r: number }[] = [
  { cx: 100, cy: 28, r: 9 },
  { cx: 44, cy: 58, r: 7 },
  { cx: 158, cy: 54, r: 8 },
  { cx: 28, cy: 122, r: 6 },
  { cx: 172, cy: 116, r: 7 },
  { cx: 72, cy: 168, r: 6 },
  { cx: 134, cy: 164, r: 8 },
]

/** Edges: spokes to the hub (-1) plus a ring around the outer nodes. */
const EDGES: [number, number][] = [
  [0, -1], [1, -1], [2, -1], [3, -1], [4, -1], [5, -1], [6, -1],
  [0, 1], [1, 3], [3, 5], [5, 6], [6, 4], [4, 2], [2, 0],
]

const pointOf = (index: number) => (index === -1 ? HUB : NODES[index])

export function AnalysisLoadingGraphic() {
  return (
    <div className='relative mx-auto mt-6 h-44 w-44'>
      {/* soft glow behind the graph */}
      <div className='absolute inset-5 rounded-full bg-brand-400/20 blur-2xl' aria-hidden='true' />

      <svg
        viewBox='0 0 200 200'
        className='relative h-full w-full'
        role='img'
        aria-label='Building a brain connectivity graph'
      >
        <defs>
          <radialGradient id='loaderNodeFill' cx='35%' cy='30%' r='75%'>
            <stop offset='0%' stopColor='#bfdbfe' />
            <stop offset='55%' stopColor='#3b82f6' />
            <stop offset='100%' stopColor='#1d4ed8' />
          </radialGradient>
        </defs>

        {/* slowly rotating dashed scan ring */}
        <circle
          cx='100'
          cy='100'
          r='94'
          fill='none'
          stroke='#93c5fd'
          strokeWidth='1.6'
          strokeDasharray='2 9'
          strokeLinecap='round'
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            animation: 'loader-ring-spin 14s linear infinite',
          }}
        />

        {/* edges with a flowing dash */}
        {EDGES.map(([from, to], index) => {
          const start = pointOf(from)
          const end = pointOf(to)
          return (
            <line
              key={`edge-${index}`}
              x1={start.cx}
              y1={start.cy}
              x2={end.cx}
              y2={end.cy}
              stroke='#60a5fa'
              strokeWidth='2'
              strokeLinecap='round'
              strokeDasharray='5 7'
              style={{
                animation: 'loader-edge-flow 1.4s linear infinite',
                animationDelay: `${index * 0.1}s`,
              }}
            />
          )
        })}

        {/* pulsing nodes */}
        {NODES.map((node, index) => (
          <circle
            key={`node-${index}`}
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill='url(#loaderNodeFill)'
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: 'loader-node-pulse 2.6s ease-in-out infinite',
              animationDelay: `${index * 0.22}s`,
            }}
          />
        ))}
      </svg>

      {/* brain hub at the centre */}
      <div className='absolute inset-0 flex items-center justify-center'>
        <div className='flex h-14 w-14 items-center justify-center rounded-full border border-brand-400/30 bg-white shadow-md'>
          <Brain className='h-7 w-7 text-brand-600' />
        </div>
      </div>
    </div>
  )
}
