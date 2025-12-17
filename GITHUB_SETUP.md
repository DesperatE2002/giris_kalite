# GitHub ve Vercel Deployment

## 1. GitHub Repository Oluşturma

1. https://github.com/new adresine gidin
2. Repository name: `giris_kalite`
3. **Public** seçin (Vercel free tier için gerekli)
4. **"Add a README file" işaretlemeyin**
5. "Create repository" butonuna tıklayın

## 2. Kodu GitHub'a Push

Repository oluşturduktan sonra, size verilen URL'i kullanın:

```bash
git remote remove origin
git remote add origin https://github.com/KULLANICI_ADINIZ/giris_kalite.git
git push -u origin main
```

## 3. Vercel'e Deploy

### Yöntem 1: Vercel Dashboard (Önerilen)

1. https://vercel.com/dashboard adresine gidin
2. "Add New..." > "Project" seçin
3. GitHub repository'nizi seçin: `giris_kalite`
4. "Import" butonuna tıklayın
5. **Environment Variables** ekleyin:
   - `DATABASE_URL`: `postgresql://neondb_owner:npg_9pajJwNlQCm0@ep-mute-glitter-aghrig57-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - `JWT_SECRET`: `otpa_kalite_gizli_anahtar_2025_degistir`
   - `SESSION_SECRET`: `otpa_session_gizli_2025_degistir`
   - `NODE_ENV`: `production`
6. "Deploy" butonuna tıklayın

### Yöntem 2: Vercel CLI

```bash
vercel --prod
```

## 4. Database Migration (İlk Deploy Sonrası)

Vercel'de Function endpoint oluşturun veya local'den:

```bash
# Production environment variables'ını çek
vercel env pull

# Migration çalıştır
npm run migrate
```

## 5. Domain

Vercel otomatik domain verir:
- `https://giris-kalite.vercel.app`

Custom domain eklemek için:
- Vercel Dashboard > Project > Settings > Domains

## Notlar

✅ `.env` dosyası gitignore'da olduğu için push edilmedi
✅ `database.sqlite` local dosyaları gitignore'da
✅ Production'da sadece PostgreSQL (Neon) kullanılıyor
✅ Her push otomatik deploy olacak
