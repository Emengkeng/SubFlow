import { db } from './drizzle';
import { users, teams, teamMembers, organizations, categories, platformConfig } from './schema';
import { hashPassword } from '@/lib/auth/session';
import crypto from 'crypto';

async function seedCategories() {
  console.log('Seeding categories...');

  const defaultCategories = [
    {
      name: 'Ebooks',
      slug: 'ebooks',
      description: 'Digital books and reading materials',
      icon: 'BookOpen',
      displayOrder: 1,
    },
    {
      name: 'Videos',
      slug: 'videos',
      description: 'Video courses and tutorials',
      icon: 'Video',
      displayOrder: 2,
    },
    {
      name: 'Audio',
      slug: 'audio',
      description: 'Music, audiobooks, and podcasts',
      icon: 'Headphones',
      displayOrder: 3,
    },
    {
      name: 'Software',
      slug: 'software',
      description: 'Applications and tools',
      icon: 'Code',
      displayOrder: 4,
    },
    {
      name: 'Graphics',
      slug: 'graphics',
      description: 'Templates, designs, and graphics',
      icon: 'Palette',
      displayOrder: 5,
    },
    {
      name: 'Documents',
      slug: 'documents',
      description: 'PDFs, spreadsheets, and documents',
      icon: 'FileText',
      displayOrder: 6,
    },
    {
      name: 'Courses',
      slug: 'courses',
      description: 'Complete learning courses',
      icon: 'GraduationCap',
      displayOrder: 7,
    },
    {
      name: 'Templates',
      slug: 'templates',
      description: 'Ready-to-use templates',
      icon: 'Layout',
      displayOrder: 8,
    },
  ];

  // Check if categories already exist
  const existingCategories = await db.select().from(categories).limit(1);
  
  if (existingCategories.length > 0) {
    console.log('Categories already exist, skipping...');
    return;
  }

  await db.insert(categories).values(defaultCategories);
  console.log(`✅ ${defaultCategories.length} categories created successfully.`);
}

async function seedPlatformConfig() {
  console.log('Seeding platform configuration...');

  const existingConfig = await db.select().from(platformConfig).limit(1);
  
  if (existingConfig.length > 0) {
    console.log('Platform config already exists, skipping...');
    return;
  }

  // You should replace this with your actual platform fee wallet
  const PLATFORM_FEE_WALLET = process.env.PLATFORM_FEE_WALLET || 'YOUR_SOLANA_WALLET_ADDRESS_HERE';

  await db.insert(platformConfig).values({
    platformFeeAmount: '1000000', // 1 USDC in smallest unit
    platformFeeWallet: PLATFORM_FEE_WALLET,
    gasSponsorshipEnabled: true,
  });

  console.log('✅ Platform config created successfully.');
}

// async function seedTestUser() {
//   console.log('Seeding test user and organization...');

//   const email = 'test@test.com';
//   const password = 'admin123';
//   const passwordHash = await hashPassword(password);

//   // Check if user exists
//   const existingUsers = await db
//     .select()
//     .from(users)
//     .where((users) => users.email === email)
//     .limit(1);

//   let user;
//   if (existingUsers.length > 0) {
//     console.log('Test user already exists, skipping user creation...');
//     user = existingUsers[0];
//   } else {
//     [user] = await db
//       .insert(users)
//       .values({
//         email: email,
//         passwordHash: passwordHash,
//         role: 'owner',
//       })
//       .returning();

//     console.log('✅ Test user created.');
//   }

//   // Create organization with API key
//   const apiKey = crypto.randomBytes(32).toString('hex');
//   const webhookSecret = crypto.randomBytes(32).toString('hex');

//   const existingOrgs = await db
//     .select()
//     .from(organizations)
//     .where((orgs) => orgs.email === email)
//     .limit(1);

//   let organization;
//   if (existingOrgs.length > 0) {
//     console.log('Test organization already exists, skipping...');
//     organization = existingOrgs[0];
//   } else {
//     [organization] = await db
//       .insert(organizations)
//       .values({
//         name: 'Test Organization',
//         email: email,
//         apiKey: apiKey,
//         webhookSecret: webhookSecret,
//         website: 'https://example.com',
//       })
//       .returning();

//     console.log('✅ Test organization created.');
//     console.log(`   API Key: ${apiKey}`);
//     console.log(`   Webhook Secret: ${webhookSecret}`);
//   }

//   // Create team linked to organization
//   const existingTeams = await db
//     .select()
//     .from(teams)
//     .where((t) => t.name === 'Test Team')
//     .limit(1);

//   let team;
//   if (existingTeams.length > 0) {
//     console.log('Test team already exists, skipping...');
//     team = existingTeams[0];
//   } else {
//     [team] = await db
//       .insert(teams)
//       .values({
//         name: 'Test Team',
//         organizationId: organization.id,
//       })
//       .returning();

//     console.log('✅ Test team created.');
//   }

//   // Add user to team
//   const existingMembership = await db
//     .select()
//     .from(teamMembers)
//     .where((tm) => tm.userId === user.id && tm.teamId === team.id)
//     .limit(1);

//   if (existingMembership.length === 0) {
//     await db.insert(teamMembers).values({
//       teamId: team.id,
//       userId: user.id,
//       role: 'owner',
//     });

//     console.log('✅ User added to team.');
//   } else {
//     console.log('User already member of team, skipping...');
//   }

//   console.log('\n📝 Test Credentials:');
//   console.log(`   Email: ${email}`);
//   console.log(`   Password: ${password}`);
//   console.log(`   Organization ID: ${organization.id}`);
// }

async function seed() {
  try {
    console.log('🌱 Starting seed process...\n');

    await seedPlatformConfig();
    await seedCategories();
   // await seedTestUser();

    console.log('\n✅ Seed process completed successfully!');
    console.log('\n🚀 You can now:');
    console.log('   1. Run: pnpm run dev');
    // console.log('   2. Login with test@test.com / admin123');
    console.log('   3. Create products and start selling!');
  } catch (error) {
    console.error('❌ Seed process failed:', error);
    throw error;
  }
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('\nSeed process finished. Exiting...');
    process.exit(0);
  });