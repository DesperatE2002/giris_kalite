# Railway Deployment (ÖNERİLEN)

## Neden Railway?
- ✅ Express.js mükemmel çalışır
- ✅ Ücretsiz $5 credit (500 saat çalışma)
- ✅ Vercel'den daha kolay
- ✅ PostgreSQL otomatik entegrasyon
- ✅ GitHub auto-deploy

## HIZLI DEPLOYMENT (5 dakika)

### 1. Railway'e Git
https://railway.app → Sign up with GitHub

### 2. New Project
Dashboard → "New Project" → "Deploy from GitHub repo"

### 3. Repository Seç
`DesperatE2002/giris_kalite` seçin

### 4. Environment Variables
Settings → Variables → RAW Editor'a yapıştır:

```
DATABASE_URL=postgresql://neondb_owner:npg_9pajJwNlQCm0@ep-mute-glitter-aghrig57-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=otpa_kalite_gizli_anahtar_2025_degistir
SESSION_SECRET=otpa_session_gizli_2025_degistir
NODE_ENV=production
PORT=3000
```

### 5. Deploy Settings
Settings → Deploy:
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Root Directory**: `/`

### 6. Generate Domain
Settings → Networking → "Generate Domain"

TAMAM! Siteniz hazır: `https://giris-kalite-production.up.railway.app`

## Avantajlar
- 🚀 Anında çalışır, serverless değil
- 💰 Aylık $5 credit (küçük projeler için yeterli)
- 🔄 Her push otomatik deploy
- 📊 Canlı loglar
- 💾 PostgreSQL entegrasyonu

## Not
Railway free tier aylık 500 saat verir (20 gün 7/24 çalışır).
Hobby plan $5/ay unlimited.
