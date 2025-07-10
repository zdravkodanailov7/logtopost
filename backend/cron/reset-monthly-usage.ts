import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users } from '../schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function resetMonthlyUsage() {
  console.log('🔄 Starting monthly usage reset...');
  
  try {
    // Reset generations_used_this_month for all active users
    const result = await db
      .update(users)
      .set({
        generations_used_this_month: 0,
        updated_at: new Date()
      })
      .where(eq(users.subscription_status, 'active'))
      .returning({ id: users.id });

    console.log(`✅ Reset usage for ${result.length} active users`);
    
    // Also reset for trial users (they get a fresh count each month too)
    const trialResult = await db
      .update(users)
      .set({
        generations_used_this_month: 0,
        updated_at: new Date()
      })
      .where(eq(users.subscription_status, 'trial'))
      .returning({ id: users.id });

    console.log(`✅ Reset usage for ${trialResult.length} trial users`);
    
    console.log('🎉 Monthly usage reset completed successfully!');
  } catch (error) {
    console.error('❌ Monthly usage reset failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the reset
resetMonthlyUsage().catch(console.error);

// Export for potential use in other scripts
export { resetMonthlyUsage }; 