import dns from 'dns';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Force Node.js to prefer IPv4 when resolving hostnames
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf-8');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connected to PostgreSQL');
    console.log('📦 Running schema migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');

    // Verify tables exist
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('services', 'bookings')
      ORDER BY table_name;
    `);
    console.log('📋 Tables confirmed:', res.rows.map(r => r.table_name).join(', '));

    // Check seed data
    const services = await client.query('SELECT id, name, price FROM services ORDER BY id;');
    console.log('🌱 Seed data:');
    services.rows.forEach(s => console.log(`   [${s.id}] ${s.name} - ${Number(s.price).toLocaleString('vi-VN')}đ`));

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
