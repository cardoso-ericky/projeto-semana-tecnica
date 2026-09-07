const TURNOS = ['Manhã', 'Tarde', 'Noite', 'Integral'];
const TIPOS_LEITOR = ['aluno', 'professor', 'funcionario'];

function ehDuplicidade(erro) {
  // O SQLite informa alguns tipos de conflito pelo número, não pelo nome do erro.
  // Centralizar essa leitura evita espalhar detalhes técnicos pelas rotas.
  return erro.errcode === 2067 || erro.message?.includes('UNIQUE constraint failed');
}

function vazioParaNulo(valor) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function idDoCaminho(caminho, raiz) {
  const encontrado = caminho.match(new RegExp(`^/api/${raiz}/(\\d+)$`));
  return encontrado ? Number(encontrado[1]) : null;
}

function turmaPublica(linha) {
  return {
    id: linha.id, nome: linha.nome, turno: linha.turno, anoLetivo: linha.ano_letivo,
    ativo: Boolean(linha.ativo), criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function leitorPublico(linha) {
  return {
    id: linha.id, tipo: linha.tipo, nome: linha.nome,
    identificador: linha.identificador, telefone: linha.telefone,
    ativo: Boolean(linha.ativo), criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
    turma: linha.turma_id ? {
      id: linha.turma_id, nome: linha.turma_nome, turno: linha.turma_turno,
      anoLetivo: linha.turma_ano_letivo,
    } : null,
  };
}

function exemplarPublico(linha) {
  return {
    id: linha.id, livroId: linha.livro_id, codigo: linha.codigo, estado: linha.estado,
    disponivel: linha.disponivel === undefined
      ? linha.estado === 'normal'
      : Boolean(linha.disponivel),
    criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function carregarLivro(banco, id) {
  const linha = banco.prepare(`
    SELECT l.*,
      COUNT(e.id) AS quantidade_total,
      COUNT(CASE WHEN e.estado = 'normal' AND a.id IS NULL THEN 1 END) AS quantidade_disponivel,
      COUNT(CASE WHEN a.id IS NOT NULL THEN 1 END) AS quantidade_emprestada
    FROM livros l
    LEFT JOIN exemplares e ON e.livro_id = l.id AND e.estado <> 'arquivado'
    LEFT JOIN emprestimos a ON a.exemplar_id = e.id AND a.status = 'ativo'
    WHERE l.id = ? GROUP BY l.id
  `).get(id);
  if (!linha) return null;
  const exemplares = banco.prepare(`
    SELECT e.*, CASE WHEN e.estado = 'normal' AND a.id IS NULL THEN 1 ELSE 0 END AS disponivel
    FROM exemplares e
    LEFT JOIN emprestimos a ON a.exemplar_id = e.id AND a.status = 'ativo'
    WHERE e.livro_id = ? ORDER BY e.id
  `).all(id).map(exemplarPublico);
  return {
    id: linha.id, titulo: linha.titulo, autor: linha.autor, editora: linha.editora,
    edicao: linha.edicao, anoPublicacao: linha.ano_publicacao, genero: linha.genero,
    ativo: Boolean(linha.ativo), criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
    quantidadeTotal: linha.quantidade_total, quantidadeDisponivel: linha.quantidade_disponivel,
    quantidadeEmprestada: linha.quantidade_emprestada, exemplares,
  };
}

function camposTurma(corpo) {
  const erros = {};
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  if (!nome) erros.nome = 'Informe o nome da turma.';
  if (!TURNOS.includes(corpo.turno)) erros.turno = 'Escolha Manhã, Tarde, Noite ou Integral.';
  const anoLetivo = Number(corpo.anoLetivo);
  if (!Number.isInteger(anoLetivo) || anoLetivo < 2000 || anoLetivo > 2200) {
    erros.anoLetivo = 'Informe um ano letivo válido.';
  }
  return { erros, dados: { nome, turno: corpo.turno, anoLetivo } };
}

function camposLeitor(corpo, banco) {
  const erros = {};
  const tipo = corpo.tipo;
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  if (!TIPOS_LEITOR.includes(tipo)) erros.tipo = 'Escolha um tipo de leitor.';
  if (!nome) erros.nome = 'Informe o nome completo.';
  const turmaId = tipo === 'aluno' ? Number(corpo.turmaId) : null;
  if (tipo === 'aluno') {
    const turma = banco.prepare('SELECT id FROM turmas WHERE id = ? AND ativo = 1').get(turmaId);
    if (!turma) erros.turmaId = 'Escolha uma turma ativa.';
  }
  return {
    erros,
    dados: { tipo, nome, identificador: vazioParaNulo(corpo.identificador), telefone: vazioParaNulo(corpo.telefone), turmaId },
  };
}

function consultaLeitor(banco, sufixo = '') {
  return banco.prepare(`
    SELECT r.*, t.nome AS turma_nome, t.turno AS turma_turno, t.ano_letivo AS turma_ano_letivo
    FROM leitores r LEFT JOIN turmas t ON t.id = r.turma_id ${sufixo}
  `);
}

async function tratarCadastros(contexto) {
  const { requisicao, resposta, url, banco, usuario, lerJson, enviarJson, falha, agora } = contexto;
  const caminho = url.pathname;

  if (caminho === '/api/turmas' && requisicao.method === 'GET') {
    const turmas = banco.prepare('SELECT * FROM turmas ORDER BY ano_letivo DESC, nome').all().map(turmaPublica);
    enviarJson(resposta, 200, { turmas }); return true;
  }
  if (caminho === '/api/turmas' && requisicao.method === 'POST') {
    const { erros, dados } = camposTurma(await lerJson(requisicao));
    if (Object.keys(erros).length) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Revise os campos destacados.', erros); return true; }
    const data = agora();
    try {
      const resultado = banco.prepare('INSERT INTO turmas (nome, turno, ano_letivo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)')
        .run(dados.nome, dados.turno, dados.anoLetivo, data, data);
      enviarJson(resposta, 201, { turma: turmaPublica(banco.prepare('SELECT * FROM turmas WHERE id = ?').get(resultado.lastInsertRowid)) });
    } catch (erro) {
      if (ehDuplicidade(erro)) falha(resposta, 409, 'TURMA_DUPLICADA', 'Essa turma já foi cadastrada.');
      else throw erro;
    }
    return true;
  }

  const turmaId = idDoCaminho(caminho, 'turmas');
  if (turmaId && requisicao.method === 'PUT') {
    const corpo = await lerJson(requisicao);
    const { erros, dados } = camposTurma(corpo);
    if (Object.keys(erros).length) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Revise os campos destacados.', erros); return true; }
    try {
      const resultado = banco.prepare('UPDATE turmas SET nome = ?, turno = ?, ano_letivo = ?, ativo = ?, atualizado_em = ? WHERE id = ?')
        .run(dados.nome, dados.turno, dados.anoLetivo, corpo.ativo === false ? 0 : 1, agora(), turmaId);
      if (!resultado.changes) falha(resposta, 404, 'TURMA_NAO_ENCONTRADA', 'Turma não encontrada.');
      else enviarJson(resposta, 200, { turma: turmaPublica(banco.prepare('SELECT * FROM turmas WHERE id = ?').get(turmaId)) });
    } catch (erro) {
      if (ehDuplicidade(erro)) falha(resposta, 409, 'TURMA_DUPLICADA', 'Essa turma já foi cadastrada.');
      else throw erro;
    }
    return true;
  }
  if (turmaId && requisicao.method === 'DELETE') {
    const vinculada = banco.prepare('SELECT id FROM leitores WHERE turma_id = ? LIMIT 1').get(turmaId);
    if (vinculada) falha(resposta, 409, 'TURMA_EM_USO', 'Essa turma possui alunos e deve ser arquivada, não excluída.');
    else {
      const resultado = banco.prepare('DELETE FROM turmas WHERE id = ?').run(turmaId);
      if (!resultado.changes) falha(resposta, 404, 'TURMA_NAO_ENCONTRADA', 'Turma não encontrada.');
      else resposta.writeHead(204).end();
    }
    return true;
  }

  if (caminho === '/api/leitores' && requisicao.method === 'GET') {
    const busca = `%${url.searchParams.get('busca') || ''}%`;
    const tipo = url.searchParams.get('tipo') || '';
    const turma = Number(url.searchParams.get('turmaId')) || 0;
    const turno = url.searchParams.get('turno') || '';
    const anoLetivo = Number(url.searchParams.get('anoLetivo')) || 0;
    const somenteAtivos = url.searchParams.get('arquivados') !== '1';
    const leitores = consultaLeitor(banco, `
      WHERE (r.nome LIKE ? OR COALESCE(r.identificador, '') LIKE ?)
        AND (? = '' OR r.tipo = ?) AND (? = 0 OR r.turma_id = ?)
        AND (? = '' OR t.turno = ?) AND (? = 0 OR t.ano_letivo = ?)
        AND (? = 0 OR r.ativo = 1) ORDER BY r.nome
    `).all(busca, busca, tipo, tipo, turma, turma, turno, turno, anoLetivo, anoLetivo, somenteAtivos ? 1 : 0).map(leitorPublico);
    enviarJson(resposta, 200, { leitores }); return true;
  }
  if (caminho === '/api/leitores' && requisicao.method === 'POST') {
    const { erros, dados } = camposLeitor(await lerJson(requisicao), banco);
    if (Object.keys(erros).length) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Revise os campos destacados.', erros); return true; }
    const data = agora();
    try {
      const resultado = banco.prepare(`
        INSERT INTO leitores (tipo, nome, identificador, telefone, turma_id, criado_em, atualizado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(dados.tipo, dados.nome, dados.identificador, dados.telefone, dados.turmaId, data, data);
      enviarJson(resposta, 201, { leitor: leitorPublico(consultaLeitor(banco, 'WHERE r.id = ?').get(resultado.lastInsertRowid)) });
    } catch (erro) {
      if (ehDuplicidade(erro)) falha(resposta, 409, 'IDENTIFICADOR_DUPLICADO', 'Esse identificador já pertence a outro leitor do mesmo tipo.');
      else throw erro;
    }
    return true;
  }

  const leitorId = idDoCaminho(caminho, 'leitores');
  if (leitorId && requisicao.method === 'GET') {
    const leitor = consultaLeitor(banco, 'WHERE r.id = ?').get(leitorId);
    if (!leitor) falha(resposta, 404, 'LEITOR_NAO_ENCONTRADO', 'Leitor não encontrado.');
    else enviarJson(resposta, 200, { leitor: leitorPublico(leitor) });
    return true;
  }
  if (leitorId && requisicao.method === 'PUT') {
    const atual = banco.prepare('SELECT * FROM leitores WHERE id = ?').get(leitorId);
    if (!atual) { falha(resposta, 404, 'LEITOR_NAO_ENCONTRADO', 'Leitor não encontrado.'); return true; }
    const corpo = await lerJson(requisicao);
    if (corpo.tipo !== atual.tipo) { falha(resposta, 409, 'TIPO_IMUTAVEL', 'O tipo do leitor não pode ser alterado. Arquive este cadastro e crie outro.'); return true; }
    const { erros, dados } = camposLeitor(corpo, banco);
    if (Object.keys(erros).length) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Revise os campos destacados.', erros); return true; }
    const ativo = corpo.ativo === false ? 0 : 1;
    if (!ativo && banco.prepare("SELECT id FROM emprestimos WHERE leitor_id = ? AND status = 'ativo'").get(leitorId)) {
      falha(resposta, 409, 'LEITOR_COM_EMPRESTIMO', 'Devolva ou corrija o empréstimo ativo antes de arquivar este leitor.'); return true;
    }
    try {
      const resultado = banco.prepare(`
        UPDATE leitores SET nome = ?, identificador = ?, telefone = ?, turma_id = ?, ativo = ?, atualizado_em = ? WHERE id = ?
      `).run(dados.nome, dados.identificador, dados.telefone, dados.turmaId, ativo, agora(), leitorId);
      if (!resultado.changes) falha(resposta, 404, 'LEITOR_NAO_ENCONTRADO', 'Leitor não encontrado.');
      else enviarJson(resposta, 200, { leitor: leitorPublico(consultaLeitor(banco, 'WHERE r.id = ?').get(leitorId)) });
    } catch (erro) {
      if (ehDuplicidade(erro)) falha(resposta, 409, 'IDENTIFICADOR_DUPLICADO', 'Esse identificador já pertence a outro leitor do mesmo tipo.');
      else throw erro;
    }
    return true;
  }
  if (leitorId && requisicao.method === 'DELETE') {
    const historico = banco.prepare('SELECT id FROM emprestimos WHERE leitor_id = ? LIMIT 1').get(leitorId);
    if (historico) falha(resposta, 409, 'LEITOR_COM_HISTORICO', 'Esse leitor possui histórico e deve ser arquivado, não excluído.');
    else {
      const resultado = banco.prepare('DELETE FROM leitores WHERE id = ?').run(leitorId);
      if (!resultado.changes) falha(resposta, 404, 'LEITOR_NAO_ENCONTRADO', 'Leitor não encontrado.');
      else resposta.writeHead(204).end();
    }
    return true;
  }

  if (caminho === '/api/livros/disponiveis' && requisicao.method === 'GET') {
    const busca = `%${url.searchParams.get('busca') || ''}%`;
    const ids = banco.prepare(`
      SELECT DISTINCT l.id FROM livros l JOIN exemplares e ON e.livro_id = l.id
      LEFT JOIN emprestimos a ON a.exemplar_id = e.id AND a.status = 'ativo'
      WHERE l.ativo = 1 AND e.estado = 'normal' AND a.id IS NULL
        AND (l.titulo LIKE ? OR l.autor LIKE ? OR COALESCE(e.codigo, '') LIKE ?)
      ORDER BY l.titulo
    `).all(busca, busca, busca).map((linha) => linha.id);
    enviarJson(resposta, 200, { livros: ids.map((id) => carregarLivro(banco, id)) }); return true;
  }

  if (caminho === '/api/livros' && requisicao.method === 'GET') {
    const busca = `%${url.searchParams.get('busca') || ''}%`;
    const ids = banco.prepare(`
      SELECT DISTINCT l.id FROM livros l LEFT JOIN exemplares e ON e.livro_id = l.id
      WHERE l.titulo LIKE ? OR l.autor LIKE ? OR COALESCE(e.codigo, '') LIKE ? ORDER BY l.titulo
    `).all(busca, busca, busca).map((linha) => linha.id);
    enviarJson(resposta, 200, { livros: ids.map((id) => carregarLivro(banco, id)) }); return true;
  }

  const adicionarExemplar = caminho.match(/^\/api\/livros\/(\d+)\/exemplares$/);
  if (adicionarExemplar && requisicao.method === 'POST') {
    const livro = banco.prepare('SELECT id FROM livros WHERE id = ? AND ativo = 1').get(Number(adicionarExemplar[1]));
    if (!livro) { falha(resposta, 404, 'LIVRO_NAO_ENCONTRADO', 'Livro não encontrado ou arquivado.'); return true; }
    const corpo = await lerJson(requisicao);
    const codigo = vazioParaNulo(corpo.codigo);
    const data = agora();
    try {
      const resultado = banco.prepare('INSERT INTO exemplares (livro_id, codigo, criado_em, atualizado_em) VALUES (?, ?, ?, ?)')
        .run(livro.id, codigo, data, data);
      enviarJson(resposta, 201, { exemplar: exemplarPublico(banco.prepare('SELECT * FROM exemplares WHERE id = ?').get(resultado.lastInsertRowid)) });
    } catch (erro) {
      if (ehDuplicidade(erro)) falha(resposta, 409, 'CODIGO_DUPLICADO', 'Esse código de exemplar já está em uso.');
      else throw erro;
    }
    return true;
  }
  if (caminho === '/api/livros' && requisicao.method === 'POST') {
    const corpo = await lerJson(requisicao);
    const titulo = typeof corpo.titulo === 'string' ? corpo.titulo.trim() : '';
    const autor = typeof corpo.autor === 'string' ? corpo.autor.trim() : '';
    const erros = {};
    if (!titulo) erros.titulo = 'Informe o título.';
    if (!autor) erros.autor = 'Informe o autor.';
    const codigos = Array.isArray(corpo.codigosExemplares) && corpo.codigosExemplares.length
      ? corpo.codigosExemplares.map(vazioParaNulo) : [null];
    const preenchidos = codigos.filter(Boolean).map((codigo) => codigo.toLocaleLowerCase('pt-BR'));
    if (new Set(preenchidos).size !== preenchidos.length) erros.codigosExemplares = 'Os códigos não podem se repetir.';
    if (Object.keys(erros).length) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Revise os campos destacados.', erros); return true; }
    const data = agora();
    banco.exec('BEGIN IMMEDIATE');
    try {
      const resultado = banco.prepare(`
        INSERT INTO livros (titulo, autor, editora, edicao, ano_publicacao, genero, criado_em, atualizado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(titulo, autor, vazioParaNulo(corpo.editora), vazioParaNulo(corpo.edicao), corpo.anoPublicacao || null, vazioParaNulo(corpo.genero), data, data);
      const inserir = banco.prepare('INSERT INTO exemplares (livro_id, codigo, criado_em, atualizado_em) VALUES (?, ?, ?, ?)');
      for (const codigo of codigos) inserir.run(resultado.lastInsertRowid, codigo, data, data);
      banco.exec('COMMIT');
      enviarJson(resposta, 201, { livro: carregarLivro(banco, Number(resultado.lastInsertRowid)) });
    } catch (erro) {
      banco.exec('ROLLBACK');
      if (ehDuplicidade(erro)) falha(resposta, 409, 'CODIGO_DUPLICADO', 'Um código de exemplar informado já está em uso.');
      else throw erro;
    }
    return true;
  }

  const livroId = idDoCaminho(caminho, 'livros');
  if (livroId && requisicao.method === 'GET') {
    const livro = carregarLivro(banco, livroId);
    if (!livro) falha(resposta, 404, 'LIVRO_NAO_ENCONTRADO', 'Livro não encontrado.');
    else enviarJson(resposta, 200, { livro });
    return true;
  }
  if (livroId && requisicao.method === 'PUT') {
    const corpo = await lerJson(requisicao);
    const titulo = typeof corpo.titulo === 'string' ? corpo.titulo.trim() : '';
    const autor = typeof corpo.autor === 'string' ? corpo.autor.trim() : '';
    if (!titulo || !autor) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Título e autor são obrigatórios.', { titulo: !titulo ? 'Informe o título.' : undefined, autor: !autor ? 'Informe o autor.' : undefined }); return true; }
    const ativo = corpo.ativo === false ? 0 : 1;
    if (!ativo && banco.prepare(`
      SELECT a.id FROM emprestimos a JOIN exemplares e ON e.id = a.exemplar_id
      WHERE e.livro_id = ? AND a.status = 'ativo' LIMIT 1
    `).get(livroId)) { falha(resposta, 409, 'LIVRO_COM_EMPRESTIMO', 'Devolva ou corrija os empréstimos ativos antes de arquivar o livro.'); return true; }
    const resultado = banco.prepare(`
      UPDATE livros SET titulo = ?, autor = ?, editora = ?, edicao = ?, ano_publicacao = ?, genero = ?, ativo = ?, atualizado_em = ? WHERE id = ?
    `).run(titulo, autor, vazioParaNulo(corpo.editora), vazioParaNulo(corpo.edicao), corpo.anoPublicacao || null, vazioParaNulo(corpo.genero), ativo, agora(), livroId);
    if (!resultado.changes) falha(resposta, 404, 'LIVRO_NAO_ENCONTRADO', 'Livro não encontrado.');
    else enviarJson(resposta, 200, { livro: carregarLivro(banco, livroId) });
    return true;
  }
  if (livroId && requisicao.method === 'DELETE') {
    const historico = banco.prepare(`
      SELECT a.id FROM emprestimos a JOIN exemplares e ON e.id = a.exemplar_id WHERE e.livro_id = ? LIMIT 1
    `).get(livroId);
    const eventos = banco.prepare(`
      SELECT ev.id FROM eventos_exemplar ev JOIN exemplares e ON e.id = ev.exemplar_id WHERE e.livro_id = ? LIMIT 1
    `).get(livroId);
    if (historico || eventos) falha(resposta, 409, 'LIVRO_COM_HISTORICO', 'Esse livro possui histórico e deve ser arquivado, não excluído.');
    else {
      banco.exec('BEGIN IMMEDIATE');
      try {
        banco.prepare('DELETE FROM exemplares WHERE livro_id = ?').run(livroId);
        const resultado = banco.prepare('DELETE FROM livros WHERE id = ?').run(livroId);
        banco.exec('COMMIT');
        if (!resultado.changes) falha(resposta, 404, 'LIVRO_NAO_ENCONTRADO', 'Livro não encontrado.');
        else resposta.writeHead(204).end();
      } catch (erro) { banco.exec('ROLLBACK'); throw erro; }
    }
    return true;
  }

  const exemplarId = idDoCaminho(caminho, 'exemplares');
  if (exemplarId && requisicao.method === 'PUT') {
    const atual = banco.prepare('SELECT * FROM exemplares WHERE id = ?').get(exemplarId);
    if (!atual) { falha(resposta, 404, 'EXEMPLAR_NAO_ENCONTRADO', 'Exemplar não encontrado.'); return true; }
    const corpo = await lerJson(requisicao);
    const estado = corpo.estado || atual.estado;
    if (!['normal', 'perdido', 'danificado', 'manutencao', 'arquivado'].includes(estado)) { falha(resposta, 422, 'ESTADO_INVALIDO', 'Escolha uma condição válida.'); return true; }
    if (estado !== atual.estado && banco.prepare("SELECT id FROM emprestimos WHERE exemplar_id = ? AND status = 'ativo'").get(exemplarId)) {
      falha(resposta, 409, 'EXEMPLAR_COM_EMPRESTIMO', 'Use a ocorrência do empréstimo para registrar perda ou dano.'); return true;
    }
    const data = agora();
    try {
      banco.exec('BEGIN IMMEDIATE');
      banco.prepare('UPDATE exemplares SET codigo = ?, estado = ?, atualizado_em = ? WHERE id = ?')
        .run(vazioParaNulo(corpo.codigo), estado, data, exemplarId);
      if (estado !== atual.estado) banco.prepare(`
        INSERT INTO eventos_exemplar (exemplar_id, estado_anterior, estado_novo, usuario_id, criado_em)
        VALUES (?, ?, ?, ?, ?)
      `).run(exemplarId, atual.estado, estado, usuario.id, data);
      banco.exec('COMMIT');
      enviarJson(resposta, 200, { exemplar: exemplarPublico(banco.prepare('SELECT * FROM exemplares WHERE id = ?').get(exemplarId)) });
    } catch (erro) {
      banco.exec('ROLLBACK');
      if (ehDuplicidade(erro)) falha(resposta, 409, 'CODIGO_DUPLICADO', 'Esse código de exemplar já está em uso.');
      else throw erro;
    }
    return true;
  }
  if (exemplarId && requisicao.method === 'DELETE') {
    const historico = banco.prepare('SELECT id FROM emprestimos WHERE exemplar_id = ? LIMIT 1').get(exemplarId);
    const eventos = banco.prepare('SELECT id FROM eventos_exemplar WHERE exemplar_id = ? LIMIT 1').get(exemplarId);
    if (historico || eventos) falha(resposta, 409, 'EXEMPLAR_COM_HISTORICO', 'Esse exemplar possui histórico e deve ser arquivado, não excluído.');
    else {
      const resultado = banco.prepare('DELETE FROM exemplares WHERE id = ?').run(exemplarId);
      if (!resultado.changes) falha(resposta, 404, 'EXEMPLAR_NAO_ENCONTRADO', 'Exemplar não encontrado.');
      else resposta.writeHead(204).end();
    }
    return true;
  }

  return false;
}

module.exports = { tratarCadastros, carregarLivro, leitorPublico, consultaLeitor, exemplarPublico };
