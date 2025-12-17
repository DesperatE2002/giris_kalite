# Excel BOM Şablonu

## BOM Yükleme için Excel Formatı

Excel dosyanızda aşağıdaki sütunlar bulunmalıdır:

### Sütun Başlıkları (alternatif isimler kabul edilir):

1. **Malzeme Kodu** 
   - Alternatifler: `material_code`, `MALZEME KODU`, `malzeme_kodu`
   - Zorunlu: Evet
   - Örnek: MAT-001, CELL-18650, BMS-001

2. **Malzeme Adı**
   - Alternatifler: `material_name`, `MALZEME ADI`, `malzeme_adi`
   - Zorunlu: Evet
   - Örnek: Lityum Hücre 18650, BMS Kartı 10S

3. **Miktar**
   - Alternatifler: `required_quantity`, `MIKTAR`, `miktar`
   - Zorunlu: Evet
   - Tip: Sayı (ondalık kabul edilir)
   - Örnek: 100, 10.5, 250

4. **Birim**
   - Alternatifler: `unit`, `BIRIM`, `birim`
   - Zorunlu: Evet
   - Örnek: adet, kg, gr, metre, litre

---

## Örnek Excel İçeriği

| Malzeme Kodu | Malzeme Adı | Miktar | Birim |
|--------------|-------------|--------|-------|
| MAT-001 | Lityum Hücre 18650 2600mAh | 100 | adet |
| MAT-002 | BMS Kartı 10S 36V 30A | 10 | adet |
| MAT-003 | Nikel Şerit 8mm | 500 | gr |
| MAT-004 | Kablo Silikon 2.5mm Kırmızı | 50 | metre |
| MAT-005 | Kablo Silikon 2.5mm Siyah | 50 | metre |
| MAT-006 | XT60 Konnektör Erkek | 10 | adet |
| MAT-007 | XT60 Konnektör Dişi | 10 | adet |
| MAT-008 | Termal Pad 1mm | 200 | gr |
| MAT-009 | Kapton Bant 20mm | 5 | metre |
| MAT-010 | PVC Shrink 85mm | 2.5 | metre |

---

## Excel Hazırlama İpuçları

1. **Başlık satırı:** İlk satırda sütun başlıkları olmalı
2. **Veri satırları:** 2. satırdan itibaren veri girişi yapın
3. **Boş satır bırakmayın:** Veriler arasında boş satır olmamalı
4. **Malzeme kodları benzersiz olmalı:** Aynı OTPA için aynı malzeme kodu tekrar edemez
5. **Miktar sayısal olmalı:** Virgül yerine nokta kullanın (10.5)
6. **Dosya formatı:** .xlsx veya .xls

---

## Yükleme Adımları

1. Admin olarak giriş yap
2. **Yönetim Paneli > OTPA Yönetimi** sayfasına git
3. İlgili OTPA için "BOM Yükle" butonuna tıkla
4. Excel dosyasını seç
5. "Yükle" butonuna tıkla

⚠️ **UYARI:** Mevcut BOM silinip yeni BOM yüklenecektir!

---

## Hata Mesajları ve Çözümler

### "Excel dosyası boş"
- Excel'de veri olduğundan emin olun
- Başlık satırının doğru olduğunu kontrol edin

### "Satır X: Eksik bilgi"
- Tüm sütunların doldurulduğundan emin olun
- Malzeme kodu, adı, miktar ve birim zorunludur

### "Satır X: Geçersiz miktar değeri"
- Miktar alanına sadece sayı girin
- Negatif değer girmemeye dikkat edin

### "Bu malzeme kodu bu OTPA için zaten mevcut"
- Excel'de aynı malzeme kodu birden fazla kez kullanılmış
- Her malzeme kodu benzersiz olmalı

---

## Örnek Excel Dosyası

Örnek bir BOM Excel dosyası oluşturmak için:

1. Excel'i açın
2. Yukarıdaki tablodaki gibi sütunları oluşturun
3. Kendi malzeme bilgilerinizi girin
4. `BOM_Ornek.xlsx` olarak kaydedin
5. Admin panelinden yükleyin

---

## Toplu BOM Güncelleme

Mevcut bir BOM'u güncellemek için:

1. Mevcut BOM'u dışa aktarın (elle Excel'e kopyalayın)
2. Gerekli değişiklikleri yapın
3. Güncellenmiş Excel'i yükleyin
4. Sistem eski BOM'u silip yeni BOM'u yükler

---

## Alternatif: Manuel BOM Girişi

Excel yerine tek tek malzeme eklemek isterseniz:

1. **Yönetim Paneli > OTPA Yönetimi**
2. OTPA detayına git
3. "BOM Kalemi Ekle" formu ile tek tek ekle

Bu yöntem az sayıda malzeme için uygundur.
