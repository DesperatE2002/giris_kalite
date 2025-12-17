import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '..', 'database.sqlite'));
db.pragma('journal_mode = WAL');

// Only log if SQLite is active
if (process.env.USE_SQLITE === 'true') {
  console.log('✅ SQLite veritabanına bağlandı');
}

// Convert PostgreSQL placeholders ($1, $2) to SQLite (?, ?)
const convertQuery = (text) => {
  return text.replace(/\$(\d+)/g, '?');
};

// SQLite wrapper to make it compatible with pg
const pool = {
  query: async (text, params = []) => {
    try {
      let query = convertQuery(text);
      
      // Handle RETURNING clause for SQLite
      const hasReturning = /RETURNING\s+\*/i.test(query);
      if (hasReturning) {
        query = query.replace(/RETURNING\s+\*/i, '');
      }
      
      const isSelect = query.trim().toUpperCase().startsWith('SELECT') || 
                      query.trim().toUpperCase().startsWith('WITH');
      const isInsert = query.trim().toUpperCase().startsWith('INSERT');
      const isUpdate = query.trim().toUpperCase().startsWith('UPDATE');
      const isDelete = query.trim().toUpperCase().startsWith('DELETE');
      
      if (isSelect) {
        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else if (isInsert || isUpdate || isDelete) {
        const stmt = db.prepare(query);
        const info = stmt.run(...params);
        
        if (hasReturning && isInsert) {
          // Get the inserted row
          const lastId = info.lastInsertRowid;
          // Extract table name from query
          const tableMatch = query.match(/INTO\s+(\w+)/i);
          if (tableMatch && lastId) {
            const tableName = tableMatch[1];
            const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
            const rows = [selectStmt.get(lastId)];
            return { rows, rowCount: 1 };
          }
        }
        
        return { 
          rows: info.changes > 0 && info.lastInsertRowid ? [{ id: info.lastInsertRowid }] : [],
          rowCount: info.changes 
        };
      } else {
        const stmt = db.prepare(query);
        stmt.run(...params);
        return { rows: [], rowCount: 0 };
      }
    } catch (error) {
      console.error('Query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  },
  
  connect: async () => ({
    query: pool.query,
    release: () => {},
  }),
  
  on: () => {},
  end: () => db.close()
};

export default pool;
