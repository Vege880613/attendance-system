/**
 * SQLite → MySQL 数据迁移脚本（一次性）
 * 读 server/data/attendance.db → 写 MySQL attendance_db，保留自增 ID 与日期格式
 */
const sqlite3 = require('better-sqlite3');
const mysql = require('mysql2/promise');

const SQLITE = '/Users/gaolongfei/Desktop/study/attendance-system/server/data/attendance.db';
const TABLES = ['audit_logs', 'projects', 'holidays', 'users', 'teams', 'attendance_records',
    'overtime_units', 'leave_balances', 'attendance_requests'];

function norm(v) {
  if (v === undefined) return null;
  return v;
}

async function main() {
  const db = sqlite3(SQLITE, { readonly: true });
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: 'root', database: 'attendance_db',
  });

  for (const t of TABLES) {
    const rows = db.prepare(`SELECT * FROM ${t}`).all();
    if (!rows.length) { console.log(`${t}: 0 行，跳过`); continue; }
    const cols = Object.keys(rows[0]);
    const colList = cols.join(',');
    const ph = cols.map(() => '?').join(',');
    const update = cols.map(c => `${c}=VALUES(${c})`).join(',');
    const sql = `INSERT INTO ${t} (${colList}) VALUES ? ON DUPLICATE KEY UPDATE ${update}`;
    // 分批，每批 200 行
    const batchSize = 200;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map(r => cols.map(c => norm(r[c])));
      await conn.query(sql, [values]);
      inserted += batch.length;
    }
    console.log(`${t}: 迁移 ${inserted} 行`);
  }

  await conn.end();
  db.close();
  console.log('\n✅ 迁移完成');
}

main().catch(e => { console.error('迁移失败:', e); process.exit(1); });
