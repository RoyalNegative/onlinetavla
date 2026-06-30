// A single die face rendered as SVG pips.

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.26, 0.26],
    [0.5, 0.5],
    [0.74, 0.74],
  ],
  4: [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ],
  5: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.5, 0.5],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  6: [
    [0.3, 0.26],
    [0.7, 0.26],
    [0.3, 0.5],
    [0.7, 0.5],
    [0.3, 0.74],
    [0.7, 0.74],
  ],
};

export function Die({
  value,
  size = 38,
  used = false,
  animate = false,
}: {
  value: number;
  size?: number;
  used?: boolean;
  animate?: boolean;
}) {
  const r = size * 0.075;
  return (
    <div
      className={`grid place-items-center rounded-lg ${animate ? 'animate-dice-pop' : ''}`}
      style={{
        width: size,
        height: size,
        background: used ? 'linear-gradient(145deg,#6b7280,#4b5563)' : 'linear-gradient(145deg,#fff,#e6e9ef)',
        boxShadow: used ? 'inset 0 0 0 1px rgba(0,0,0,0.2)' : '0 4px 10px rgba(0,0,0,0.35)',
        opacity: used ? 0.5 : 1,
      }}
    >
      <svg viewBox="0 0 1 1" width={size * 0.82} height={size * 0.82}>
        {(PIPS[value] ?? []).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={r / size} fill={used ? '#e5e7eb' : '#1f2937'} />
        ))}
      </svg>
    </div>
  );
}
