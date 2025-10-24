import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/db/payment-queries';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const minPrice = searchParams.get('minPrice') || undefined;
    const maxPrice = searchParams.get('maxPrice') || undefined;

    // Fetch all active products from the test organization
    const products = await searchProducts({
      search,
      minPrice,
      maxPrice,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      products: products.map((p) => ({
        ...p,
        displayPrice: `$${(parseFloat(p.price) / Math.pow(10, p.tokenDecimals)).toFixed(2)}`,
      })),
      count: products.length,
    });
  } catch (error: any) {
    console.error('Get public products error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}