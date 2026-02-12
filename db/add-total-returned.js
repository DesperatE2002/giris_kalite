import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '..', 'database.sqlite'));

console.log('🔄 total_returned_quantity migration başlatılıyor...');

try {
  // total_returned_quantity sütununu ekle (kümülatif iade takibi - asla azalmaz)
  const columns = db.pragma('table_info(quality_results)');
  const hasColumn = columns.some(c => c.name === 'total_returned_quantity');
  
  if (!hasColumn) {
    db.exec(`ALTER TABLE quality_results ADD COLUMN total_returned_quantity REAL DEFAULT 0`);
    console.log('✅ total_returned_quantity sütunu eklendi');
    
    // Mevcut verileri backfill et - hala rejected_quantity > 0 olan kayıtlardan
    const updated = db.prepare(`
      UPDATE quality_results 
      SET total_returned_quantity = rejected_quantity 
      WHERE rejected_quantity > 0
    `).run();
    console.log(`✅ ${updated.changes} kayıt güncellendi (mevcut rejected_quantity'den)`);
    
    // Ayrıca status = 'iade' olan ama rejected_quantity = 0 olanları da kontrol et
    // (bu durumda yenisi gelmiş ama istatistik kaybolmuş demektir)
    // Bu kayıpları geri getiremeyiz çünkü orijinal miktar bilinmiyor
    const lostReturns = db.prepare(`
      SELECT COUNT(*) as count FROM quality_results 
      WHERE status = 'iade' AND rejected_quantity = 0
    `).get();
    
    if (lostReturns.count > 0) {
      console.log(`⚠️ ${lostReturns.count} kayıt bulundu: status='iade' ama rejected_quantity=0 (yenisi gelmiş, eski istatistik kayıp)`);
    }
  } else {
    console.log('ℹ️ total_returned_quantity sütunu zaten mevcut');
  }
  
  // returned_by sütununu ekle (kim iade kesti - ayrıca takip)
  const hasReturnedBy = columns.some(c => c.name === 'returned_by');
  if (!hasReturnedBy) {
    db.exec(`ALTER TABLE quality_results ADD COLUMN returned_by INTEGER REFERENCES users(id)`);
    console.log('✅ returned_by sütunu eklendi');
    
    // Mevcut verileri backfill et - decision_by'dan
    const updated2 = db.prepare(`
      UPDATE quality_results 
      SET returned_by = decision_by 
      WHERE status = 'iade' AND decision_by IS NOT NULL
    `).run();
    console.log(`✅ ${updated2.changes} kayıt returned_by güncellendi`);
  } else {
    console.log('ℹ️ returned_by sütunu zaten mevcut');
  }

  console.log('✅ Migration tamamlandı!');
} catch (error) {
  console.error('❌ Migration hatası:', error);
  process.exit(1);
}

db.close();
