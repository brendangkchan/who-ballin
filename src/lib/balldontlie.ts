const API_BASE = 'https://api.balldontlie.io';
const API_KEY = process.env.BALLDONTLIE_API_KEY;

/**
 * Calculate the NBA season year (season is named after the year it ends in)
 * NBA seasons run from October to June
 * - Oct-Dec: Season ends next year (currentYear + 1)
 * - Jan-Jun: Season ends this year (currentYear)
 * - Jul-Sep: Off-season, use current year (season that just ended)
 */
export function getCurrentNBASeason(): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // October (10) through December (12): season ends next year
    if (month >= 10) {
        return year + 1;
    }
    // January (1) through June (6): season ends this year
    // July (7) through September (9): off-season, use current year
    return year;
}

function getHeaders(): HeadersInit {
    const headers: HeadersInit = {
        'Accept': 'application/json',
    };

    // Add API key if available
    if (API_KEY) {
        headers['Authorization'] = API_KEY;
    }

    return headers;
}

export async function getGamesInDateRange(
    startDate: string,
    endDate: string
): Promise<{ data: any[]; meta?: any }> {
    const url = `${API_BASE}/nba/v1/games?start_date=${startDate}&end_date=${endDate}&per_page=100`;
    const start = Date.now();
    const response = await fetch(url, {
        headers: getHeaders(),
    });
    const duration = Date.now() - start;

    if (!response.ok) {
        console.debug(`[balldontlie] getGamesInDateRange failed: ${response.status} ${response.statusText} in ${duration}ms`);
        throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const count = data.data?.length ?? 0;
    console.debug(`[balldontlie] getGamesInDateRange ${startDate}..${endDate}: ${count} games in ${duration}ms`);
    return data;
}

export async function getLastCompletedGame(
    season?: number
): Promise<any | null> {
    try {
        const currentSeason = season || getCurrentNBASeason();
        console.debug(`[balldontlie] getLastCompletedGame: looking in season ${currentSeason}`);

        // Try current season first
        let url = `${API_BASE}/nba/v1/games?seasons[]=${currentSeason}&status=Final&per_page=100`;
        const start = Date.now();
        let response = await fetch(url, {
            headers: getHeaders(),
        });
        console.debug(`[balldontlie] getLastCompletedGame season ${currentSeason}: ${response.status} in ${Date.now() - start}ms`);

        if (!response.ok) {
            console.error(`Failed to fetch last game: ${response.status} ${response.statusText}`);
            // Try previous season as fallback
            const previousSeason = currentSeason - 1;
            console.debug(`[balldontlie] getLastCompletedGame: trying previous season ${previousSeason}`);
            url = `${API_BASE}/nba/v1/games?seasons[]=${previousSeason}&status=Final&per_page=100`;
            response = await fetch(url, {
                headers: getHeaders(),
            });
            console.debug(`[balldontlie] getLastCompletedGame season ${previousSeason}: ${response.status} in ${Date.now() - start}ms`);

            if (!response.ok) {
                console.error(`Failed to fetch last game from previous season: ${response.status}`);
                return null;
            }
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            // Sort by date descending and return the most recent
            const sortedGames = data.data.sort((a: any, b: any) => {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
            console.debug(`[balldontlie] getLastCompletedGame: found ${sortedGames[0].date}`);
            return sortedGames[0];
        }
        console.debug(`[balldontlie] getLastCompletedGame: no completed games in season ${currentSeason}`);
        return null;
    } catch (error: any) {
        console.error('Error in getLastCompletedGame:', error);
        return null;
    }
}

const PLAYERS_PAGE_TIMEOUT_MS = 60_000;

/**
 * Fetch a single page of players. Returns data and nextCursor for resumable pagination.
 * Scripts should check status and handle 429 (rate limit) by saving progress and exiting.
 * Uses a 60s request timeout; invalid 200 response body is flagged via invalidResponse.
 */
export async function getPlayersPage(
    cursor: number | null
): Promise<{
    data: any[];
    nextCursor: number | null;
    status: number;
    invalidResponse?: boolean;
}> {
    let url = `${API_BASE}/nba/v1/players?per_page=100`;
    if (cursor != null) {
        url += `&cursor=${cursor}`;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PLAYERS_PAGE_TIMEOUT_MS);
    const response = await fetch(url, {
        headers: getHeaders(),
        signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));
    const list = Array.isArray(data?.data) ? data.data : [];
    const nextCursor =
        data?.meta?.next_cursor != null ? data.meta.next_cursor : null;
    const invalidResponse = response.ok && !Array.isArray(data?.data);
    return {
        data: list,
        nextCursor,
        status: response.status,
        ...(invalidResponse && { invalidResponse: true }),
    };
}

export async function getAllPlayers(): Promise<any[]> {
    const allPlayers: any[] = [];
    let cursor: number | null = null;
    const maxPages = 50;

    for (let page = 1; page <= maxPages; page++) {
        if (page > 1) {
            await new Promise(r => setTimeout(r, 1500));
        }
        const result = await getPlayersPage(cursor);
        if (result.status !== 200 || result.invalidResponse) {
            throw new Error(`Failed to fetch players: ${result.status}`);
        }
        if (result.data.length === 0) break;
        allPlayers.push(...result.data);
        cursor = result.nextCursor;
        if (cursor == null) break;
    }
    return allPlayers;
}

export async function getStatsForGames(
    gameIds: number[]
): Promise<{ data: any[]; meta?: any }> {
    const queryParams = gameIds.map(id => `game_ids[]=${id}`).join('&');
    const url = `${API_BASE}/nba/v1/stats?${queryParams}&per_page=100`;
    const start = Date.now();
    const response = await fetch(url, {
        headers: getHeaders(),
    });
    const duration = Date.now() - start;

    if (!response.ok) {
        console.debug(`[balldontlie] getStatsForGames failed: ${response.status} ${response.statusText} in ${duration}ms (${gameIds.length} games)`);
        throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const count = data.data?.length ?? 0;
    console.debug(`[balldontlie] getStatsForGames: ${count} stats for ${gameIds.length} games in ${duration}ms`);
    return data;
}

/**
 * Fetch all stats for the given game IDs, paginating through all result pages.
 * @param gameIds - Game IDs to fetch stats for
 * @param beforeFetch - Optional async callback (e.g. rate limiter) to call before each request
 */
export async function getAllStatsForGames(
    gameIds: number[],
    beforeFetch?: () => Promise<void>
): Promise<any[]> {
    const allStats: any[] = [];
    let cursor: number | null = null;
    let hasMore = true;
    const maxPages = 100; // Safety limit

    let pageNum = 1;
    while (hasMore && allStats.length / 100 < maxPages) {
        if (beforeFetch) await beforeFetch();

        const queryParams = gameIds.map(id => `game_ids[]=${id}`).join('&');
        let url = `${API_BASE}/nba/v1/stats?${queryParams}&per_page=100`;
        if (cursor != null) {
            url += `&cursor=${cursor}`;
        }

        const pageStart = Date.now();
        const response = await fetch(url, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            console.debug(`[balldontlie] getAllStatsForGames page ${pageNum} failed: ${response.status} in ${Date.now() - pageStart}ms`);
            throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const pageData = data.data ?? [];
        allStats.push(...pageData);
        console.debug(`[balldontlie] getAllStatsForGames page ${pageNum}: ${pageData.length} stats, total ${allStats.length} (${Date.now() - pageStart}ms)`);

        if (pageData.length > 0 && data.meta?.next_cursor != null) {
            cursor = data.meta.next_cursor;
            pageNum++;
        } else {
            hasMore = false;
        }
    }

    console.debug(`[balldontlie] getAllStatsForGames: ${allStats.length} total stats for ${gameIds.length} games`);
    return allStats;
}

export async function getAllGames(
    startDate: string,
    endDate: string
): Promise<any[]> {
    const allGames: any[] = [];
    let cursor: number | null = null;
    let hasMore = true;
    let page = 1;
    const maxPages = 10; // Safety limit to prevent infinite loops

    while (hasMore && page <= maxPages) {
        let url = `${API_BASE}/nba/v1/games?start_date=${startDate}&end_date=${endDate}&per_page=100`;
        if (cursor) {
            url += `&cursor=${cursor}`;
        }

        try {
            const pageStart = Date.now();
            const response = await fetch(url, {
                headers: getHeaders(),
            });
            const pageDuration = Date.now() - pageStart;

            if (!response.ok) {
                console.debug(`[balldontlie] getAllGames page ${page} failed: ${response.status} in ${pageDuration}ms`);
                // If it's a client error (4xx), stop trying
                if (response.status >= 400 && response.status < 500) {
                    break;
                }
                // For server errors, continue but log
                page++;
                continue;
            }

            const data = await response.json();
            const pageCount = data.data?.length || 0;

            console.debug(`[balldontlie] getAllGames page ${page}: ${pageCount} games, total ${allGames.length + pageCount}, nextCursor=${data.meta?.next_cursor ?? 'none'} (${pageDuration}ms)`);

            if (data.data && data.data.length > 0) {
                allGames.push(...data.data);
                // Check if there are more pages using cursor
                if (data.meta && data.meta.next_cursor) {
                    cursor = data.meta.next_cursor;
                    page++;
                } else {
                    hasMore = false;
                }
            } else {
                console.debug(`[balldontlie] getAllGames page ${page}: no games in response`);
                hasMore = false;
            }
        } catch (error: any) {
            console.debug(`[balldontlie] getAllGames page ${page} error:`, error?.message ?? error);
            // Stop on network errors
            break;
        }
    }

    console.debug(`[balldontlie] getAllGames: ${allGames.length} total games for ${startDate}..${endDate}`);
    return allGames;
}
