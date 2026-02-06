import { getMainColor, getSecondaryColor } from 'nba-color';

/** Returns hex as rgba with the given opacity (0-1). */
function hexWithOpacity(hex: string, opacity: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function getTeamColors(abbreviation: string | undefined): {
  primary: string;
  secondary: string | null;
  /** Label gradient: secondary or primary at 50% opacity, fades to transparent */
  labelGradientStart: string;
} | null {
  if (!abbreviation) return null;
  try {
    const primary = getMainColor(abbreviation);
    const secondary = getSecondaryColor(abbreviation);
    if (!primary?.hex) return null;
    const secHex = secondary?.hex ?? null;
    return {
      primary: primary.hex,
      secondary: secHex,
      labelGradientStart: hexWithOpacity(secHex ?? primary.hex, 0.5),
    };
  } catch {
    return null;
  }
}
