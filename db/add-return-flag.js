import pool from './database.js';

async function addReturnFlag() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 goods_receipt tablosuna return_of_rejected kolonu ekleniyor...');
    
    await client.query(`
      ALTER TABLE goods_receipt 
      ADD COLUMN IF NOT EXISTS return_of_rejected BOOLEAN DEFAULT false
    `);
    
    console.log('✅ return_of_rejected kolonu eklendi');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

addReturnFlag();
