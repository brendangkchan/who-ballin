import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
    const secret = process.env.REVALIDATE_SECRET;
    if (secret) {
        const authHeader = request.headers.get('authorization');
        const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const querySecret = request.nextUrl.searchParams.get('secret');
        const provided = bearer ?? querySecret;
        if (provided !== secret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        revalidateTag('top-week', 'max');
        revalidatePath('/');
        revalidatePath('/api/players/top-week');
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: 'Failed to refresh',
                message: error.message,
            },
            { status: 500 }
        );
    }
}
