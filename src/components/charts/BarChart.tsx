interface BarChartProps {
  data: { label: string; value: number }[]
  height?: number
  color?: string
  negativeColor?: string
}

export function BarChart({
  data,
  height = 120,
  color = '#17a2b8',
  negativeColor = '#dc3545',
}: BarChartProps) {
  const W = 600
  const H = height
  const padL = 6
  const padR = 6
  const padTop = 22
  const padBot = 18

  const values = data.map((d) => d.value)
  const maxVal = Math.max(...values.map(Math.abs), 1)
  const hasNeg = values.some((v) => v < 0)

  // Chart drawing area
  const chartH = H - padTop - padBot
  const zeroY = hasNeg ? padTop + chartH * 0.5 : padTop + chartH

  const totalBars = data.length
  const slotW = (W - padL - padR) / totalBars
  const barW = Math.max(Math.floor(slotW * 0.7), 4)
  const barGap = slotW - barW

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height, display: 'block' }}>
      {/* Horizontal guide lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={padL}
          y1={padTop + chartH * frac}
          x2={W - padR}
          y2={padTop + chartH * frac}
          stroke="#dde2e9"
          strokeWidth={0.5}
          strokeDasharray="3,3"
        />
      ))}

      {/* Zero line */}
      <line
        x1={padL}
        y1={zeroY}
        x2={W - padR}
        y2={zeroY}
        stroke="#9aaabb"
        strokeWidth={1}
      />

      {data.map((d, i) => {
        const slotX = padL + i * slotW
        const barX = slotX + barGap / 2
        const isNeg = d.value < 0
        const barH = Math.max((Math.abs(d.value) / maxVal) * (hasNeg ? chartH * 0.5 : chartH), 1)
        const barY = isNeg ? zeroY : zeroY - barH
        const barColor = isNeg ? negativeColor : color

        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={barX}
              y={barY}
              width={barW}
              height={barH}
              fill={barColor}
              opacity={0.9}
              rx={1}
            />

            {/* Value label above/below bar */}
            {d.value !== 0 && (
              <text
                x={barX + barW / 2}
                y={isNeg ? barY + barH + 11 : barY - 4}
                textAnchor="middle"
                fontSize={9}
                fill={barColor}
                fontFamily="Arial, sans-serif"
                fontWeight="600"
              >
                {d.value > 0 ? '+' : ''}{d.value}
              </text>
            )}

            {/* Date label */}
            <text
              x={barX + barW / 2}
              y={H - 3}
              textAnchor="middle"
              fontSize={8.5}
              fill="#6c7a8a"
              fontFamily="Arial, sans-serif"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
