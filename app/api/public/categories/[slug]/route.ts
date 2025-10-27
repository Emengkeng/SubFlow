import { NextRequest, NextResponse } from 'next/server';
import { getCategoryBySlug, getProductsByCategory } from '@/lib/db/payment-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const includeProducts = searchParams.get('includeProducts') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const category = await getCategoryBySlug(slug);

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    let products = null;
    if (includeProducts) {
      products = await getProductsByCategory(slug, limit);
    }

    return NextResponse.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        imageUrl: category.imageUrl,
        parentId: category.parentId,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
        parent: category.parent,
        children: category.children,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
      products: products ? products.map(product => ({
        ...product,
        displayPrice: `$${(parseFloat(product.price) / Math.pow(10, product.tokenDecimals)).toFixed(2)}`,
      })) : undefined,
    });
  } catch (error: any) {
    console.error('Get category error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch category' },
      { status: 500 }
    );
  }
}