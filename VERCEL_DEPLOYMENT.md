# Vercel Deployment Guide - Temsa Kalite Sistemi

## Ön Hazırlık

### 1. Vercel CLI Kurulumu
```bash
npm install -g vercel
```

### 2. Vercel'e Giriş
```bash
vercel login
```

## Deployment Adımları

### 1. İlk Deploy
```bash
vercel
```

### 2. Production Deploy
```bash
vercel --prod
```

## Environment Variables (Vercel Dashboard'da ayarlayın)

Vercel Dashboard > Your Project > Settings > Environment Variables

**Eklenecek değişkenler:**

1. **DATABASE_URL** (Production)
   - Type: `Secret`
   - Value: `postgresql://neondb_owner:npg_9pajJwNlQCm0@ep-mute-glitter-aghrig57-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - Environment: Production

2. **JWT_SECRET** (Production)
   - Type: `Secret`
   - Value: `otpa_kalite_gizli_anahtar_2025_degistir`
   - Environment: Production

3. **SESSION_SECRET** (Production)
   - Type: `Secret`
   - Value: `otpa_session_gizli_2025_degistir`
   - Environment: Production

4. **NODE_ENV**
   - Type: `Plain Text`
   - Value: `production`
   - Environment: Production

## Önemli Notlar

✅ **SQLite devre dışı**: Sadece PostgreSQL (Neon) kullanılıyor
✅ **Static files**: `public/` klasörü otomatik serve ediliyor
✅ **API routes**: `/api/*` yolları server.js'e yönlendiriliyor
✅ **SPA support**: Tüm route'lar index.html'e fallback yapıyor

## Domain Ayarları

Vercel otomatik bir domain verir:
- `https://your-project.vercel.app`

Custom domain eklemek için:
- Vercel Dashboard > Settings > Domains > Add

## Database Migration

Deploy sonrası ilk kez migration çalıştırmak için:

```bash
vercel env pull .env.production
npm run migrate
```

Veya Vercel Functions ile otomatik migration için bir endpoint ekleyebiliriz.

## Monitoring

- Vercel Dashboard > Analytics
- Vercel Dashboard > Logs

## Troubleshooting

### Build Hatası
```bash
vercel logs
```

### Database Bağlantı Hatası
- Environment variables'ları kontrol edin
- DATABASE_URL doğru mu?

### Static Files Yüklenmiyor
- `vercel.json` route yapılandırmasını kontrol edin

## Güncelleme

Her kod değişikliğinde:
```bash
git add .
git commit -m "update"
vercel --prod
```

## Geri Alma (Rollback)

```bash
vercel rollback
```
