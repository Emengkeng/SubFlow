import { NextRequest, NextResponse } from 'next/server';
import {
  getProductById,
  updateProduct,
  deleteProduct,
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
  { params }: { params: { orgId: string; productId: string } }
) {
  try {

    const user = await getUser();
        if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, productId } = await params;

    const product = await getProductById(productId);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Verify product belongs to organization
    if (product.organizationId !== orgId) {
      return NextResponse.json({ error: 'Product not found in this organization' }, { status: 404 });
    }

    const hasAccess = await verifyOrgAccess(user.id, orgId);
        if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        displayPrice: `$${(parseFloat(product.price) / Math.pow(10, product.tokenDecimals)).toFixed(2)}`,
      },
    });
  } catch (error: any) {
    console.error('Get product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string; productId: string } }
) {
  try {

    const { orgId, productId } = await params;

    const user = await getUser();
        if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const existingProduct = await getProductById(productId);

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Verify product belongs to organization
    if (existingProduct.organizationId !== orgId) {
      return NextResponse.json({ error: 'Product not found in this organization' }, { status: 404 });
    }

    const hasAccess = await verifyOrgAccess(user.id, orgId);
        if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    const allowedUpdates = {
      name: body.name,
      description: body.description,
      price: body.price,
      imageUrl: body.imageUrl,
      isActive: body.isActive,
      metadata: body.metadata,
    };

    const updates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
    );

    const product = await updateProduct(productId, updates);

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        displayPrice: `$${(parseFloat(product.price) / Math.pow(10, product.tokenDecimals)).toFixed(2)}`,
      },
    });
  } catch (error: any) {
    console.error('Update product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string; productId: string } }
) {
  try {
    const { orgId, productId } = await params;

    const user = await getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const existingProduct = await getProductById(productId);

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Verify product belongs to organization
    if (existingProduct.organizationId !== orgId) {
      return NextResponse.json({ error: 'Product not found in this organization' }, { status: 404 });
    }

    const hasAccess = await verifyOrgAccess(user.id, orgId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete
    await deleteProduct(productId);

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}