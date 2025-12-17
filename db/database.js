import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Test bağlantısı
pool.on('connect', () => {
  console.log('✅ Neon DB bağlantısı başarılı');
});

pool.on('error', (err) => {
  console.error('❌ Veritabanı bağlantı hatası:', err);
});

// Wrapper to convert SQLite-style placeholders (?) to PostgreSQL ($1, $2)
const convertQuery = (text) => {
  let index = 0;
  return text.replace(/\?/g, () => `$${++index}`);
};

const wrappedPool = {
  query: async (text, params = []) => {
    const convertedQuery = convertQuery(text);
    return await pool.query(convertedQuery, params);
  },
  connect: () => pool.connect(),
  end: () => pool.end()
};

export default wrappedPool;
