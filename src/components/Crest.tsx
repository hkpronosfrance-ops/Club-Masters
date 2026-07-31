"use client";

import { getCrestIcon } from "@/lib/crestOptions";

export type CrestShape = "shield" | "circle" | "hexagon";

const SHAPE_PATHS: Record<CrestShape, string> = {
  shield: "M50 4 L92 18 V52 C92 78 74 94 50 106 C26 94 8 78 8 52 V18 Z",
  circle: "M50 4 A46 46 0 1 1 49.99 4 Z",
  hexagon: "M50 2 L93 26 V78 L50 102 L7 78 V26 Z",
};

export interface CrestProps {
  shape: CrestShape;
  primaryColor: string;
  secondaryColor: string;
  icon: string; // clé (ex. "ball", "shield", "eagle"...)
  size?: number;
}

export default function Crest({ shape, primaryColor, secondaryColor, icon, size = 96 }: CrestProps) {
  const Icon = getCrestIcon(icon);
  const height = size * 1.06;

  return (
    <div className="relative inline-block drop-shadow-lg" style={{ width: size, height }}>
      <svg width={size} height={height} viewBox="0 0 100 108" className="absolute inset-0">
        <path d={SHAPE_PATHS[shape]} fill={primaryColor} stroke={secondaryColor} strokeWidth="4" />
        <path
          d={SHAPE_PATHS[shape]}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
          transform="scale(0.9) translate(5.5, 5.5)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pb-[6%]">
        <Icon size={size * 0.42} color={secondaryColor} strokeWidth={1.6} />
      </div>
    </div>
  );
}
