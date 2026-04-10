import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

import fs from 'fs';
const log = (msg) => { fs.appendFileSync('fix-output.txt', msg + '\n'); console.log(msg); };

async function fix() {
  log('Connecting to database...');
  log('DB URL exists: ' + (!!process.env.DATABASE_URL));
  
  // First check what needs fixing
  const check = await pool.query("SELECT gr.id, gr.material_code, gr.received_quantity, qr.accepted_quantity, qr.status FROM goods_receipt gr JOIN quality_results qr ON gr.id = qr.receipt_id WHERE gr.received_quantity < 0");
  log('Deduction records found: ' + check.rows.length);
  check.rows.forEach(r => log('  ID:' + r.id + ' material:' + r.material_code + ' recv:' + r.received_quantity + ' accepted:' + r.accepted_quantity + ' status:' + r.status));
  
  const sql = "UPDATE quality_results SET accepted_quantity=0, status='eksiltme' WHERE receipt_id IN (SELECT id FROM goods_receipt WHERE received_quantity < 0) AND accepted_quantity < 0";
  const result = await pool.query(sql);
  log('Fixed rows: ' + result.rowCount);
  await pool.end();
  log('Done!');
}

fix().catch(e => { log('ERROR: ' + e.message); pool.end(); });
