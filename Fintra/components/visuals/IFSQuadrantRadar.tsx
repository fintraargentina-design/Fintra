import React from "react";

// SVG radar de 4 cuadrantes, igual a la imagen de referencia
export const IFSQuadrantRadar = ({ size = 40 }: { size?: number }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.48;
  const rInner = size * 0.22;
  const colors = [
    "#8bb6f7", // 01
    "#a18aff", // 02
    "#5a8be6", // 03
    "#4d3a8f"  // 04
  ];
  const labels = ["01", "02", "03", "04"];

  // Helper para arco SVG
  function arcPath(startAngle: number, endAngle: number, radius: number, innerRadius: number) {
    const start = angleToXY(startAngle, radius);
    const end = angleToXY(endAngle, radius);
    const startInner = angleToXY(endAngle, innerRadius);
    const endInner = angleToXY(startAngle, innerRadius);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${cx + start.x} ${cy + start.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${cx + end.x} ${cy + end.y}`,
      `L ${cx + startInner.x} ${cy + startInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${cx + endInner.x} ${cy + endInner.y}`,
      "Z"
    ].join(" ");
  }
  function angleToXY(angle: number, radius: number) {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
  }

  // Central globe icon (simple web globe)
  const globe = (
    <g>
      <circle cx={cx} cy={cy} r={size * 0.09} fill="#fff" stroke="#bbb" strokeWidth={size * 0.018} />
      <ellipse cx={cx} cy={cy} rx={size * 0.06} ry={size * 0.09} fill="none" stroke="#bbb" strokeWidth={size * 0.01} />
      <ellipse cx={cx} cy={cy} rx={size * 0.09} ry={size * 0.06} fill="none" stroke="#bbb" strokeWidth={size * 0.01} />
      <line x1={cx - size * 0.09} y1={cy} x2={cx + size * 0.09} y2={cy} stroke="#bbb" strokeWidth={size * 0.01} />
      <line x1={cx} y1={cy - size * 0.09} x2={cx} y2={cy + size * 0.09} stroke="#bbb" strokeWidth={size * 0.01} />
    </g>
  );

  // Cuadrantes
  const arcs = [0, 90, 180, 270].map((start, i) => (
    <path
      key={i}
      d={arcPath(start, start + 90, r, rInner)}
      fill={colors[i]}
      stroke="#fff"
      strokeWidth={size * 0.01}
    />
  ));

  // Números
  const labelPos = [
    angleToXY(45, (r + rInner) / 2),
    angleToXY(135, (r + rInner) / 2),
    angleToXY(225, (r + rInner) / 2),
    angleToXY(315, (r + rInner) / 2)
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}> 
      {arcs}
      {globe}
      {labelPos.map((pos, i) => (
        <text
          key={i}
          x={cx + pos.x}
          y={cy + pos.y + size * 0.03}
          textAnchor="middle"
          fontSize={size * 0.16}
          fontWeight="bold"
          fill="#fff"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {labels[i]}
        </text>
      ))}
    </svg>
  );
};
