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
    const response = await fetch(url, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

export async function getLastCompletedGame(
    season?: number
): Promise<any | null> {
    try {
        const currentSeason = season || getCurrentNBASeason();
        console.log(`[DEBUG] Looking for last completed game in season ${currentSeason}`);

        // Try current season first
        let url = `${API_BASE}/nba/v1/games?seasons[]=${currentSeason}&status=Final&per_page=100`;
        let response = await fetch(url, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            console.error(`Failed to fetch last game: ${response.status} ${response.statusText}`);
            // Try previous season as fallback
            const previousSeason = currentSeason - 1;
            console.log(`[DEBUG] Trying previous season ${previousSeason}`);
            url = `${API_BASE}/nba/v1/games?seasons[]=${previousSeason}&status=Final&per_page=100`;
            response = await fetch(url, {
                headers: getHeaders(),
            });

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
            console.log(`[DEBUG] Found last completed game: ${sortedGames[0].date}`);
            return sortedGames[0];
        }
        console.log(`[DEBUG] No completed games found in season ${currentSeason}`);
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
    const response = await fetch(url, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
    }

    return response.json();
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
            const response = await fetch(url, {
                headers: getHeaders(),
            });

            if (!response.ok) {
                console.error(`Failed to fetch games page ${page}: ${response.status} ${response.statusText}`);
                // If it's a client error (4xx), stop trying
                if (response.status >= 400 && response.status < 500) {
                    break;
                }
                // For server errors, continue but log
                page++;
                continue;
            }

            const data = await response.json();

            // DEBUG: Log API response
            console.log(`[DEBUG] Games API response page ${page}:`, {
                url,
                dataLength: data.data?.length || 0,
                hasMeta: !!data.meta,
                nextCursor: data.meta?.next_cursor,
                totalGamesSoFar: allGames.length,
            });

            if (data.data && data.data.length > 0) {
                // Log sample game to see structure
                if (page === 1 && allGames.length === 0) {
                    console.log(`[DEBUG] Sample game:`, JSON.stringify(data.data[0], null, 2));
                }

                allGames.push(...data.data);
                // Check if there are more pages using cursor
                if (data.meta && data.meta.next_cursor) {
                    cursor = data.meta.next_cursor;
                    page++;
                } else {
                    hasMore = false;
                }
            } else {
                console.log(`[DEBUG] No games in response for page ${page}`);
                hasMore = false;
            }
        } catch (error: any) {
            console.error(`Error fetching games page ${page}:`, error);
            // Stop on network errors
            break;
        }
    }

    console.log(`[DEBUG] getAllGames returning ${allGames.length} total games`);
    return allGames;
}
