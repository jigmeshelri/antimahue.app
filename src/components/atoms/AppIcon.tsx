/**
 * AppIcon — atom (T-4.3, DD-10).
 *
 * The maple-leaf app icon (handoff screen 1 + README "Ícono de app"). SVG
 * path and gradient reused verbatim from
 * `docs/design_handoff_antimahue/README.md` / the interactive prototype —
 * this is brand identity, not a placeholder glyph.
 */
interface AppIconProps {
  size?: number
}

const LEAF_PATH =
  'M50 90 L46 76 L26 75 L32 62 L11 59 L26 47 L15 30 L35 36 L50 7 L65 36 L85 30 L74 47 L89 59 L68 62 L74 75 L54 76 Z'

// The handoff's 70px icon uses a 44px inner glyph — keep that ratio at any size.
const GLYPH_RATIO = 44 / 70

export default function AppIcon({ size = 70 }: AppIconProps) {
  const glyphSize = Math.round(size * GLYPH_RATIO)

  return (
    <div
      role="img"
      aria-label="Antimahue"
      className="flex shrink-0 items-center justify-center rounded-[17px] bg-[linear-gradient(160deg,var(--color-hoja),var(--color-hoja-deep))] shadow-[0_8px_24px_rgba(140,32,16,0.3)]"
      style={{ width: size, height: size }}
    >
      <svg width={glyphSize} height={glyphSize} viewBox="0 0 100 100" fill="none">
        <path d={LEAF_PATH} fill="#FAF0E0" />
        <line
          x1="50"
          y1="90"
          x2="50"
          y2="97"
          stroke="#FAF0E0"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
