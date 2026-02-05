import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST() {
    try {
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
