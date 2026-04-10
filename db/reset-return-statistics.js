import pool from './database.js';

async function resetReturnStatistics() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔄 İade istatistiklerini sıfırlıyorum...');
    
    // Önce mevcut verileri göster
    const beforeResult = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COALESCE(SUM(rejected_quantity), 0) as total_rejected
      FROM quality_results
      WHERE rejected_quantity > 0
    `);
    
    console.log(`📊 Mevcut durum:`);
    console.log(`   - Iade kaydı: ${beforeResult.rows[0].total_records}`);
    console.log(`   - Toplam iade miktarı: ${beforeResult.rows[0].total_rejected}`);
    
    // rejected_quantity'leri sıfırla
    const resetResult = await client.query(`
      UPDATE quality_results
      SET rejected_quantity = 0
      WHERE rejected_quantity > 0
    `);
    
    console.log(`✅ ${resetResult.rowCount} kayıt sıfırlandı`);
    
    // Kontrol
    const afterResult = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COALESCE(SUM(rejected_quantity), 0) as total_rejected
      FROM quality_results
      WHERE rejected_quantity > 0
    `);
    
    console.log(`📊 Yeni durum:`);
    console.log(`   - İade kaydı: ${afterResult.rows[0].total_records}`);
    console.log(`   - Toplam iade miktarı: ${afterResult.rows[0].total_rejected}`);
    
    await client.query('COMMIT');
    console.log('✅ İstatistikler sıfırlandı - Şimdi yeni iadeler sayılacak');
    
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Hata:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

resetReturnStatistics();




 