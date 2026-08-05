const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'biblioteca'
});

function adicionarLivro(idLivro, titulo, edicao, editora, unidades, genero, ano){
    const comando = `INSERT INTO livro (idLivro, titulo, edicao, editora, unidades, genero, ano) VALUES (?, ?, ?, ?, ?, ?, ?);`;
    const valores = [idLivro, titulo, edicao, editora, unidades, genero, ano];    
    connection.query(comando, valores, function(err, results, fields) {
        if (err) throw err;
        console.log("Livro adicionado com sucesso:", results);
    });
}

function consultarLivros(){
  connection.query(`SELECT * FROM livro;`, 
    function(err, results, fields) {
        if (err) throw err;
        console.log("Lista de Livros:", results);
    });
}

function adicionarLeitor(idLeitor, nome, telefone){
    const comando = `INSERT INTO Leitor (idLeitor, nome, telefone) VALUES (?, ?, ?);`;
    const valores = [idLeitor, nome, telefone];    
    connection.query(comando, valores, function(err, results, fields) {
        if (err) throw err;
        console.log("Leitor adicionado com sucesso:", results);
    });
}

function consultarLeitores(){
  connection.query(`SELECT * FROM Leitor;`, 
    function(err, results, fields) {
        if (err) throw err;
        console.log("Lista de Leitores:", results);
    });
}

function adicionarAluno(idAluno, nome, turma, turno, fk_Leitor_idLeitor){
    const comando = `INSERT INTO aluno (idAluno, nome, turma, turno, fk_Leitor_idLeitor) VALUES (?, ?, ?, ?, ?);`;
    const valores = [idAluno, nome, turma, turno, fk_Leitor_idLeitor];    
    connection.query(comando, valores, function(err, results, fields) {
        if (err) throw err;
        console.log("Aluno adicionado com sucesso:", results);
    });
}

function consultarAlunos(){
  const comando = `
    SELECT a.idAluno, a.nome, a.turma, a.turno, l.telefone 
    FROM aluno a
    INNER JOIN Leitor l ON a.fk_Leitor_idLeitor = l.idLeitor;
  `;
  connection.query(comando, function(err, results, fields) {
        if (err) throw err;
        console.log("Lista de Alunos:", results);
    });
}

function adicionarProfessor(idProfessor, nome, fk_Leitor_idLeitor){
  // O fk_Leitor_idLeitor precisa já estar cadastrado na tabela Leitor
  const comando = `INSERT INTO professor (idProfessor, nome, fk_Leitor_idLeitor) VALUES (?, ?, ?);`;
  const valores = [idProfessor, nome, fk_Leitor_idLeitor];    
  
  connection.query(comando, valores, function(err, results, fields) {
      if (err) throw err;
      console.log("Professor adicionado com sucesso:", results);
  });
}

function consultarProfessores(){
connection.query(`SELECT * FROM professor;`, 
  function(err, results, fields) {
      if (err) throw err;
      console.log("Lista de Professores:", results);
  });
}

function adicionarFuncionario(nome, idfuncionario, fk_Leitor_idLeitor){
  const comando = `INSERT INTO funcionario (nome, idfuncionario, fk_Leitor_idLeitor) VALUES (?, ?, ?);`;
  const valores = [nome, idfuncionario, fk_Leitor_idLeitor];    
  
  connection.query(comando, valores, function(err, results, fields) {
      if (err) throw err;
      console.log("Funcionário adicionado com sucesso:", results);
  });
}

function consultarFuncionarios(){
connection.query(`SELECT * FROM funcionario;`, 
  function(err, results, fields) {
      if (err) throw err;
      console.log("Lista de Funcionários:", results);
  });
}

function adicionarEmprestimo(datainicial, datadevolucao, fk_Leitor_idLeitor){
    // Formato da data deve ser 'YYYY-MM-DD'
    const comando = `INSERT INTO Empréstimo (datainicial, datadevolucao, fk_Leitor_idLeitor) VALUES (?, ?, ?);`;
    const valores = [datainicial, datadevolucao, fk_Leitor_idLeitor];    
    connection.query(comando, valores, function(err, results, fields) {
        if (err) throw err;
        console.log("Empréstimo registrado com sucesso:", results);
    });
}

function consultarEmprestimos(){
  connection.query(`SELECT * FROM Empréstimo;`, 
    function(err, results, fields) {
        if (err) throw err;
        console.log("Lista de Empréstimos:", results);
    });
}

// ÁREA DE TESTES

// 1. Adicionando um livro
adicionarLivro(1, 'Dom Casmurro', '1a', 'Editora X', 5, 'Romance', 1899);
// 2. Adicionando um leitor (Necessário antes de adicionar o aluno)
adicionarLeitor(100, 'João Silva', '42999999999');

// 3. Adicionando um aluno (Vinculado ao leitor 100)
adicionarAluno(10, 'João Silva', '3A', 'MANHÃ', 100);

// 4. Registrando um empréstimo para o leitor 100
adicionarEmprestimo('2023-10-01', '2023-10-15', 100);

// 5. Consultando tudo
consultarLivros();
consultarAlunos();
consultarEmprestimos();
