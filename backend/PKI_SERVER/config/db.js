const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,         // 🟢 Fixed evn -> env
    user: process.env.DB_USER,         // 🟢 Fixed evn -> env
    password: process.env.DB_PASSWORD, // 🟢 Fixed evn -> env
    database: process.env.DB_NAME,     // 🟢 Fixed evn -> env
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;