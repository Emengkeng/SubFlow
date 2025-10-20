import { NextRequest, NextResponse } from 'next/server';
import { createOrganization } from '@/lib/db/subscription-queries';
import { getUser } from '@/lib/db/queries';
import { randomBytes } from 'crypto';
import { organizations, teamMembers, teams } from '@/lib/db/schema';
import { db } from '@/lib/db/drizzle';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { name, email, webhookUrl } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email' },
        { status: 400 }
      );
    }

    // Generate API key
    const apiKey = `sk_live_${randomBytes(32).toString('hex')}`;
    const webhookSecret = randomBytes(32).toString('hex');

    const organization = await createOrganization({
      name,
      email,
      apiKey,
      webhookUrl,
      webhookSecret,
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        email: organization.email,
        apiKey: organization.apiKey,
        webhookSecret: organization.webhookSecret,
      },
      message: 'Organization created successfully',
    });
  } catch (error: any) {
    console.error('Organization creation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all organizations the user is part of
    const orgs = await db
      .select({
        organization: organizations,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .innerJoin(organizations, eq(teams.organizationId, organizations.id))
      .where(eq(teamMembers.userId, user.id));

    if (!orgs.length) {
      return NextResponse.json({
        message: 'User is not part of any organization',
        organizations: [],
      });
    }

    return NextResponse.json({
      success: true,
      organizations: orgs.map(o => o.organization),
    });
  } catch (error: any) {
    console.error('Fetch user organizations error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}