import { NextRequest, NextResponse } from 'next/server';
import { parseFilters } from '@/lib/filters';
import { getTopWeekPlayers, TopWeekError } from '@/lib/top-week';

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const result = await getTopWeekPlayers(filters);
    return NextResponse.json(result);
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const isDev = process.env.NODE_ENV === 'development';
    const debug = error instanceof TopWeekError ? error.debug : undefined;
    const stack = error instanceof TopWeekError ? error.originalStack ?? error.stack : error?.stack;

    return NextResponse.json(
      {
        error: 'Failed to fetch top players',
        message: errorMessage,
        ...(isDev && debug ? { debug } : {}),
        ...(isDev && stack ? { stack } : {}),
      },
      { status: 500 }
    );
  }
}
