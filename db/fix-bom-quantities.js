import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '..', 'database.sqlite'));

console.log('🔄 BOM miktarlarını paket sayısıyla çarpma işlemi başlatılıyor...');

try {
  // Tüm OTPA'ları al
  const otpas = db.prepare('SELECT id, otpa_number, battery_pack_count FROM otpa').all();
  
  console.log(`📦 Toplam ${otpas.length} OTPA bulundu`);
  
  for (const otpa of otpas) {
    const packCount = otpa.battery_pack_count || 1;
    
    if (packCount === 1) {
      console.log(`⏭️  ${otpa.otpa_number}: Paket sayısı 1, işlem gerekmiyor`);
      continue;
    }
    
    // Bu OTPA'nın BOM kalemlerini al
    const bomItems = db.prepare('SELECT id, material_code, required_quantity FROM bom_items WHERE otpa_id = ?').all(otpa.id);
    
    if (bomItems.length === 0) {
      console.log(`⚠️  ${otpa.otpa_number}: BOM kalemi yok`);
      continue;
    }
    
    console.log(`\n📋 ${otpa.otpa_number} (${packCount} paket):`);
    
    // Her BOM kalemini paket sayısıyla çarp
    const updateStmt = db.prepare('UPDATE bom_items SET required_quantity = ? WHERE id = ?');
    
    for (const item of bomItems) {
      // Mevcut miktar zaten çarpılmış mı kontrol et (basit kontrol)
      // Eğer miktar paket sayısına tam bölünüyorsa, muhtemelen zaten çarpılmamış
      const originalQty = item.required_quantity / packCount;
      
      // Sadece tam sayı veya 2 ondalık basamağa kadar olan değerler için çarp
      if (Number.isInteger(originalQty) || (originalQty * 100) % 1 === 0) {
        // Bu muhtemelen henüz çarpılmamış bir değer
        const newQty = originalQty * packCount;
        updateStmt.run(newQty, item.id);
        console.log(`  ✅ ${item.material_code}: ${originalQty} x ${packCount} = ${newQty}`);
      } else {
        // Bu muhtemelen zaten çarpılmış
        console.log(`  ⏭️  ${item.material_code}: ${item.required_quantity} (zaten güncellenmiş olabilir)`);
      }
    }
  }
  
  console.log('\n✅ BOM miktarları başarıyla güncellendi!');
  
} catch (error) {
  console.error('❌ Hata:', error);
  process.exit(1);
} finally {
  db.close();
}
