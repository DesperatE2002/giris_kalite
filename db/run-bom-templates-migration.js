import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    console.log('🔄 BOM şablonları tabloları oluşturuluyor...');
    
    const sql = fs.readFileSync('db/add-bom-templates.sql', 'utf8');
    await pool.query(sql);
    
    console.log('✅ BOM şablonları tabloları başarıyla oluşturuldu!');
  } catch (error) {
    console.error('❌ Migration hatası:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
