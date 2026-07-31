import { Shield, Star, Crown, Swords, Flame, Zap, Bird, Mountain, Trophy, Anchor } from "lucide-react";
import BallIcon from "@/components/icons/BallIcon";

export const CREST_SHAPES = [
  { value: "shield", label: "Blason" },
  { value: "circle", label: "Rond" },
  { value: "hexagon", label: "Hexagone" },
] as const;

export const CREST_COLORS = [
  "#C81E3A", "#1D4ED8", "#0F766E", "#B45309",
  "#4C1D95", "#15803D", "#0E1015", "#D4AF37",
];

export const CREST_SECONDARY_COLORS = [
  "#FFFFFF", "#D4AF37", "#0E1015", "#171B24",
];

// Emblèmes vectoriels (plus d'emoji) : mêmes conventions que lucide-react
// (trait fin, sans remplissage) pour un rendu cohérent et redimensionnable.
export const CREST_ICONS = [
  { key: "ball", label: "Ballon", Icon: BallIcon },
  { key: "shield", label: "Bouclier", Icon: Shield },
  { key: "star", label: "Étoile", Icon: Star },
  { key: "crown", label: "Couronne", Icon: Crown },
  { key: "swords", label: "Épées", Icon: Swords },
  { key: "flame", label: "Flamme", Icon: Flame },
  { key: "bolt", label: "Éclair", Icon: Zap },
  { key: "eagle", label: "Aigle", Icon: Bird },
  { key: "mountain", label: "Montagne", Icon: Mountain },
  { key: "trophy", label: "Trophée", Icon: Trophy },
  { key: "anchor", label: "Ancre", Icon: Anchor },
] as const;

export type CrestIconKey = (typeof CREST_ICONS)[number]["key"];

export function getCrestIcon(key: string) {
  return CREST_ICONS.find((i) => i.key === key)?.Icon ?? Shield;
}
