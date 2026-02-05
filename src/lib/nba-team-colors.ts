import { getMainColor, getSecondaryColor } from 'nba-color';

export function getTeamColors(abbreviation: string | undefined): {
  primary: string;
  secondary: string | null;
} | null {
  if (!abbreviation) return null;
  try {
    const primary = getMainColor(abbreviation);
    const secondary = getSecondaryColor(abbreviation);
    if (!primary?.hex) return null;
    return {
      primary: primary.hex,
      secondary: secondary?.hex ?? null,
    };
  } catch {
    return null;
  }
}
