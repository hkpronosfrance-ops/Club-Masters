// Icône ballon dessinée à la main (style cohérent avec lucide-react :
// viewBox 24x24, stroke uniquement, pas de remplissage).
export default function BallIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <polygon points="12,8 15.8,10.76 14.35,15.24 9.65,15.24 8.2,10.76" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="15.8" y1="10.76" x2="20.56" y2="9.22" />
      <line x1="14.35" y1="15.24" x2="17.29" y2="19.28" />
      <line x1="9.65" y1="15.24" x2="6.71" y2="19.28" />
      <line x1="8.2" y1="10.76" x2="3.44" y2="9.22" />
    </svg>
  );
}
