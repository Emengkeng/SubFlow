import { NextRequest, NextResponse } from 'next/server';
import {
  getProductsByOrganization,
  createProduct,
  getOrganizationById,
} from '@/lib/db/payment-queries';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {

    const user = await getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    const org = await getOrganizationById(orgId);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const hasAccess = await verifyOrgAccess(user.id, orgId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const products = await getProductsByOrganization(orgId);

    return NextResponse.json({
      success: true,
      products: products.map(product => ({
        ...product,
        displayPrice: `$${(parseFloat(product.price) / Math.pow(10, product.tokenDecimals)).toFixed(2)}`,
      })),
    });
  } catch (error: any) {
    console.error('Get products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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

    const { orgId } = await params;

    const org = await getOrganizationById(orgId);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const hasAccess = await verifyOrgAccess(user.id, orgId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      price,
      tokenMint,
      tokenDecimals = 6,
      merchantWallet,
      imageUrl,
      metadata,
    } = body;

    // Validation
    if (!name || !price || !merchantWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price, merchantWallet' },
        { status: 400 }
      );
    }

    // Create product
    const product = await createProduct({
      organizationId: orgId,
      name,
      description,
      price,
      tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      tokenDecimals,
      merchantWallet,
      imageUrl,
      metadata,
    });

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        displayPrice: `$${(parseFloat(product.price) / Math.pow(10, product.tokenDecimals)).toFixed(2)}`,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}