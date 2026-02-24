import pg from 'pg';

async function main() {
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) { console.log('NO SUPABASE_DATABASE_URL'); return; }
  const pool = new pg.Pool({ connectionString: url, max: 1, idleTimeoutMillis: 8000, connectionTimeoutMillis: 8000 });
  try {
    const r1 = await pool.query('SELECT COUNT(*) as cnt FROM auth.users');
    console.log('auth.users count:', r1.rows[0].cnt);
    const r2 = await pool.query('SELECT id, email FROM auth.users ORDER BY created_at DESC');
    r2.rows.forEach((u: any) => console.log(' ', u.id.slice(0,12), u.email));
    const r3 = await pool.query('SELECT "userId", balance FROM user_coins ORDER BY balance DESC');
    console.log('\nLocal user_coins:', r3.rows.length);
    r3.rows.forEach((u: any) => console.log(' ', String(u.userId || u.userid).slice(0,12), 'balance:', u.balance));
  } catch(e: any) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
main();
