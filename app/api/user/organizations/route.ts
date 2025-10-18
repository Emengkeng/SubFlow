// Get all organizations user is subscribed to
import { NextRequest, NextResponse } from 'next/server';
import { getUserOrganizations } from '@/lib/db/subscription-queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    const organizations = await getUserOrganizations(walletAddress);

    return NextResponse.json({
      success: true,
      organizations,
      count: organizations.length,
    });
  } catch (error: any) {
    console.error('User organizations error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}