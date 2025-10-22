import { NextRequest, NextResponse } from 'next/server';
import {
  createProduct,
  getProductsByOrganization,
  getOrganizationByApiKey,
} from '@/lib/db/payment-queries';
import { nanoid } from 'nanoid';
import { CONFIG } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const organization = await getOrganizationByApiKey(apiKey);
    if (!organization) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      price,
     // tokenMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      tokenDecimals = 6,
      merchantWallet,
      imageUrl,
      metadata,
    } = body;

    if (!name || !price || !merchantWallet) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price, merchantWallet' },
        { status: 400 }
      );
    }

    const tokenMint = await CONFIG.USDC_ADDRESS

    const product = await createProduct({
      organizationId: organization.id,
      name,
      description,
      price,
      tokenMint,
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
    });
  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const organization = await getOrganizationByApiKey(apiKey);
    if (!organization) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const products = await getProductsByOrganization(organization.id);

    return NextResponse.json({
      success: true,
      products: products.map((p) => ({
        ...p,
        displayPrice: `$${(parseFloat(p.price) / Math.pow(10, p.tokenDecimals)).toFixed(2)}`,
      })),
      count: products.length,
    });
  } catch (error: any) {
    console.error('Get products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}