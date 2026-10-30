function curve(values: number[], width: number, height: number) {
  const max = Math.max(1, ...values);
  const n = Math.max(values.length, 2);
  const pts = values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - 2 - (value / max) * (height - 6),
  }));
  if (pts.length === 0) return { line: "", area: "" };
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = (a.x + b.x) / 2;
    line += ` C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
  }
  const area = `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
  return { line, area };
}

export function DualSpark({
  primary,
  secondary,
  primaryColor,
  secondaryColor,
}: {
  primary: number[];
  secondary: number[];
  primaryColor: string;
  secondaryColor: string;
}) {
  const a = curve(primary, 300, 72);
  const b = curve(secondary, 300, 72);
  const id = `${primaryColor}-${secondaryColor}`.replace(/[^a-z0-9]/gi, "");
  return (
    <svg viewBox="0 0 300 72" className="mt-2 h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={primaryColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={secondaryColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={b.area} fill={`url(#${id}-b)`} />
      <path d={a.area} fill={`url(#${id}-a)`} />
      <path d={b.line} fill="none" stroke={secondaryColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={a.line} fill="none" stroke={primaryColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
