'use client';

import { hexWithOpacity } from '@/lib/nba-team-colors';

const DEFAULT_BORDER = '#1a1a1a';

/**
 * Note card: 2px border (team primary), off-white background, solid drop shadow
 * (same shape, 5px down and right, border color at 25% opacity). CSS only.
 */
export default function NoteCardBorder({
  borderColor = DEFAULT_BORDER,
  children,
}: {
  borderColor?: string;
  children?: React.ReactNode;
}) {
  const color = borderColor ?? DEFAULT_BORDER;
  const shadowColor = hexWithOpacity(color, 0.25);

  const cardStyle = {
    border: `3px solid ${color}`,
    boxShadow: `5px 5px 0 0 ${shadowColor}`,
  };

  if (children != null) {
    return (
      <div
        className="note-card__inner grid grid-cols-2 gap-4 bg-card-off-white p-4"
        style={cardStyle}
      >
        {children}
      </div>
    );
  }

  return <div className="min-h-[80px] bg-card-off-white" style={cardStyle} />;
}
