# OTPA Giriş Kalite Sistemi - Kurulum Rehberi

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükle

```powershell
npm install
```

### 2. Neon DB Bağlantısını Ayarla

`.env` dosyasını düzenle ve Neon DB connection string'ini ekle:

```
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

Neon DB connection string'inizi [Neon Dashboard](https://console.neon.tech) üzerinden alabilirsiniz.

### 3. Veritabanını Oluştur

```powershell
npm run migrate
```

Bu komut:
- Tüm tabloları oluşturur
- Varsayılan admin kullanıcısı ekler (username: `admin`, password: `admin123`)
- Örnek OTPA ve BOM verileri oluşturur (test için)

### 4. Sunucuyu Başlat

```powershell
npm run dev
```

veya production için:

```powershell
npm start
```

### 5. Tarayıcıda Aç

http://localhost:3000

**İlk giriş:**
- Kullanıcı Adı: `admin`
- Şifre: `admin123`

⚠️ **ÖNEMLİ:** İlk girişten sonra admin şifresini mutlaka değiştirin!

---

## 📋 Özellikler

✅ **OTPA Yönetimi**
- OTPA oluşturma, düzenleme
- OTPA bazlı BOM takibi
- Tamamlanma yüzdesi hesaplama

✅ **BOM Yönetimi**
- Excel'den BOM yükleme
- Malzeme listesi görüntüleme
- Eksik malzeme takibi

✅ **Malzeme Girişi**
- Tekniker için basit giriş ekranı
- OTPA seçimi ve BOM özeti
- Hızlı malzeme kaydı

✅ **Kalite Kontrol**
- Kalite bekleyen kayıtlar
- Kabul/Red/Şartlı Kabul işlemleri
- Red nedeni kaydetme

✅ **Raporlama**
- OTPA tamamlama raporu
- Eksik malzeme raporu
- Red/iade raporu
- Özet istatistikler

✅ **Kullanıcı Yönetimi**
- Rol bazlı yetkilendirme (Tekniker, Kalite, Admin)
- Kullanıcı ekleme/düzenleme

---

## 🎯 Kullanım Senaryoları

### Senaryo 1: Yeni OTPA Oluştur ve BOM Yükle

1. **Admin girişi yap**
2. **Admin > OTPA Yönetimi** sayfasına git
3. "Yeni OTPA Oluştur" butonuna tıkla
4. OTPA bilgilerini gir (OTPA-2025-002, Proje Adı, vb.)
5. Oluşturulan OTPA için "BOM Yükle" butonuna tıkla
6. Excel dosyasını seç ve yükle

**Excel Formatı Örneği:**

| Malzeme Kodu | Malzeme Adı | Miktar | Birim |
|--------------|-------------|--------|-------|
| MAT-001 | Lityum Hücre | 100 | adet |
| MAT-002 | BMS Kartı | 10 | adet |

### Senaryo 2: Tekniker Malzeme Girişi

1. **Tekniker girişi yap**
2. **Malzeme Girişi** sayfasına git
3. OTPA seç (örn: OTPA-2025-001)
4. BOM özeti görüntülenir
5. Gelen malzemeyi seç (dropdown'dan)
6. Miktarı gir
7. "Girişi Kaydet" butonuna tıkla

### Senaryo 3: Kalite Kontrolü

1. **Kalite veya Admin girişi yap**
2. **Kalite Kontrol** sayfasına git
3. Bekleyen kayıtlar listelenir
4. "Kalite Kararı Ver" butonuna tıkla
5. Durumu seç (Kabul/Red/Şartlı Kabul)
6. Kabul ve Red miktarlarını gir
7. Red ise nedeni yaz
8. "Kararı Kaydet" butonuna tıkla

### Senaryo 4: OTPA Takibi

1. **Ana Sayfa** üzerinde tüm OTPA'ları görüntüle
2. İlerleme yüzdeleri ve durumları kontrol et
3. "Detay" butonuna tıklayarak OTPA detayına git
4. Malzeme bazında:
   - Gereken miktar
   - Kabul edilen miktar
   - Red edilen miktar
   - Eksik miktar
   - Tamamlanma yüzdesi
5. Filtreleme seçenekleri:
   - Eksikleri Göster
   - Problemleri Göster
   - Tümünü Göster

---

## 🛠️ Sorun Giderme

### Veritabanı bağlantı hatası

```
❌ Veritabanı bağlantı hatası
```

**Çözüm:**
- `.env` dosyasındaki `DATABASE_URL` değerini kontrol edin
- Neon DB projenizin aktif olduğundan emin olun
- Connection string'in doğru olduğunu Neon Dashboard'dan kontrol edin

### Migration hatası

```
❌ Migration hatası
```

**Çözüm:**
- Neon DB'de veritabanının oluşturulduğundan emin olun
- Connection string'de SSL ayarlarının doğru olduğunu kontrol edin
- `?sslmode=require` parametresinin connection string'de olduğundan emin olun

### Port zaten kullanımda

```
Error: listen EADDRINUSE :::3000
```

**Çözüm:**
- `.env` dosyasındaki `PORT` değerini değiştirin (örn: 3001)
- Veya 3000 portunu kullanan başka bir programı kapatın

---

## 📱 Mobil Kullanım

Sistem mobil uyumludur. Cep telefonunuzdan:

1. Bilgisayarınızın IP adresini öğrenin:
   ```powershell
   ipconfig
   ```
   
2. Tarayıcıda şu adresi açın:
   ```
   http://BILGISAYAR_IP:3000
   ```

Örnek: `http://192.168.1.100:3000`

---

## 🔐 Güvenlik Notları

1. **İlk kurulumda yapılacaklar:**
   - Admin şifresini değiştirin
   - `.env` dosyasındaki `JWT_SECRET` ve `SESSION_SECRET` değerlerini değiştirin
   - `.env` dosyasını `.gitignore`'a ekleyin (zaten eklendi)

2. **Production'a geçerken:**
   - `.env` dosyasında `NODE_ENV=production` yapın
   - Güçlü şifreler kullanın
   - HTTPS kullanın (Neon otomatik SSL kullanır)

---

## 🆘 Destek

Sorun yaşarsanız:
1. README.md dosyasını okuyun
2. Console'daki hata mesajlarını kontrol edin
3. `.env` dosyasının doğru yapılandırıldığından emin olun

---

## 📊 Veritabanı Yapısı

**Tablolar:**
- `users` - Kullanıcılar
- `otpa` - OTPA kayıtları
- `bom_items` - BOM kalemleri
- `goods_receipt` - Malzeme giriş kayıtları
- `quality_results` - Kalite sonuçları

**İlişkiler:**
- Her OTPA'nın birden fazla BOM kalemi olabilir
- Her BOM kalemi için birden fazla giriş kaydı olabilir
- Her giriş kaydının bir kalite sonucu vardır

---

## ✅ İlk Kurulum Kontrol Listesi

- [ ] Node.js yüklü (v16 veya üzeri)
- [ ] Neon DB hesabı oluşturuldu
- [ ] Proje oluşturuldu ve connection string alındı
- [ ] `npm install` çalıştırıldı
- [ ] `.env` dosyası yapılandırıldı
- [ ] `npm run migrate` başarıyla tamamlandı
- [ ] `npm run dev` ile sunucu başlatıldı
- [ ] http://localhost:3000 açıldı
- [ ] admin/admin123 ile giriş yapıldı
- [ ] Admin şifresi değiştirildi

Tüm adımlar tamamlandıysa sistem kullanıma hazır! 🎉
