import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { categories } from '@/lib/db/schema';
import { eq, asc, desc, isNull } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const parentId = searchParams.get('parentId');
    const topLevelOnly = searchParams.get('topLevelOnly') === 'true';

    // Build query conditions
    const conditions = [];
    
    if (!includeInactive) {
      conditions.push(eq(categories.isActive, true));
    }

    if (topLevelOnly) {
      conditions.push(isNull(categories.parentId));
    } else if (parentId) {
      conditions.push(eq(categories.parentId, parentId));
    }

    // Fetch categories
    const allCategories = await db.query.categories.findMany({
      where: conditions.length > 0 ? conditions.reduce((acc, cond) => acc && cond) : undefined,
      orderBy: [asc(categories.displayOrder), asc(categories.name)],
    });

    // Build hierarchical structure if fetching top-level categories
    let responseData;
    
    if (topLevelOnly || !parentId) {
      // Group categories with their children
      const categoryMap = new Map();
      const rootCategories: any[] = [];

      // First pass: create map of all categories
      allCategories.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] });
      });

      // Second pass: build hierarchy
      allCategories.forEach(cat => {
        if (cat.parentId && categoryMap.has(cat.parentId)) {
          categoryMap.get(cat.parentId).children.push(categoryMap.get(cat.id));
        } else if (!cat.parentId) {
          rootCategories.push(categoryMap.get(cat.id));
        }
      });

      responseData = rootCategories;
    } else {
      responseData = allCategories;
    }

    const categoryCounts = await db.query.categories.findMany({
      where: !includeInactive ? eq(categories.isActive, true) : undefined,
      with: {
        products: {
          where: eq(categories.isActive, true),
          columns: { id: true },
        },
      },
    });

    const countsMap = new Map();
    categoryCounts.forEach(cat => {
      countsMap.set(cat.id, cat.products?.length || 0);
    });

    const enhanceWithCounts = (cats: any[]): any[] => {
      return cats.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        imageUrl: cat.imageUrl,
        parentId: cat.parentId,
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
        productCount: countsMap.get(cat.id) || 0,
        children: cat.children ? enhanceWithCounts(cat.children) : undefined,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      }));
    };

    const enrichedData = Array.isArray(responseData) 
      ? enhanceWithCounts(responseData)
      : responseData;

    return NextResponse.json({
      success: true,
      categories: enrichedData,
      count: Array.isArray(enrichedData) ? enrichedData.length : 0,
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      slug,
      description,
      icon,
      imageUrl,
      parentId,
      displayOrder = 0,
      isActive = true,
    } = body;

    // Validation
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug' },
        { status: 400 }
      );
    }

    const existing = await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Category with this slug already exists' },
        { status: 409 }
      );
    }

    const newCategory = await db
      .insert(categories)
      .values({
        name,
        slug,
        description,
        icon,
        imageUrl,
        parentId,
        displayOrder,
        isActive,
      })
      .returning();

    return NextResponse.json({
      success: true,
      category: newCategory[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create category error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}