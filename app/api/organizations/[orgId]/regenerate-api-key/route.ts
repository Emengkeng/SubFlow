import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { updateOrganization } from '@/lib/db/payment-queries';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

async function verifyOrgAccess(userId: number, orgId: string) {
  const access = await db
    .select()
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.organizationId, orgId)
      )
    )
    .limit(1);

  return access.length > 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Verify user has access to this organization
    const hasAccess = await verifyOrgAccess(user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate new API key
    const newApiKey = `sk_live_${randomBytes(32).toString('hex')}`;

    // Update organization with new API key
    const updatedOrg = await updateOrganization(orgId, {
      apiKey: newApiKey,
    });

    if (!updatedOrg) {
      return NextResponse.json(
        { error: 'Failed to regenerate API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      apiKey: updatedOrg.apiKey,
      message: 'API key regenerated successfully',
    });
  } catch (error: any) {
    console.error('Regenerate API key error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}