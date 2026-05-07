import pool from './index';

const run = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM subscriptions
       WHERE tenant_id = '77777777-7777-7777-7777-777777777777'
       RETURNING id, plan_type, status`,
    );
    if (result.rows.length > 0) {
      console.log(`Deleted subscription:`, result.rows[0]);
    } else {
      console.log('No subscription row found — nothing to delete.');
    }
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
