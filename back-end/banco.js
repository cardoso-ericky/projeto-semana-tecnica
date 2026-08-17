const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { criarSenhaProtegida } = require('./senhas');

function agora() {
  return new Date().toISOString();
}

function abrirBanco({ diretorioDados, senhaInicialAdmin, senhaInicialProtegida }) {
  mkdirSync(diretorioDados, { recursive: true });
  const caminho = path.join(diretorioDados, 'assis.sqlite');
  const banco = new DatabaseSync(caminho);
  banco.caminhoAssis = caminho;

  // Essas configurações protegem as relações entre tabelas e permitem que uma
  // leitura aconteça enquanto outra ação está sendo gravada.
  banco.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const integridade = banco.prepare('PRAGMA quick_check').get();
  if (integridade.quick_check !== 'ok') {
    banco.close();
    throw new Error('O banco do Assis não passou na verificação de integridade. Restaure um backup.');
  }
  try {
    banco.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao INTEGER PRIMARY KEY,
      aplicada_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      usuario TEXT NOT NULL COLLATE NOCASE UNIQUE,
      senha_hash TEXT NOT NULL,
      senha_salt TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK (perfil IN ('administrador', 'auxiliar')),
      ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS turmas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL COLLATE NOCASE,
      turno TEXT NOT NULL CHECK (turno IN ('Manhã', 'Tarde', 'Noite', 'Integral')),
      ano_letivo INTEGER NOT NULL CHECK (ano_letivo BETWEEN 2000 AND 2200),
      ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      UNIQUE (nome, turno, ano_letivo)
    );

    CREATE TABLE IF NOT EXISTS leitores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK (tipo IN ('aluno', 'professor', 'funcionario')),
      nome TEXT NOT NULL COLLATE NOCASE,
      identificador TEXT,
      telefone TEXT,
      turma_id INTEGER REFERENCES turmas(id),
      ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      CHECK ((tipo = 'aluno' AND turma_id IS NOT NULL) OR (tipo <> 'aluno' AND turma_id IS NULL))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS leitores_identificador_unico
      ON leitores(tipo, identificador) WHERE identificador IS NOT NULL;

    CREATE TABLE IF NOT EXISTS livros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL COLLATE NOCASE,
      autor TEXT NOT NULL COLLATE NOCASE,
      editora TEXT,
      edicao TEXT,
      ano_publicacao INTEGER,
      genero TEXT,
      ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exemplares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      livro_id INTEGER NOT NULL REFERENCES livros(id),
      codigo TEXT COLLATE NOCASE,
      estado TEXT NOT NULL DEFAULT 'normal'
        CHECK (estado IN ('normal', 'perdido', 'danificado', 'manutencao', 'arquivado')),
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS exemplares_codigo_unico
      ON exemplares(codigo) WHERE codigo IS NOT NULL;

    CREATE TABLE IF NOT EXISTS emprestimos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leitor_id INTEGER NOT NULL REFERENCES leitores(id),
      exemplar_id INTEGER NOT NULL REFERENCES exemplares(id),
      emprestado_por INTEGER NOT NULL REFERENCES usuarios(id),
      devolvido_por INTEGER REFERENCES usuarios(id),
      data_saida TEXT NOT NULL,
      data_prevista TEXT NOT NULL,
      devolvido_em TEXT,
      status TEXT NOT NULL CHECK (status IN ('ativo', 'devolvido', 'cancelado', 'encerrado_sem_devolucao')),
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS emprestimo_ativo_por_exemplar
      ON emprestimos(exemplar_id) WHERE status = 'ativo';

    CREATE TABLE IF NOT EXISTS eventos_exemplar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exemplar_id INTEGER NOT NULL REFERENCES exemplares(id),
      estado_anterior TEXT NOT NULL,
      estado_novo TEXT NOT NULL,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS eventos_emprestimo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emprestimo_id INTEGER NOT NULL REFERENCES emprestimos(id),
      tipo TEXT NOT NULL,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      detalhes TEXT,
      criado_em TEXT NOT NULL
    );

    INSERT OR IGNORE INTO schema_migrations (versao, aplicada_em)
      VALUES (1, datetime('now'));
    COMMIT;`);
  } catch (erro) {
    // Se uma tabela falhar no meio da criação, nenhuma parte incompleta fica valendo.
    try { banco.exec('ROLLBACK'); } catch { /* A falha pode ter acontecido antes da transação abrir. */ }
    banco.close();
    throw erro;
  }

  const existeAdmin = banco
    .prepare("SELECT id FROM usuarios WHERE perfil = 'administrador' LIMIT 1")
    .get();

  if (!existeAdmin) {
    const protegida = senhaInicialProtegida || criarSenhaProtegida(senhaInicialAdmin);
    const data = agora();
    banco.exec('BEGIN IMMEDIATE');
    try {
      banco.prepare(`
        INSERT INTO usuarios
          (nome, usuario, senha_hash, senha_salt, perfil, ativo, criado_em, atualizado_em)
        VALUES (?, ?, ?, ?, 'administrador', 1, ?, ?)
      `).run('Biblioteca Regente', 'biblioteca-regente', protegida.hash, protegida.salt, data, data);
      banco.exec('COMMIT');
    } catch (erro) {
      banco.exec('ROLLBACK'); banco.close(); throw erro;
    }
  }

  return banco;
}

module.exports = { abrirBanco, agora };
