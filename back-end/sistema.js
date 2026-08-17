const path = require('node:path');
const { criarBackup } = require('./backups');
const { senhaConfere } = require('./senhas');

const ESTRUTURA_ESPERADA = {
  schema_migrations: ['versao', 'aplicada_em'],
  usuarios: ['id', 'nome', 'usuario', 'senha_hash', 'senha_salt', 'perfil', 'ativo', 'criado_em', 'atualizado_em'],
  turmas: ['id', 'nome', 'turno', 'ano_letivo', 'ativo', 'criado_em', 'atualizado_em'],
  leitores: ['id', 'tipo', 'nome', 'identificador', 'telefone', 'turma_id', 'ativo', 'criado_em', 'atualizado_em'],
  livros: ['id', 'titulo', 'autor', 'editora', 'edicao', 'ano_publicacao', 'genero', 'ativo', 'criado_em', 'atualizado_em'],
  exemplares: ['id', 'livro_id', 'codigo', 'estado', 'criado_em', 'atualizado_em'],
  emprestimos: ['id', 'leitor_id', 'exemplar_id', 'emprestado_por', 'devolvido_por', 'data_saida', 'data_prevista', 'devolvido_em', 'status', 'criado_em', 'atualizado_em'],
  eventos_exemplar: ['id', 'exemplar_id', 'estado_anterior', 'estado_novo', 'usuario_id', 'criado_em'],
  eventos_emprestimo: ['id', 'emprestimo_id', 'tipo', 'usuario_id', 'detalhes', 'criado_em'],
};

const INDICES_ESPERADOS = [
  'leitores_identificador_unico',
  'exemplares_codigo_unico',
  'emprestimo_ativo_por_exemplar',
];

const MENSAGEM_OK = 'Integridade do sistema ok. A instalação ocorreu com sucesso.';
const MENSAGEM_ERRO = 'O sistema foi instalado incorretamente. Confira com a administradora o que aconteceu.';

function verificarSistema(banco) {
  try {
    if (banco.prepare('PRAGMA foreign_keys').get().foreign_keys !== 1) return false;
    if (banco.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') return false;
    if (banco.prepare('PRAGMA foreign_key_check').all().length) return false;

    const tabelas = new Set(banco.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((item) => item.name));
    for (const [tabela, colunasEsperadas] of Object.entries(ESTRUTURA_ESPERADA)) {
      if (!tabelas.has(tabela)) return false;
      const colunas = new Set(banco.prepare(`PRAGMA table_info('${tabela}')`).all().map((item) => item.name));
      if (colunasEsperadas.some((coluna) => !colunas.has(coluna))) return false;
    }

    const indices = new Set(banco.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((item) => item.name));
    if (INDICES_ESPERADOS.some((indice) => !indices.has(indice))) return false;
    if (banco.prepare('SELECT MAX(versao) AS versao FROM schema_migrations').get().versao !== 1) return false;
    if (!banco.prepare("SELECT id FROM usuarios WHERE perfil = 'administrador' AND ativo = 1 LIMIT 1").get()) return false;
    return true;
  } catch {
    return false;
  }
}

async function tratarSistema(contexto) {
  const {
    requisicao, resposta, url, banco, usuario, lerJson, enviarJson, falha, reconstruirBanco,
  } = contexto;

  if (url.pathname === '/api/sistema/status' && requisicao.method === 'GET') {
    const integro = verificarSistema(banco);
    enviarJson(resposta, 200, { integro, mensagem: integro ? MENSAGEM_OK : MENSAGEM_ERRO });
    return true;
  }

  if (url.pathname === '/api/sistema/reparar' && requisicao.method === 'POST') {
    const corpo = await lerJson(requisicao);
    if (corpo.confirmacao !== 'REINICIAR') {
      falha(resposta, 422, 'CONFIRMACAO_INVALIDA', 'Digite REINICIAR para confirmar a reinstalação.');
      return true;
    }
    if (!senhaConfere(corpo.senha || '', usuario.senha_hash, usuario.senha_salt)) {
      falha(resposta, 422, 'SENHA_INVALIDA', 'A senha da administradora está incorreta.');
      return true;
    }

    const caminhoBackup = await criarBackup(banco, 'pre-reparo');
    await reconstruirBanco(usuario);
    enviarJson(resposta, 200, {
      reparado: true,
      mensagem: 'O Assis foi reinstalado com sucesso. Entre novamente para continuar.',
      backup: path.basename(caminhoBackup),
    });
    return true;
  }

  return false;
}

module.exports = { MENSAGEM_ERRO, MENSAGEM_OK, tratarSistema, verificarSistema };
