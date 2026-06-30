import * as mariadb from 'mariadb';
// connettore con il database

const pool = mariadb.createPool({ 
  // carico i valori per il database. se non passati dal docker-compose, metto il default
  host: process.env.DB_HOST || 'groppi_DB',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'CAMPI',
  connectionLimit: 5,
});

async function query(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

export { query };
