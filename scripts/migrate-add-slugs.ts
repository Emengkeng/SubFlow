import { db } from '../lib/db/drizzle';
import { products } from '../lib/db/schema';
import { isNull, or, eq } from 'drizzle-orm';
import { generateUniqueSlug } from '../lib/utils/slug';

async function migrateProductSlugs() {
  console.log('🔄 Starting product slug migration...\n');

  try {
    // Find products without slugs
    const productsWithoutSlugs = await db
      .select()
      .from(products)
      .where(or(isNull(products.slug), eq(products.slug, '')));

    if (productsWithoutSlugs.length === 0) {
      console.log('✅ All products already have slugs. Nothing to migrate.');
      return;
    }

    console.log(`Found ${productsWithoutSlugs.length} products without slugs.\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const product of productsWithoutSlugs) {
      try {
        // Generate unique slug
        const slug = generateUniqueSlug(product.name, 6);

        // Update product
        await db
          .update(products)
          .set({ 
            slug,
            updatedAt: new Date() 
          })
          .where(eq(products.id, product.id));

        console.log(`✅ Updated: "${product.name}" -> "${slug}"`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to update product "${product.name}":`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📦 Total: ${productsWithoutSlugs.length}`);

    if (successCount > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\n🔗 Products can now be accessed via:');
      console.log('   - By ID: /products/{uuid}');
      console.log('   - By Slug: /products/{product-name-abc123}');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrateProductSlugs()
  .then(() => {
    console.log('\n🏁 Migration process finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration process failed:', error);
    process.exit(1);
  });