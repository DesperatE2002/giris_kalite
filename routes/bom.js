import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { authenticateToken } from '../middleware/auth.js';
import { requireModuleAccess } from './roles.js';
import path from 'path';
import fs from 'fs';
import pool from '../db/database.js';

const router = express.Router();

// Uploads klasörünü oluştur (Vercel için /tmp kullan)
const uploadsDir = process.env.VERCEL ? '/tmp/uploads' : './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer ayarları
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bom-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Sadece Excel dosyaları yüklenebilir'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// OTPA'nın BOM'unu getir
router.get('/:otpaId', authenticateToken, async (req, res) => {
  try {
    const { otpaId } = req.params;

    const result = await pool.query(
      'SELECT * FROM bom_items WHERE otpa_id = ? ORDER BY material_code',
      [otpaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('BOM getirme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// OTPA'nın tüm BOM'unu toplu sil
router.delete('/bulk-delete/:otpaId', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { otpaId } = req.params;

    await pool.query('DELETE FROM bom_items WHERE otpa_id = ?', [otpaId]);

    res.json({ message: 'Tüm BOM kalemleri silindi' });
  } catch (error) {
    console.error('BOM toplu silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Excel'den BOM yükle
router.post('/upload', authenticateToken, requireModuleAccess('admin'), upload.single('file'), async (req, res) => {
  try {
    const { otpaId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    if (!otpaId) {
      fs.unlinkSync(req.file.path); // Dosyayı sil
      return res.status(400).json({ error: 'OTPA ID gerekli' });
    }

    // Excel dosyasını oku
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Dosyayı sil
    fs.unlinkSync(req.file.path);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel dosyası boş' });
    }

    // BOM verilerini doğrula ve hazırla
    const bomItems = [];
    const errors = [];

    data.forEach((row, index) => {
      const lineNumber = index + 2; // Excel'de başlık satırı 1, veri 2'den başlar
      
      // Sütun isimlerini esnek şekilde eşleştir
      const materialCode = row['Malzeme Kodu'] || row['malzeme_kodu'] || row['material_code'] || row['MALZEME KODU'];
      const materialName = row['Malzeme Adı'] || row['malzeme_adi'] || row['material_name'] || row['MALZEME ADI'];
      const requiredQuantity = row['Miktar'] || row['miktar'] || row['required_quantity'] || row['MIKTAR'];
      const unit = row['Birim'] || row['birim'] || row['unit'] || row['BIRIM'];
      const componentType = row['Komponent'] || row['komponent'] || row['component_type'] || row['KOMPONENT'];

      if (!materialCode || !materialName || !requiredQuantity || !unit) {
        errors.push(`Satır ${lineNumber}: Eksik bilgi (Malzeme Kodu, Malzeme Adı, Miktar, Birim gerekli)`);
        return;
      }

      const quantity = parseFloat(requiredQuantity);
      if (isNaN(quantity) || quantity <= 0) {
        errors.push(`Satır ${lineNumber}: Geçersiz miktar değeri`);
        return;
      }

      // Component type'ı normalize et - Varsayılan: batarya
      let normalizedComponentType = 'batarya';
      if (componentType) {
        const componentTypeLower = componentType.toString().toLowerCase().trim();
        if (componentTypeLower.includes('vccu')) {
          normalizedComponentType = 'vccu';
        } else if (componentTypeLower.includes('junction') || componentTypeLower.includes('box')) {
          normalizedComponentType = 'junction_box';
        } else if (componentTypeLower.includes('pdu')) {
          normalizedComponentType = 'pdu';
        }
      }

      bomItems.push({
        material_code: materialCode.toString().trim(),
        material_name: materialName.toString().trim(),
        required_quantity: quantity,
        unit: unit.toString().trim(),
        component_type: normalizedComponentType
      });
    });

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Dosya hatası', details: errors });
    }

    // OTPA'nın paket sayısını al
    const otpaResult = await pool.query(
      'SELECT battery_pack_count FROM otpa WHERE id = ?',
      [otpaId]
    );
    
    const batteryPackCount = otpaResult.rows[0]?.battery_pack_count || 1;
    console.log(`📦 OTPA Paket Sayısı: ${batteryPackCount}`);

    // Önce mevcut BOM'u sil
    await pool.query('DELETE FROM bom_items WHERE otpa_id = ?', [otpaId]);

    // Yeni BOM'u ekle (sadece batarya için miktarları paket sayısıyla çarp)
    let batteryCount = 0;
    let otherCount = 0;
    
    for (const item of bomItems) {
      // Sadece batarya komponentleri için paket sayısıyla çarp
      const multiplier = item.component_type === 'batarya' ? batteryPackCount : 1;
      const adjustedQuantity = item.required_quantity * multiplier;
      
      await pool.query(
        `INSERT INTO bom_items (otpa_id, component_type, material_code, material_name, required_quantity, unit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [otpaId, item.component_type, item.material_code, item.material_name, adjustedQuantity, item.unit]
      );
      
      if (item.component_type === 'batarya') {
        batteryCount++;
      } else {
        otherCount++;
      }
    }

    console.log(`✅ ${batteryCount} batarya malzemesi (${batteryPackCount}x), ${otherCount} diğer malzeme (1x) eklendi`);

    res.json({
      message: 'BOM başarıyla yüklendi',
      count: bomItems.length,
      battery_pack_count: batteryPackCount,
      battery_items: batteryCount,
      other_items: otherCount,
      note: `Batarya: ${batteryCount} malzeme (${batteryPackCount}x çarpıldı), Diğer: ${otherCount} malzeme (1x)`
    });
  } catch (error) {
    console.error('BOM yükleme hatası:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

// Tek BOM kalemi ekle
router.post('/', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { otpa_id, material_code, material_name, required_quantity, unit } = req.body;

    if (!otpa_id || !material_code || !material_name || !required_quantity || !unit) {
      return res.status(400).json({ error: 'Tüm alanları doldurun' });
    }

    const result = await pool.query(
      `INSERT INTO bom_items (otpa_id, material_code, material_name, required_quantity, unit)
       VALUES (?, ?, ?, ?, ?)`,
      [otpa_id, material_code, material_name, required_quantity, unit]
    );

    // Son eklenen kaydı al
    const getResult = await pool.query(
      'SELECT * FROM bom_items WHERE otpa_id = ? AND material_code = ?',
      [otpa_id, material_code]
    );

    res.status(201).json(getResult.rows[0]);
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Bu malzeme kodu bu OTPA için zaten mevcut' });
    }
    console.error('BOM ekleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// BOM kalemi sil
router.delete('/:id', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Önce veriyi kontrol et
    const checkResult = await pool.query('SELECT * FROM bom_items WHERE id = ?', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'BOM kalemi bulunamadı' });
    }

    await pool.query('DELETE FROM bom_items WHERE id = ?', [id]);

    res.json({ message: 'BOM kalemi silindi', deleted: checkResult.rows[0] });
  } catch (error) {
    console.error('BOM silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Komponent bazlı BOM yükleme
router.post('/upload-component', authenticateToken, requireModuleAccess('admin'), async (req, res) => {
  try {
    const { otpa_id, component_type, items } = req.body;

    if (!otpa_id || !component_type || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'otpa_id, component_type ve items gereklidir' });
    }

    // Component type kontrolü
    const validTypes = ['batarya', 'vccu', 'junction_box', 'pdu'];
    if (!validTypes.includes(component_type)) {
      return res.status(400).json({ error: 'Geçersiz component_type' });
    }

    // OTPA'nın paket sayısını al
    const otpaResult = await pool.query(
      'SELECT battery_pack_count FROM otpa WHERE id = ?',
      [otpa_id]
    );
    
    const batteryPackCount = otpaResult.rows[0]?.battery_pack_count || 1;
    
    // Sadece batarya için paket sayısıyla çarp, diğerleri için 1x
    const multiplier = component_type === 'batarya' ? batteryPackCount : 1;
    
    console.log(`📦 ${component_type.toUpperCase()} BOM yükleniyor - OTPA: ${otpa_id}, Çarpan: ${multiplier}x, ${items.length} malzeme`);

    // Önce bu komponent için mevcut BOM'u sil
    const deleteResult = await pool.query(
      'DELETE FROM bom_items WHERE otpa_id = ? AND component_type = ?',
      [otpa_id, component_type]
    );
    console.log(`🗑️ ${deleteResult.rowCount || 0} eski kayıt silindi`);

    // Malzeme kodlarında tekrar olup olmadığını kontrol et
    const materialCodes = items.map(item => item.material_code);
    const uniqueCodes = new Set(materialCodes);
    
    if (materialCodes.length !== uniqueCodes.size) {
      const duplicates = materialCodes.filter((code, index) => materialCodes.indexOf(code) !== index);
      return res.status(400).json({ 
        error: 'Aynı malzeme kodu birden fazla kez var: ' + [...new Set(duplicates)].join(', ')
      });
    }

    // Yeni BOM'u ekle
    let successCount = 0;
    for (const item of items) {
      const adjustedQuantity = item.required_quantity * multiplier;
      
      try {
        await pool.query(
          `INSERT INTO bom_items (otpa_id, component_type, material_code, material_name, required_quantity, unit)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [otpa_id, component_type, item.material_code, item.material_name, adjustedQuantity, item.unit]
        );
        successCount++;
      } catch (insertError) {
        console.error(`❌ Ekleme hatası - Malzeme: ${item.material_code}, Hata: ${insertError.message}`);
        throw insertError;
      }
    }

    console.log(`✅ ${successCount} malzeme başarıyla eklendi`);

    res.json({
      message: `${component_type.toUpperCase()} BOM başarıyla yüklendi`,
      count: successCount,
      component_type: component_type,
      multiplier: multiplier
    });
  } catch (error) {
    console.error('BOM yükleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
  }
});

export default router;
