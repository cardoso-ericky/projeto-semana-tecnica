const { consultaLeitor, leitorPublico } = require('./cadastros');

function somarDias(data, quantidade) {
  const valor = new Date(`${data}T12:00:00Z`);
  valor.setUTCDate(valor.getUTCDate() + quantidade);
  return valor.toISOString().slice(0, 10);
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function dataValida(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    && !Number.isNaN(Date.parse(`${valor}T12:00:00Z`));
}

function idDaAcao(caminho, acao) {
  const encontrado = caminho.match(new RegExp(`^/api/emprestimos/(\\d+)/${acao}$`));
  return encontrado ? Number(encontrado[1]) : null;
}

function emTransacao(banco, trabalho) {
  // Uma movimentação altera mais de uma tabela. A transação garante que uma
  // queda de energia não deixe o livro devolvido em um lugar e ativo em outro.
  banco.exec('BEGIN IMMEDIATE');
  try {
    const resultado = trabalho();
    banco.exec('COMMIT');
    return resultado;
  } catch (erro) {
    banco.exec('ROLLBACK');
    throw erro;
  }
}

function carregarEmprestimo(banco, id) {
  const linha = banco.prepare(`
    SELECT a.*, r.nome AS leitor_nome, r.tipo AS leitor_tipo, r.identificador AS leitor_identificador,
      r.telefone AS leitor_telefone, e.codigo AS exemplar_codigo, e.estado AS exemplar_estado,
      l.id AS livro_id, l.titulo AS livro_titulo, l.autor AS livro_autor,
      ue.nome AS emprestado_por_nome, ud.nome AS devolvido_por_nome
    FROM emprestimos a
    JOIN leitores r ON r.id = a.leitor_id
    JOIN exemplares e ON e.id = a.exemplar_id
    JOIN livros l ON l.id = e.livro_id
    JOIN usuarios ue ON ue.id = a.emprestado_por
    LEFT JOIN usuarios ud ON ud.id = a.devolvido_por
    WHERE a.id = ?
  `).get(id);
  if (!linha) return null;
  const ultimoProblema = banco.prepare(`
    SELECT tipo FROM eventos_emprestimo
    WHERE emprestimo_id = ? AND tipo IN ('perdido', 'danificado')
    ORDER BY id DESC LIMIT 1
  `).get(id);
  return {
    id: linha.id, status: linha.status, dataSaida: linha.data_saida,
    dataPrevista: linha.data_prevista, devolvidoEm: linha.devolvido_em,
    leitor: {
      id: linha.leitor_id, nome: linha.leitor_nome, tipo: linha.leitor_tipo,
      identificador: linha.leitor_identificador, telefone: linha.leitor_telefone,
    },
    exemplar: {
      id: linha.exemplar_id, codigo: linha.exemplar_codigo, estado: linha.exemplar_estado,
      livro: { id: linha.livro_id, titulo: linha.livro_titulo, autor: linha.livro_autor },
    },
    emprestadoPor: { id: linha.emprestado_por, nome: linha.emprestado_por_nome },
    devolvidoPor: linha.devolvido_por ? { id: linha.devolvido_por, nome: linha.devolvido_por_nome } : null,
    ocorrencia: linha.status === 'ativo' && ['perdido', 'danificado'].includes(linha.exemplar_estado)
      ? (ultimoProblema?.tipo || linha.exemplar_estado) : null,
    criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em,
  };
}

function registrarEvento(banco, emprestimoId, tipo, usuarioId, data, detalhes = null) {
  banco.prepare(`
    INSERT INTO eventos_emprestimo (emprestimo_id, tipo, usuario_id, detalhes, criado_em)
    VALUES (?, ?, ?, ?, ?)
  `).run(emprestimoId, tipo, usuarioId, detalhes ? JSON.stringify(detalhes) : null, data);
}

async function tratarCirculacao(contexto) {
  const { requisicao, resposta, url, banco, usuario, lerJson, enviarJson, falha, agora } = contexto;
  const caminho = url.pathname;

  if (caminho === '/api/emprestimos' && requisicao.method === 'POST') {
    const corpo = await lerJson(requisicao);
    const leitor = banco.prepare('SELECT id FROM leitores WHERE id = ? AND ativo = 1').get(Number(corpo.leitorId));
    const exemplar = banco.prepare(`
      SELECT e.id, e.estado, l.ativo AS livro_ativo
      FROM exemplares e JOIN livros l ON l.id = e.livro_id WHERE e.id = ?
    `).get(Number(corpo.exemplarId));
    const erros = {};
    if (!leitor) erros.leitorId = 'Escolha um leitor ativo.';
    if (!exemplar) erros.exemplarId = 'Escolha um exemplar existente.';
    else if (exemplar.estado !== 'normal' || !exemplar.livro_ativo) erros.exemplarId = 'Esse exemplar não está disponível.';
    const dataSaida = corpo.dataSaida || hoje();
    const dataPrevista = corpo.dataPrevista || somarDias(dataSaida, 7);
    if (!dataValida(dataSaida)) erros.dataSaida = 'Informe uma data válida.';
    if (!dataValida(dataPrevista) || dataPrevista < dataSaida) erros.dataPrevista = 'A previsão deve ser igual ou posterior à saída.';
    if (Object.keys(erros).length) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Revise os campos destacados.', erros); return true; }

    const jaEmprestado = banco.prepare("SELECT id FROM emprestimos WHERE exemplar_id = ? AND status = 'ativo'").get(exemplar.id);
    if (jaEmprestado) { falha(resposta, 409, 'EXEMPLAR_EMPRESTADO', 'Esse exemplar já possui um empréstimo ativo.'); return true; }
    const data = agora();
    let id;
    try {
      id = emTransacao(banco, () => {
        const resultado = banco.prepare(`
          INSERT INTO emprestimos
            (leitor_id, exemplar_id, emprestado_por, data_saida, data_prevista, status, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, 'ativo', ?, ?)
        `).run(leitor.id, exemplar.id, usuario.id, dataSaida, dataPrevista, data, data);
        registrarEvento(banco, resultado.lastInsertRowid, 'criacao', usuario.id, data, { dataPrevista });
        return Number(resultado.lastInsertRowid);
      });
    } catch (erro) {
      if (erro.message?.includes('UNIQUE constraint failed')) {
        falha(resposta, 409, 'EXEMPLAR_EMPRESTADO', 'Esse exemplar acabou de ser emprestado em outra operação.'); return true;
      }
      throw erro;
    }
    enviarJson(resposta, 201, { emprestimo: carregarEmprestimo(banco, id) }); return true;
  }

  if (caminho === '/api/emprestimos' && requisicao.method === 'GET') {
    const busca = `%${url.searchParams.get('busca') || ''}%`;
    const status = url.searchParams.get('status') || 'ativo';
    const ids = banco.prepare(`
      SELECT a.id FROM emprestimos a JOIN leitores r ON r.id = a.leitor_id
      JOIN exemplares e ON e.id = a.exemplar_id JOIN livros l ON l.id = e.livro_id
      WHERE (? = '' OR a.status = ?)
        AND (r.nome LIKE ? OR l.titulo LIKE ? OR COALESCE(e.codigo, '') LIKE ?)
      ORDER BY CASE WHEN a.status = 'ativo' AND a.data_prevista < ? THEN 0 ELSE 1 END, a.data_prevista
    `).all(status, status, busca, busca, busca, hoje()).map((linha) => linha.id);
    enviarJson(resposta, 200, { emprestimos: ids.map((id) => carregarEmprestimo(banco, id)) }); return true;
  }

  const idPrazo = idDaAcao(caminho, 'prazo');
  if (idPrazo && requisicao.method === 'PUT') {
    const corpo = await lerJson(requisicao);
    const emprestimo = carregarEmprestimo(banco, idPrazo);
    if (!emprestimo || emprestimo.status !== 'ativo') { falha(resposta, 409, 'EMPRESTIMO_INATIVO', 'Somente um empréstimo ativo pode ter o prazo alterado.'); return true; }
    if (!dataValida(corpo.dataPrevista) || corpo.dataPrevista < emprestimo.dataSaida) { falha(resposta, 422, 'DATA_INVALIDA', 'Informe uma previsão igual ou posterior à saída.', { dataPrevista: 'Revise a data.' }); return true; }
    const data = agora();
    emTransacao(banco, () => {
      banco.prepare('UPDATE emprestimos SET data_prevista = ?, atualizado_em = ? WHERE id = ?').run(corpo.dataPrevista, data, idPrazo);
      registrarEvento(banco, idPrazo, 'mudanca_prazo', usuario.id, data, { anterior: emprestimo.dataPrevista, novo: corpo.dataPrevista });
    });
    enviarJson(resposta, 200, { emprestimo: carregarEmprestimo(banco, idPrazo) }); return true;
  }

  const idDevolucao = idDaAcao(caminho, 'devolucao');
  if (idDevolucao && requisicao.method === 'POST') {
    const emprestimo = carregarEmprestimo(banco, idDevolucao);
    if (!emprestimo || emprestimo.status !== 'ativo') { falha(resposta, 409, 'EMPRESTIMO_INATIVO', 'Esse empréstimo não está ativo.'); return true; }
    const data = agora();
    emTransacao(banco, () => {
      banco.prepare("UPDATE emprestimos SET status = 'devolvido', devolvido_por = ?, devolvido_em = ?, atualizado_em = ? WHERE id = ?")
        .run(usuario.id, data, data, idDevolucao);
      registrarEvento(banco, idDevolucao, 'devolucao', usuario.id, data);
    });
    enviarJson(resposta, 200, { emprestimo: carregarEmprestimo(banco, idDevolucao) }); return true;
  }

  const idCancelamento = idDaAcao(caminho, 'cancelamento');
  if (idCancelamento && requisicao.method === 'POST') {
    const emprestimo = carregarEmprestimo(banco, idCancelamento);
    if (!emprestimo || emprestimo.status !== 'ativo') { falha(resposta, 409, 'EMPRESTIMO_INATIVO', 'Somente um empréstimo ativo pode ser cancelado.'); return true; }
    if (emprestimo.ocorrencia) { falha(resposta, 409, 'OCORRENCIA_ATIVA', 'Resolva a perda ou dano antes de cancelar o empréstimo.'); return true; }
    const data = agora();
    emTransacao(banco, () => {
      banco.prepare("UPDATE emprestimos SET status = 'cancelado', atualizado_em = ? WHERE id = ?").run(data, idCancelamento);
      registrarEvento(banco, idCancelamento, 'cancelamento', usuario.id, data);
    });
    enviarJson(resposta, 200, { emprestimo: carregarEmprestimo(banco, idCancelamento) }); return true;
  }

  const idDesfazer = idDaAcao(caminho, 'desfazer-devolucao');
  if (idDesfazer && requisicao.method === 'POST') {
    const emprestimo = carregarEmprestimo(banco, idDesfazer);
    if (!emprestimo || emprestimo.status !== 'devolvido') { falha(resposta, 409, 'DEVOLUCAO_INEXISTENTE', 'Somente uma devolução concluída pode ser desfeita.'); return true; }
    const outraSaida = banco.prepare("SELECT id FROM emprestimos WHERE exemplar_id = ? AND status = 'ativo'").get(emprestimo.exemplar.id);
    if (outraSaida) { falha(resposta, 409, 'EXEMPLAR_JA_EMPRESTADO', 'O exemplar já saiu novamente e esta devolução não pode ser desfeita.'); return true; }
    const data = agora();
    emTransacao(banco, () => {
      banco.prepare("UPDATE emprestimos SET status = 'ativo', devolvido_por = NULL, devolvido_em = NULL, atualizado_em = ? WHERE id = ?").run(data, idDesfazer);
      registrarEvento(banco, idDesfazer, 'desfazer_devolucao', usuario.id, data);
    });
    enviarJson(resposta, 200, { emprestimo: carregarEmprestimo(banco, idDesfazer) }); return true;
  }

  const idOcorrencia = idDaAcao(caminho, 'ocorrencia');
  if (idOcorrencia && requisicao.method === 'POST') {
    const corpo = await lerJson(requisicao);
    const emprestimo = carregarEmprestimo(banco, idOcorrencia);
    if (!emprestimo || emprestimo.status !== 'ativo') { falha(resposta, 409, 'EMPRESTIMO_INATIVO', 'A ocorrência exige um empréstimo ativo.'); return true; }
    if (!['perdido', 'danificado'].includes(corpo.tipo)) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Escolha perdido ou danificado.', { tipo: 'Escolha uma condição válida.' }); return true; }
    const data = agora();
    emTransacao(banco, () => {
      banco.prepare('UPDATE exemplares SET estado = ?, atualizado_em = ? WHERE id = ?').run(corpo.tipo, data, emprestimo.exemplar.id);
      banco.prepare(`
        INSERT INTO eventos_exemplar (exemplar_id, estado_anterior, estado_novo, usuario_id, criado_em)
        VALUES (?, ?, ?, ?, ?)
      `).run(emprestimo.exemplar.id, emprestimo.exemplar.estado, corpo.tipo, usuario.id, data);
      registrarEvento(banco, idOcorrencia, corpo.tipo, usuario.id, data);
    });
    enviarJson(resposta, 200, { emprestimo: carregarEmprestimo(banco, idOcorrencia) }); return true;
  }

  const idEncerramento = idDaAcao(caminho, 'encerramento');
  if (idEncerramento && requisicao.method === 'POST') {
    const corpo = await lerJson(requisicao);
    const justificativa = typeof corpo.justificativa === 'string' ? corpo.justificativa.trim() : '';
    const emprestimo = carregarEmprestimo(banco, idEncerramento);
    if (!emprestimo || emprestimo.status !== 'ativo' || !emprestimo.ocorrencia) {
      falha(resposta, 409, 'OCORRENCIA_INATIVA', 'Não há uma ocorrência ativa para encerrar.'); return true;
    }
    if (!justificativa) { falha(resposta, 422, 'JUSTIFICATIVA_OBRIGATORIA', 'Explique por que o livro será encerrado sem devolução.', { justificativa: 'A justificativa é obrigatória.' }); return true; }
    const data = agora();
    emTransacao(banco, () => {
      banco.prepare("UPDATE emprestimos SET status = 'encerrado_sem_devolucao', atualizado_em = ? WHERE id = ?").run(data, idEncerramento);
      registrarEvento(banco, idEncerramento, 'encerramento_ocorrencia', usuario.id, data, { justificativa });
    });
    enviarJson(resposta, 200, { emprestimo: carregarEmprestimo(banco, idEncerramento) }); return true;
  }

  if (caminho === '/api/pendencias' && requisicao.method === 'GET') {
    const dataHoje = dataValida(url.searchParams.get('hoje')) ? url.searchParams.get('hoje') : hoje();
    const ids = banco.prepare(`
      SELECT a.id FROM emprestimos a JOIN exemplares e ON e.id = a.exemplar_id
      WHERE a.status = 'ativo' AND (a.data_prevista < ? OR e.estado IN ('perdido', 'danificado'))
      ORDER BY a.data_prevista
    `).all(dataHoje).map((linha) => linha.id);
    const grupos = new Map();
    for (const id of ids) {
      const item = carregarEmprestimo(banco, id);
      item.diasAtraso = Math.max(0, Math.floor((Date.parse(`${dataHoje}T12:00:00Z`) - Date.parse(`${item.dataPrevista}T12:00:00Z`)) / 86400000));
      if (!grupos.has(item.leitor.id)) grupos.set(item.leitor.id, { leitor: item.leitor, emprestimos: [] });
      grupos.get(item.leitor.id).emprestimos.push(item);
    }
    enviarJson(resposta, 200, { leitores: [...grupos.values()] }); return true;
  }

  if (caminho === '/api/painel' && requisicao.method === 'GET') {
    const dataHoje = dataValida(url.searchParams.get('hoje')) ? url.searchParams.get('hoje') : hoje();
    const totais = banco.prepare(`
      SELECT
        (SELECT COUNT(*) FROM emprestimos WHERE status = 'ativo') AS ativos,
        (SELECT COUNT(*) FROM emprestimos WHERE status = 'ativo' AND data_prevista < ?) AS atrasados,
        (SELECT COUNT(*) FROM emprestimos a JOIN exemplares e ON e.id = a.exemplar_id
          WHERE a.status = 'ativo' AND e.estado IN ('perdido', 'danificado')) AS ocorrencias,
        (SELECT COUNT(*) FROM exemplares e JOIN livros l ON l.id = e.livro_id
          LEFT JOIN emprestimos a ON a.exemplar_id = e.id AND a.status = 'ativo'
          WHERE e.estado = 'normal' AND l.ativo = 1 AND a.id IS NULL) AS disponiveis
    `).get(dataHoje);
    const atividades = banco.prepare(`
      SELECT ev.tipo, ev.criado_em, ev.detalhes, u.nome AS usuario,
        r.nome AS leitor, l.titulo AS livro, e.codigo AS exemplar
      FROM eventos_emprestimo ev
      JOIN usuarios u ON u.id = ev.usuario_id
      JOIN emprestimos a ON a.id = ev.emprestimo_id
      JOIN leitores r ON r.id = a.leitor_id
      JOIN exemplares e ON e.id = a.exemplar_id
      JOIN livros l ON l.id = e.livro_id
      ORDER BY ev.id DESC LIMIT 10
    `).all().map((item) => ({
      tipo: item.tipo, criadoEm: item.criado_em, usuario: item.usuario,
      leitor: item.leitor, livro: item.livro, exemplar: item.exemplar,
      detalhes: item.detalhes ? JSON.parse(item.detalhes) : null,
    }));
    enviarJson(resposta, 200, { totais, atividades }); return true;
  }

  const historico = caminho.match(/^\/api\/leitores\/(\d+)\/historico$/);
  if (historico && requisicao.method === 'GET') {
    const leitor = consultaLeitor(banco, 'WHERE r.id = ?').get(Number(historico[1]));
    if (!leitor) { falha(resposta, 404, 'LEITOR_NAO_ENCONTRADO', 'Leitor não encontrado.'); return true; }
    const ids = banco.prepare('SELECT id FROM emprestimos WHERE leitor_id = ? ORDER BY id DESC').all(leitor.id).map((linha) => linha.id);
    const emprestimos = ids.map((id) => {
      const item = carregarEmprestimo(banco, id);
      item.eventos = banco.prepare(`
        SELECT ev.tipo, ev.criado_em, ev.detalhes, u.id AS usuario_id, u.nome AS usuario_nome
        FROM eventos_emprestimo ev JOIN usuarios u ON u.id = ev.usuario_id
        WHERE ev.emprestimo_id = ? ORDER BY ev.id
      `).all(id).map((evento) => ({
        tipo: evento.tipo, criadoEm: evento.criado_em,
        usuario: { id: evento.usuario_id, nome: evento.usuario_nome },
        detalhes: evento.detalhes ? JSON.parse(evento.detalhes) : null,
      }));
      return item;
    });
    enviarJson(resposta, 200, { leitor: leitorPublico(leitor), emprestimos }); return true;
  }

  return false;
}

module.exports = { tratarCirculacao, carregarEmprestimo };
