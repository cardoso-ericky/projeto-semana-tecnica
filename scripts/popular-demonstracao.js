const { backup, DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { homedir } = require('node:os');
const path = require('node:path');
const { criarSenhaProtegida } = require('../back-end/senhas');

const SENHA_AUXILIARES = 'assis-demo-2026';
const ANO_LETIVO = 2026;

function argumento(nome) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] : null;
}

function caminhoPadrao() {
  const raiz = process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share');
  return path.join(raiz, 'Assis', 'data', 'assis.sqlite');
}

function dataComDiferenca(dias) {
  const data = new Date();
  data.setUTCHours(12, 0, 0, 0);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function instanteDaData(data, hora = 13) {
  return `${data}T${String(hora).padStart(2, '0')}:00:00.000Z`;
}

function somarDias(data, dias) {
  const valor = new Date(`${data}T12:00:00Z`);
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

function telefone(indice) {
  const numero = String(900000000 + ((indice * 7919) % 99999999)).padStart(9, '0');
  return `(11) ${numero.slice(0, 5)}-${numero.slice(5)}`;
}

function nomePessoa(indice) {
  const primeiros = [
    'Ana', 'André', 'Beatriz', 'Bruno', 'Camila', 'Carlos', 'Clara', 'Daniel', 'Davi', 'Eduarda',
    'Elisa', 'Enzo', 'Felipe', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Isabela', 'João', 'Júlia',
    'Larissa', 'Leonardo', 'Letícia', 'Lucas', 'Luísa', 'Marcos', 'Mariana', 'Mateus', 'Miguel', 'Natália',
    'Otávio', 'Paula', 'Pedro', 'Rafael', 'Renata', 'Samuel', 'Sofia', 'Thiago', 'Valentina', 'Vinícius',
  ];
  const compostos = [
    'Maria', 'José', 'Cristina', 'Henrique', 'Vitória', 'Augusto', 'Carolina', 'Gustavo', 'Aparecida', 'Eduardo',
    'Lorena', 'Antônio', 'Bianca', 'Rodrigo', 'Manuela', 'Caio', 'Priscila', 'Alexandre', 'Giovana', 'Murilo',
    'Cecília', 'Diego', 'Lívia', 'Marcelo', 'Raquel', 'Vitor', 'Alice', 'Fernando', 'Laura', 'Renan',
  ];
  const sobrenomes = [
    'Almeida', 'Alves', 'Andrade', 'Araújo', 'Azevedo', 'Barbosa', 'Barros', 'Batista', 'Cardoso', 'Carvalho',
    'Castro', 'Correia', 'Costa', 'Cunha', 'Dias', 'Duarte', 'Farias', 'Fernandes', 'Ferreira', 'Freitas',
    'Gomes', 'Gonçalves', 'Lima', 'Lopes', 'Machado', 'Martins', 'Melo', 'Mendes', 'Monteiro', 'Moraes',
    'Moreira', 'Moura', 'Nascimento', 'Nogueira', 'Oliveira', 'Pereira', 'Pires', 'Ramos', 'Reis', 'Ribeiro',
    'Rocha', 'Rodrigues', 'Santana', 'Santos', 'Silva', 'Soares', 'Souza', 'Teixeira', 'Vieira', 'Xavier',
  ];
  const primeiro = primeiros[indice % primeiros.length];
  const composto = compostos[Math.floor(indice / primeiros.length) % compostos.length];
  const sobrenome1 = sobrenomes[(indice * 17 + 3) % sobrenomes.length];
  const sobrenome2 = sobrenomes[(indice * 29 + 11) % sobrenomes.length];
  return `${primeiro} ${composto} ${sobrenome1} ${sobrenome2}`;
}

function catalogoDeTitulos() {
  const classicos = [
    ['Dom Casmurro', 'Machado de Assis', 'Literatura brasileira'],
    ['Memórias Póstumas de Brás Cubas', 'Machado de Assis', 'Literatura brasileira'],
    ['O Cortiço', 'Aluísio Azevedo', 'Literatura brasileira'],
    ['Iracema', 'José de Alencar', 'Literatura brasileira'],
    ['Vidas Secas', 'Graciliano Ramos', 'Literatura brasileira'],
    ['Capitães da Areia', 'Jorge Amado', 'Literatura brasileira'],
    ['A Hora da Estrela', 'Clarice Lispector', 'Literatura brasileira'],
    ['Quarto de Despejo', 'Carolina Maria de Jesus', 'Memórias'],
    ['O Auto da Compadecida', 'Ariano Suassuna', 'Teatro'],
    ['Morte e Vida Severina', 'João Cabral de Melo Neto', 'Poesia'],
    ['Grande Sertão: Veredas', 'João Guimarães Rosa', 'Literatura brasileira'],
    ['Macunaíma', 'Mário de Andrade', 'Literatura brasileira'],
    ['Triste Fim de Policarpo Quaresma', 'Lima Barreto', 'Literatura brasileira'],
    ['A Moreninha', 'Joaquim Manuel de Macedo', 'Romance'],
    ['O Alienista', 'Machado de Assis', 'Conto'],
    ['A Escrava Isaura', 'Bernardo Guimarães', 'Romance'],
    ['Senhora', 'José de Alencar', 'Romance'],
    ['Os Sertões', 'Euclides da Cunha', 'História do Brasil'],
    ['Mensagem', 'Fernando Pessoa', 'Poesia'],
    ['Os Lusíadas', 'Luís de Camões', 'Poesia épica'],
    ['O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Literatura juvenil'],
    ['A Revolução dos Bichos', 'George Orwell', 'Ficção'],
    ['1984', 'George Orwell', 'Ficção científica'],
    ['Orgulho e Preconceito', 'Jane Austen', 'Romance'],
    ['Frankenstein', 'Mary Shelley', 'Terror'],
    ['Drácula', 'Bram Stoker', 'Terror'],
    ['A Metamorfose', 'Franz Kafka', 'Ficção'],
    ['O Processo', 'Franz Kafka', 'Ficção'],
    ['Crime e Castigo', 'Fiódor Dostoiévski', 'Romance'],
    ['Odisseia', 'Homero', 'Literatura clássica'],
    ['Ilíada', 'Homero', 'Literatura clássica'],
    ['A Ilha do Tesouro', 'Robert Louis Stevenson', 'Aventura'],
    ['Viagem ao Centro da Terra', 'Júlio Verne', 'Aventura'],
    ['Vinte Mil Léguas Submarinas', 'Júlio Verne', 'Aventura'],
    ['A Volta ao Mundo em Oitenta Dias', 'Júlio Verne', 'Aventura'],
    ['Alice no País das Maravilhas', 'Lewis Carroll', 'Fantasia'],
    ['As Aventuras de Tom Sawyer', 'Mark Twain', 'Aventura'],
    ['Contos de Machado de Assis', 'Machado de Assis', 'Conto'],
    ['Antologia Poética Brasileira', 'Vários autores', 'Poesia'],
    ['Contos Populares do Brasil', 'Vários autores', 'Folclore'],
  ];
  const formas = [
    'Introdução à', 'Caminhos da', 'Panorama da', 'Fundamentos de', 'Descobrindo a',
    'Atlas de', 'Manual de', 'Histórias da', 'Diálogos sobre', 'Oficina de',
    'Leituras de', 'Conexões em', 'Perspectivas da', 'Experimentos de', 'Caderno de',
    'Viagem pela', 'Questões de', 'Práticas de', 'Estudos de', 'Horizontes da',
  ];
  const temas = [
    ['Astronomia', 'Ciências'], ['Biologia', 'Ciências'], ['Ecologia', 'Meio ambiente'], ['Física', 'Ciências'],
    ['Química', 'Ciências'], ['Matemática', 'Matemática'], ['Geometria', 'Matemática'], ['Estatística', 'Matemática'],
    ['História do Brasil', 'História'], ['História Geral', 'História'], ['Geografia Brasileira', 'Geografia'],
    ['Geopolítica', 'Geografia'], ['Filosofia', 'Filosofia'], ['Sociologia', 'Sociologia'], ['Arte Brasileira', 'Arte'],
    ['Música', 'Arte'], ['Literatura', 'Literatura'], ['Língua Portuguesa', 'Língua portuguesa'],
    ['Língua Inglesa', 'Idiomas'], ['Tecnologia', 'Tecnologia'], ['Programação', 'Tecnologia'],
    ['Robótica', 'Tecnologia'], ['Educação Financeira', 'Educação financeira'], ['Saúde e Bem-estar', 'Saúde'],
    ['Cidadania', 'Cidadania'],
  ];
  const editoras = ['Ática', 'Moderna', 'Saraiva', 'FTD', 'Scipione', 'Companhia das Letras', 'Record', 'Rocco'];
  const livros = [...classicos];
  for (let i = 0; livros.length < 500; i += 1) {
    const [tema, genero] = temas[i % temas.length];
    const forma = formas[Math.floor(i / temas.length) % formas.length];
    livros.push([`${forma} ${tema}`, nomePessoa(1500 + (i % 120)).replace(/^(\S+)\s+\S+\s+(\S+).*/, '$1 $2'), genero]);
  }
  return livros.slice(0, 500).map(([titulo, autor, genero], indice) => ({
    titulo, autor, genero, editora: editoras[indice % editoras.length],
    edicao: `${1 + (indice % 6)}ª edição`, ano: 1998 + (indice % 29),
  }));
}

function validarEsquema(banco) {
  const tabelas = new Set(banco.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((item) => item.name));
  for (const tabela of ['usuarios', 'turmas', 'leitores', 'livros', 'exemplares', 'emprestimos', 'eventos_emprestimo']) {
    if (!tabelas.has(tabela)) throw new Error(`Banco incompatível: a tabela ${tabela} não existe.`);
  }
  if (banco.prepare("SELECT id FROM leitores WHERE identificador = 'ALU-DEMO-0001'").get()) {
    throw new Error('A demonstração já foi instalada neste banco. Nenhum dado foi alterado.');
  }
}

function contagens(banco) {
  const nomes = ['usuarios', 'turmas', 'leitores', 'livros', 'exemplares', 'emprestimos', 'eventos_exemplar', 'eventos_emprestimo'];
  return Object.fromEntries(nomes.map((nome) => [nome, Number(banco.prepare(`SELECT COUNT(*) AS total FROM ${nome}`).get().total)]));
}

function inserirDemonstracao(banco) {
  const instante = new Date().toISOString();
  const ids = { usuarios: [], turmas: [], leitores: [], exemplares: [] };

  const inserirUsuario = banco.prepare(`
    INSERT INTO usuarios (nome, usuario, senha_hash, senha_salt, perfil, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, 'auxiliar', 1, ?, ?)
  `);
  const nomesAuxiliares = ['Aline Marques', 'Bruno Nascimento', 'Carla Ribeiro', 'Diego Martins', 'Eliane Souza', 'Fábio Oliveira', 'Giovana Santos', 'Hugo Ferreira'];
  for (let i = 0; i < nomesAuxiliares.length; i += 1) {
    const protegida = criarSenhaProtegida(SENHA_AUXILIARES);
    const resultado = inserirUsuario.run(nomesAuxiliares[i], `demo-auxiliar-${String(i + 1).padStart(2, '0')}`, protegida.hash, protegida.salt, instante, instante);
    ids.usuarios.push(Number(resultado.lastInsertRowid));
  }

  const inserirTurma = banco.prepare(`INSERT INTO turmas (nome, turno, ano_letivo, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, 1, ?, ?)`);
  const buscarTurma = banco.prepare('SELECT id FROM turmas WHERE nome = ? AND turno = ? AND ano_letivo = ?');
  const letrasPorAno = { 1: 'ABCDEFG', 2: 'ABCDEFG', 3: 'ABCDEF' };
  for (const [ano, letras] of Object.entries(letrasPorAno)) {
    for (const letra of letras) {
      for (const turno of ['Manhã', 'Tarde']) {
        const nome = `${ano}º ${letra}`;
        const existente = buscarTurma.get(nome, turno, ANO_LETIVO);
        const id = existente?.id || inserirTurma.run(nome, turno, ANO_LETIVO, instante, instante).lastInsertRowid;
        ids.turmas.push(Number(id));
      }
    }
  }

  const inserirLeitor = banco.prepare(`
    INSERT INTO leitores (tipo, nome, identificador, telefone, turma_id, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (let i = 0; i < 1000; i += 1) {
    const resultado = inserirLeitor.run('aluno', nomePessoa(i), `ALU-DEMO-${String(i + 1).padStart(4, '0')}`, i % 5 ? telefone(i) : null, ids.turmas[Math.floor(i / 25)], instante, instante);
    ids.leitores.push(Number(resultado.lastInsertRowid));
  }
  for (let i = 0; i < 100; i += 1) {
    const resultado = inserirLeitor.run('professor', nomePessoa(1100 + i), `PROF-DEMO-${String(i + 1).padStart(3, '0')}`, telefone(1100 + i), null, instante, instante);
    ids.leitores.push(Number(resultado.lastInsertRowid));
  }
  for (let i = 0; i < 20; i += 1) {
    const resultado = inserirLeitor.run('funcionario', nomePessoa(1300 + i), `FUNC-DEMO-${String(i + 1).padStart(3, '0')}`, telefone(1300 + i), null, instante, instante);
    ids.leitores.push(Number(resultado.lastInsertRowid));
  }

  const inserirLivro = banco.prepare(`
    INSERT INTO livros (titulo, autor, editora, edicao, ano_publicacao, genero, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const inserirExemplar = banco.prepare(`
    INSERT INTO exemplares (livro_id, codigo, estado, criado_em, atualizado_em) VALUES (?, ?, 'normal', ?, ?)
  `);
  const livros = catalogoDeTitulos();
  for (let i = 0; i < livros.length; i += 1) {
    const livro = livros[i];
    const livroId = Number(inserirLivro.run(livro.titulo, livro.autor, livro.editora, livro.edicao, livro.ano, livro.genero, instante, instante).lastInsertRowid);
    const quantidade = i < 150 ? 3 : 2;
    for (let copia = 1; copia <= quantidade; copia += 1) {
      const codigo = `DEMO-${String(i + 1).padStart(4, '0')}-${copia}`;
      ids.exemplares.push(Number(inserirExemplar.run(livroId, codigo, instante, instante).lastInsertRowid));
    }
  }

  const inserirEmprestimo = banco.prepare(`
    INSERT INTO emprestimos
      (leitor_id, exemplar_id, emprestado_por, devolvido_por, data_saida, data_prevista, devolvido_em, status, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const inserirEvento = banco.prepare(`
    INSERT INTO eventos_emprestimo (emprestimo_id, tipo, usuario_id, detalhes, criado_em) VALUES (?, ?, ?, ?, ?)
  `);
  const inserirEventoExemplar = banco.prepare(`
    INSERT INTO eventos_exemplar (exemplar_id, estado_anterior, estado_novo, usuario_id, criado_em) VALUES (?, ?, ?, ?, ?)
  `);

  const registrarEmprestimo = ({ leitorId, exemplarId, operadorId, devolvidoPor = null, saida, prevista, devolvidoEm = null, status }) => {
    const criadoEm = instanteDaData(saida);
    const atualizadoEm = devolvidoEm || criadoEm;
    const resultado = inserirEmprestimo.run(leitorId, exemplarId, operadorId, devolvidoPor, saida, prevista, devolvidoEm, status, criadoEm, atualizadoEm);
    const emprestimoId = Number(resultado.lastInsertRowid);
    inserirEvento.run(emprestimoId, 'criacao', operadorId, JSON.stringify({ dataPrevista: prevista }), criadoEm);
    return emprestimoId;
  };

  // Histórico concluído: dá densidade às telas sem bloquear os exemplares atuais.
  for (let i = 0; i < 1600; i += 1) {
    const diasAtras = 20 + ((i * 11) % 240);
    const saida = dataComDiferenca(-diasAtras);
    const prevista = somarDias(saida, 7);
    const devolucao = somarDias(saida, 2 + (i % 10));
    const devolvidoEm = instanteDaData(devolucao, 15);
    const operadorId = ids.usuarios[i % ids.usuarios.length];
    const devolvidoPor = ids.usuarios[(i + 3) % ids.usuarios.length];
    const emprestimoId = registrarEmprestimo({
      leitorId: ids.leitores[(i * 19) % ids.leitores.length], exemplarId: ids.exemplares[(i * 23) % 900],
      operadorId, devolvidoPor, saida, prevista, devolvidoEm, status: 'devolvido',
    });
    inserirEvento.run(emprestimoId, 'devolucao', devolvidoPor, null, devolvidoEm);
  }

  // Empréstimos ativos: 45 atrasados e 15 com perda ou dano.
  for (let i = 0; i < 160; i += 1) {
    const atrasado = i < 45;
    const saida = dataComDiferenca(atrasado ? -(18 + (i % 32)) : -(i % 7));
    const prevista = somarDias(saida, 7);
    const operadorId = ids.usuarios[i % ids.usuarios.length];
    const exemplarId = ids.exemplares[i];
    const emprestimoId = registrarEmprestimo({
      leitorId: ids.leitores[(i * 7 + 5) % ids.leitores.length], exemplarId, operadorId,
      saida, prevista, status: 'ativo',
    });
    if (i < 15) {
      const estado = i < 8 ? 'perdido' : 'danificado';
      const ocorridoEm = instanteDaData(somarDias(saida, 4), 16);
      banco.prepare('UPDATE exemplares SET estado = ?, atualizado_em = ? WHERE id = ?').run(estado, ocorridoEm, exemplarId);
      inserirEventoExemplar.run(exemplarId, 'normal', estado, operadorId, ocorridoEm);
      inserirEvento.run(emprestimoId, estado, operadorId, null, ocorridoEm);
    }
  }

  // Cancelamentos mostram correções operacionais no histórico.
  for (let i = 0; i < 60; i += 1) {
    const saida = dataComDiferenca(-(35 + i));
    const operadorId = ids.usuarios[(i + 1) % ids.usuarios.length];
    const emprestimoId = registrarEmprestimo({
      leitorId: ids.leitores[(i * 31) % ids.leitores.length], exemplarId: ids.exemplares[300 + i],
      operadorId, saida, prevista: somarDias(saida, 7), status: 'cancelado',
    });
    inserirEvento.run(emprestimoId, 'cancelamento', operadorId, null, instanteDaData(saida, 14));
  }

  // Ocorrências antigas encerradas permanecem no histórico e deixam a unidade bloqueada.
  for (let i = 0; i < 12; i += 1) {
    const exemplarId = ids.exemplares[160 + i];
    const estado = i < 6 ? 'perdido' : 'danificado';
    const saida = dataComDiferenca(-(90 + i));
    const operadorId = ids.usuarios[(i + 2) % ids.usuarios.length];
    const emprestimoId = registrarEmprestimo({
      leitorId: ids.leitores[(i * 43) % ids.leitores.length], exemplarId, operadorId,
      saida, prevista: somarDias(saida, 7), status: 'encerrado_sem_devolucao',
    });
    const ocorridoEm = instanteDaData(somarDias(saida, 15), 10);
    banco.prepare('UPDATE exemplares SET estado = ?, atualizado_em = ? WHERE id = ?').run(estado, ocorridoEm, exemplarId);
    inserirEventoExemplar.run(exemplarId, 'normal', estado, operadorId, ocorridoEm);
    inserirEvento.run(emprestimoId, estado, operadorId, null, ocorridoEm);
    inserirEvento.run(emprestimoId, 'encerramento_ocorrencia', operadorId, JSON.stringify({ justificativa: 'Ocorrência demonstrativa encerrada pela equipe.' }), instanteDaData(somarDias(saida, 25), 11));
  }

  const atualizarEstado = banco.prepare('UPDATE exemplares SET estado = ?, atualizado_em = ? WHERE id = ?');
  for (const exemplarId of ids.exemplares.slice(-20, -8)) atualizarEstado.run('manutencao', instante, exemplarId);
  for (const exemplarId of ids.exemplares.slice(-8)) atualizarEstado.run('arquivado', instante, exemplarId);
}

async function executar() {
  const caminho = path.resolve(argumento('--banco') || caminhoPadrao());
  const banco = new DatabaseSync(caminho);
  banco.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;');
  try {
    validarEsquema(banco);
    const antes = contagens(banco);
    const pastaBanco = path.dirname(caminho);
    const raiz = path.basename(pastaBanco) === 'data' ? path.dirname(pastaBanco) : pastaBanco;
    const pastaBackup = argumento('--backup-em') || path.join(raiz, 'backups');
    mkdirSync(pastaBackup, { recursive: true });
    const instante = new Date().toISOString().replaceAll(':', '-').replace('.', '-');
    const caminhoBackup = path.join(pastaBackup, `pre-demonstracao-${instante}.sqlite`);
    await backup(banco, caminhoBackup);

    banco.exec('BEGIN IMMEDIATE');
    try {
      inserirDemonstracao(banco);
      const integridade = banco.prepare('PRAGMA quick_check').get().quick_check;
      if (integridade !== 'ok') throw new Error(`Falha de integridade: ${integridade}`);
      banco.exec('COMMIT');
    } catch (erro) {
      banco.exec('ROLLBACK');
      throw erro;
    }

    const depois = contagens(banco);
    const painel = banco.prepare(`
      SELECT
        (SELECT COUNT(*) FROM emprestimos WHERE status = 'ativo') AS emprestimosAtivos,
        (SELECT COUNT(*) FROM emprestimos WHERE status = 'ativo' AND data_prevista < ?) AS atrasados,
        (SELECT COUNT(*) FROM exemplares WHERE estado IN ('perdido', 'danificado')) AS perdasOuDanos
    `).get(dataComDiferenca(0));
    process.stdout.write(`${JSON.stringify({ caminho, caminhoBackup, antes, depois, painel, credenciaisAuxiliares: { usuarios: 'demo-auxiliar-01 a demo-auxiliar-08', senha: SENHA_AUXILIARES } }, null, 2)}\n`);
  } finally {
    banco.close();
  }
}

executar().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
