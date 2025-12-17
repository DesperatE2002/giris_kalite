# Render Deployment (Vercel alternatifi)

## Neden Render?
- ✅ Node.js uygulamaları için daha kolay
- ✅ Ücretsiz PostgreSQL database
- ✅ Otomatik SSL
- ✅ Environment variables kolay yönetim

## Deployment Adımları

### 1. Render.com'a Kaydolun
https://render.com

### 2. New Web Service Oluşturun
1. Dashboard → "New +" → "Web Service"
2. GitHub'dan repository seçin: `giris_kalite`
3. Settings:
   - **Name**: `giris-kalite`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free

### 3. Environment Variables Ekleyin
Settings → Environment → Add Environment Variable:

```
DATABASE_URL=postgresql://neondb_owner:npg_9pajJwNlQCm0@ep-mute-glitter-aghrig57-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require

JWT_SECRET=otpa_kalite_gizli_anahtar_2025_degistir

SESSION_SECRET=otpa_session_gizli_2025_degistir

NODE_ENV=production

PORT=3000
```

### 4. Deploy
"Create Web Service" butonuna tıklayın.

### 5. Domain
Otomatik domain: `https://giris-kalite.onrender.com`

## Avantajları
- Vercel'e göre Express apps için daha uygun
- Serverless değil, normal Node.js server
- Better SQLite kullanmaya gerek yok
- Deployment daha stabil

## Not
Render free tier'da 15 dakika inactivity sonrası sleep mode'a girer.
İlk istek 30 saniye sürebilir (cold start).
