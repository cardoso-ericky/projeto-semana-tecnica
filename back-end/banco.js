const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'biblioteca'
});

// connection.query(
//   'SELECT * FROM livro',
//   function(err, results, fields) {
//     if (err) throw err;
//     console.log(results);
//   }
// );

function teste(){
  connection.query(`SELECT * FROM Empréstimo`, 
    function(err, results, fields) {
        if (err) throw err;
        console.log(results);
      });
}

// teste();

function adicionarLivro(idLivro, titulo, edicao, editora, unidades, genero, ano){
    const comando = `INSERT INTO livro (idLivro, titulo, edicao, editora, unidades, genero, ano) VALUES (?, ?, ?, ?, ?, ?, ?);`;
    const valores = [idLivro, titulo, edicao, editora, unidades, genero, ano];    
    connection.query(comando, valores, function(err, results, fields) {
        if (err) throw err;
        console.log(results);
      });
}

function consultarLivros(){
  connection.query(`SELECT * FROM livro;`, 
    function(err, results, fields) {
        if (err) throw err;
        console.log(results);
      });
}

// adicionarLivro(4, 'Memórias Postumas de Brás Cubas', '23', 'Marcelo', 12, 'Literatura Brasileira', 2003);
// consultarLivros();

