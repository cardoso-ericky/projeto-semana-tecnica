const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'biblioteca'
});

connection.query(
  'SELECT * FROM usuarios',
  function(err, results, fields) {
    if (err) throw err;
    console.log(results);
  }
);
