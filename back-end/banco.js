const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(express.json()); 
app.use(cors());         

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'biblioteca'
});

app.post('/leitores', async (req, res) => {
  const { idLeitor, nome, telefone } = req.body;
  try {
    await pool.query('INSERT INTO Leitor (idLeitor, nome, telefone) VALUES (?, ?, ?)', 
    [idLeitor, nome, telefone]);
    res.status(201).json({ mensagem: 'Leitor cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar leitor', detalhe: err.message });
  }
});

app.get('/leitores', async (req, res) => {
  try {
    const [leitores] = await pool.query('SELECT * FROM Leitor');
    res.status(200).json(leitores);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar leitores' });
  }
});

app.post('/alunos', async (req, res) => {
  const { idAluno, nome, turma, turno, fk_Leitor_idLeitor } = req.body;
  try {
    await pool.query('INSERT INTO aluno (idAluno, nome, turma, turno, fk_Leitor_idLeitor) VALUES (?, ?, ?, ?, ?)', 
    [idAluno, nome, turma, turno, fk_Leitor_idLeitor]);
    res.status(201).json({ mensagem: 'Aluno cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar aluno', detalhe: err.message });
  }
});

app.get('/alunos', async (req, res) => {
  try {
    const [alunos] = await pool.query('SELECT * FROM aluno');
    res.status(200).json(alunos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar alunos' });
  }
});

app.post('/professores', async (req, res) => {
  const { idProfessor, nome, fk_Leitor_idLeitor } = req.body;
  try {
    await pool.query('INSERT INTO professor (idProfessor, nome, fk_Leitor_idLeitor) VALUES (?, ?, ?)', 
    [idProfessor, nome, fk_Leitor_idLeitor]);
    res.status(201).json({ mensagem: 'Professor cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar professor', detalhe: err.message });
  }
});

app.get('/professores', async (req, res) => {
  try {
    const [professores] = await pool.query('SELECT * FROM professor');
    res.status(200).json(professores);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar professores' });
  }
});

app.post('/funcionarios', async (req, res) => {
  const { nome, idfuncionario, fk_Leitor_idLeitor } = req.body;
  try {
    await pool.query('INSERT INTO funcionario (nome, idfuncionario, fk_Leitor_idLeitor) VALUES (?, ?, ?)', 
    [nome, idfuncionario, fk_Leitor_idLeitor]);
    res.status(201).json({ mensagem: 'Funcionário cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar funcionário', detalhe: err.message });
  }
});

app.get('/funcionarios', async (req, res) => {
  try {
    const [funcionarios] = await pool.query('SELECT * FROM funcionario');
    res.status(200).json(funcionarios);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar funcionários' });
  }
});


app.post('/livros', async (req, res) => {
  const { idLivro, titulo, edicao, editora, unidades, genero, ano } = req.body;
  try {
    await pool.query('INSERT INTO livro (idLivro, titulo, edicao, editora, unidades, genero, ano) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [idLivro, titulo, edicao, editora, unidades, genero, ano]);
    res.status(201).json({ mensagem: 'Livro cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar livro', detalhe: err.message });
  }
});

app.get('/livros', async (req, res) => {
  try {
    const [livros] = await pool.query('SELECT * FROM livro');
    res.status(200).json(livros);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar livros' });
  }
});

app.post('/exemplares', async (req, res) => {
  const { estado, fk_livro_idLivro } = req.body;
  try {
    await pool.query('INSERT INTO Exemplar (estado, fk_livro_idLivro) VALUES (?, ?)', 
    [estado, fk_livro_idLivro]);
    res.status(201).json({ mensagem: 'Exemplar registrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar exemplar', detalhe: err.message });
  }
});

app.get('/exemplares', async (req, res) => {
  try {
    const [exemplares] = await pool.query('SELECT * FROM Exemplar');
    res.status(200).json(exemplares);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar exemplares' });
  }
});


app.post('/emprestimos', async (req, res) => {
  const { datainicial, datadevolucao, fk_Leitor_idLeitor } = req.body;
  try {
    await pool.query('INSERT INTO Empréstimo (datainicial, datadevolucao, fk_Leitor_idLeitor) VALUES (?, ?, ?)', 
    [datainicial, datadevolucao, fk_Leitor_idLeitor]);
    res.status(201).json({ mensagem: 'Empréstimo registrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar empréstimo', detalhe: err.message });
  }
});

app.get('/emprestimos', async (req, res) => {
  try {
    const [emprestimos] = await pool.query('SELECT * FROM Empréstimo');
    res.status(200).json(emprestimos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar empréstimos' });
  }
});


app.listen(3000, () => {
  console.log('Servidor da Biblioteca rodando em http://localhost:3000');
});