# OTPA Bazlı BOM Takip ve Giriş Kalite Kontrol Sistemi

## Özellikler

- ✅ OTPA bazlı BOM takibi
- ✅ Malzeme giriş kaydı
- ✅ Giriş kalite kontrolleri (Kabul/Red/Şartlı Kabul)
- ✅ OTPA tamamlama yüzdesi hesaplama
- ✅ Eksik malzeme görünürlüğü
- ✅ Excel'den BOM yükleme
- ✅ Rol bazlı yetkilendirme (Tekniker, Kalite, Admin)

## Teknolojiler

- **Backend**: Node.js + Express.js
- **Database**: Neon DB (PostgreSQL)
- **Frontend**: HTML + Tailwind CSS + Vanilla JS
- **Authentication**: JWT + Sessions

## Kurulum

1. Bağımlılıkları yükle:
```bash
npm install
```

2. `.env` dosyası oluştur (`.env.example` dosyasını kopyala):
```bash
copy .env.example .env
```

3. `.env` dosyasını düzenle ve Neon DB bağlantı bilgilerini ekle

4. Veritabanı migration'larını çalıştır:
```bash
npm run migrate
```

5. Sunucuyu başlat:
```bash
npm run dev
```

## Varsayılan Admin Kullanıcısı

Migration çalıştırıldığında otomatik olarak admin kullanıcısı oluşturulur:
- Kullanıcı Adı: `admin`
- Şifre: `admin123`

**Önemli**: İlk girişten sonra şifreyi değiştirin!

## Kullanıcı Rolleri

1. **Tekniker**: Malzeme giriş kaydı, BOM görüntüleme
2. **Kalite**: Kalite kararları verme, tüm kayıtları görüntüleme
3. **Admin**: Tüm yetkilere ek olarak kullanıcı yönetimi, OTPA/BOM yönetimi, raporlama

## Proje Yapısı

```
giris_kalite/
├── db/
│   ├── database.js       # Veritabanı bağlantısı
│   └── migrate.js        # Migration script
├── middleware/
│   └── auth.js           # Authentication middleware
├── routes/
│   ├── auth.js           # Login/logout routes
│   ├── otpa.js           # OTPA yönetimi
│   ├── bom.js            # BOM yönetimi
│   ├── goods-receipt.js  # Malzeme giriş
│   ├── quality.js        # Kalite kontrol
│   └── reports.js        # Raporlama
├── public/
│   ├── css/
│   ├── js/
│   └── index.html
├── uploads/              # Excel dosya yüklemeleri
├── server.js             # Ana sunucu dosyası
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Giriş yap
- `POST /api/auth/logout` - Çıkış yap
- `GET /api/auth/me` - Mevcut kullanıcı

### OTPA
- `GET /api/otpa` - Tüm OTPA'ları listele
- `POST /api/otpa` - Yeni OTPA oluştur
- `GET /api/otpa/:id` - OTPA detayları
- `PUT /api/otpa/:id` - OTPA güncelle

### BOM
- `GET /api/bom/:otpaId` - OTPA'nın BOM'unu getir
- `POST /api/bom/upload` - Excel'den BOM yükle
- `POST /api/bom` - Tek BOM kalemi ekle
- `DELETE /api/bom/:id` - BOM kalemi sil

### Malzeme Giriş
- `GET /api/goods-receipt` - Tüm giriş kayıtları
- `POST /api/goods-receipt` - Yeni giriş kaydı
- `GET /api/goods-receipt/otpa/:otpaId` - OTPA'ya göre girişler

### Kalite
- `GET /api/quality/pending` - Bekleyen kalite kontrolleri
- `POST /api/quality/:receiptId` - Kalite kararı ver
- `GET /api/quality/:receiptId` - Kalite sonucu görüntüle

### Raporlar
- `GET /api/reports/otpa-completion` - OTPA tamamlama raporu
- `GET /api/reports/missing-materials` - Eksik malzeme raporu
- `GET /api/reports/rejections` - Red/iade raporu
