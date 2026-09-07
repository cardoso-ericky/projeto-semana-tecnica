const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { existsSync, mkdtempSync, renameSync, rmSync, unlinkSync } = require('node:fs');
const path = require('node:path');
const { abrirBanco, agora } = require('./banco');
const { criarSenhaProtegida, senhaConfere } = require('./senhas');
const { tratarCadastros } = require('./cadastros');
const { tratarCirculacao } = require('./circulacao');
const { servirArquivo } = require('./arquivos');
const { criarBackup, tratarBackups } = require('./backups');
const { tratarSistema } = require('./sistema');

const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;

function enviarJson(resposta, status, dados) {
  const corpo = dados === undefined ? '' : JSON.stringify(dados);
  resposta.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(corpo),
    'cache-control': 'no-store',
  });
  resposta.end(corpo);
}

function falha(resposta, status, codigo, mensagem, campos) {
  enviarJson(resposta, status, {
    error: { code: codigo, message: mensagem, ...(campos ? { fields: campos } : {}) },
  });
}

async function lerJson(requisicao) {
  const pedacos = [];
  let tamanho = 0;
  for await (const pedaco of requisicao) {
    tamanho += pedaco.length;
    if (tamanho > 1024 * 1024) throw Object.assign(new Error('Corpo muito grande.'), { status: 413 });
    pedacos.push(pedaco);
  }
  if (pedacos.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(pedacos).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Os dados enviados não formam um JSON válido.'), { status: 400 });
  }
}

async function lerBuffer(requisicao, limite = 1024 * 1024) {
  const pedacos = []; let tamanho = 0;
  for await (const pedaco of requisicao) {
    tamanho += pedaco.length;
    if (tamanho > limite) throw new Error('O arquivo excede o tamanho permitido.');
    pedacos.push(pedaco);
  }
  return Buffer.concat(pedacos);
}

function cookiesDa(requisicao) {
  return Object.fromEntries(
    (requisicao.headers.cookie || '')
      .split(';')
      .map((item) => item.trim().split('='))
      .filter(([chave, valor]) => chave && valor),
  );
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    usuario: usuario.usuario,
    perfil: usuario.perfil,
    ativo: Boolean(usuario.ativo),
    criadoEm: usuario.criado_em,
    atualizadoEm: usuario.atualizado_em,
  };
}

function textoObrigatorio(valor, nome, campos) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    campos[nome] = 'Este campo é obrigatório.';
    return '';
  }
  return valor.trim();
}

function criarServidorAssis(opcoes) {
  const configuracao = { ...opcoes };
  if (!configuracao.senhaInicialAdmin && !configuracao.senhaInicialProtegida) {
    configuracao.senhaInicialProtegida = {
      salt: 'fa572fdacc70e5e174a4327c3f045f4d',
      hash: '53c718fad800f3eb5b59a8b14ce9d8ac42c981639fe2d4717bd6bd626aaf7c60bee80c368ded5900548c6945e25cd4c89845292db01b93e083db21f50fbaa036',
    };
  }
  let banco = abrirBanco(configuracao);
  const sessoes = new Map();

  function encontrarSessao(requisicao) {
    const token = cookiesDa(requisicao).assis_session;
    if (!token) return null;
    const sessao = sessoes.get(token);
    if (!sessao || sessao.expiraEm < Date.now()) {
      sessoes.delete(token);
      return null;
    }
    const usuario = banco.prepare('SELECT * FROM usuarios WHERE id = ? AND ativo = 1').get(sessao.usuarioId);
    return usuario ? { token, usuario } : null;
  }

  function exigirUsuario(requisicao, resposta, perfil) {
    const sessao = encontrarSessao(requisicao);
    if (!sessao) {
      falha(resposta, 401, 'SESSAO_NECESSARIA', 'Entre no Assis para continuar.');
      return null;
    }
    if (perfil && sessao.usuario.perfil !== perfil) {
      falha(resposta, 403, 'ACESSO_NEGADO', 'Somente a administradora pode realizar esta ação.');
      return null;
    }
    return sessao;
  }

  function trocarBanco(caminhoNovo) {
    const destino = banco.caminhoAssis;
    const anterior = `${destino}.antes-da-troca`;
    const trocaFalhou = `${destino}.troca-falhou`;
    let anteriorMovido = false;
    let novoMovido = false;
    banco.close();
    try {
      if (existsSync(anterior)) unlinkSync(anterior);
      if (existsSync(trocaFalhou)) unlinkSync(trocaFalhou);
      renameSync(destino, anterior);
      anteriorMovido = true;
      renameSync(caminhoNovo, destino);
      novoMovido = true;
      banco = abrirBanco(configuracao);
      sessoes.clear();
      try { unlinkSync(anterior); } catch { /* O backup permanente já protege o estado anterior. */ }
    } catch (erro) {
      // Se a nova base não abrir, o arquivo anterior volta ao lugar antes de
      // qualquer outra requisição. A tentativa defeituosa fica separada apenas
      // até o banco válido ser reaberto, facilitando uma recuperação atômica.
      if (novoMovido && existsSync(destino)) renameSync(destino, trocaFalhou);
      if (anteriorMovido && existsSync(anterior)) renameSync(anterior, destino);
      banco = abrirBanco(configuracao);
      try { unlinkSync(trocaFalhou); } catch { /* Pode não haver arquivo novo para remover. */ }
      throw erro;
    }
  }

  function reconstruirBanco(administrador) {
    const pastaTemporaria = mkdtempSync(path.join(path.dirname(banco.caminhoAssis), '.reparo-'));
    let novoBanco;
    try {
      novoBanco = abrirBanco({
        diretorioDados: pastaTemporaria,
        senhaInicialProtegida: { hash: administrador.senha_hash, salt: administrador.senha_salt },
      });
      novoBanco.prepare(`
        UPDATE usuarios SET nome = ?, usuario = ?, senha_hash = ?, senha_salt = ?, atualizado_em = ?
        WHERE perfil = 'administrador'
      `).run(administrador.nome, administrador.usuario, administrador.senha_hash, administrador.senha_salt, agora());
      const caminhoNovo = novoBanco.caminhoAssis;
      novoBanco.close();
      novoBanco = null;
      trocarBanco(caminhoNovo);
    } finally {
      try { novoBanco?.close(); } catch { /* O banco pode já ter sido fechado durante a troca. */ }
      rmSync(pastaTemporaria, { recursive: true, force: true });
    }
  }

  const servidor = createServer(async (requisicao, resposta) => {
    try {
      const url = new URL(requisicao.url, 'http://127.0.0.1');

      if (url.pathname === '/api/saude' && requisicao.method === 'GET') {
        enviarJson(resposta, 200, { status: 'ok' });
        return;
      }

      if (url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(requisicao.method)) {
        const origem = requisicao.headers.origin;
        if (origem && origem !== `http://${requisicao.headers.host}`) {
          falha(resposta, 403, 'ORIGEM_INVALIDA', 'A ação precisa ser feita pela tela local do Assis.');
          return;
        }
      }

      if (url.pathname === '/api/sessao' && requisicao.method === 'POST') {
        const corpo = await lerJson(requisicao);
        const usuario = banco.prepare('SELECT * FROM usuarios WHERE usuario = ? AND ativo = 1').get(corpo.usuario || '');
        if (!usuario || !senhaConfere(corpo.senha || '', usuario.senha_hash, usuario.senha_salt)) {
          falha(resposta, 401, 'LOGIN_INVALIDO', 'Usuário ou senha incorretos.');
          return;
        }
        const token = randomBytes(32).toString('hex');
        sessoes.set(token, { usuarioId: usuario.id, expiraEm: Date.now() + DURACAO_SESSAO_MS });
        resposta.setHeader('set-cookie', `assis_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
        enviarJson(resposta, 200, { usuario: usuarioPublico(usuario) });
        return;
      }

      if (url.pathname === '/api/sessao' && requisicao.method === 'GET') {
        const sessao = exigirUsuario(requisicao, resposta);
        if (sessao) enviarJson(resposta, 200, { usuario: usuarioPublico(sessao.usuario) });
        return;
      }

      if (url.pathname === '/api/sessao' && requisicao.method === 'DELETE') {
        const sessao = encontrarSessao(requisicao);
        if (sessao) sessoes.delete(sessao.token);
        resposta.setHeader('set-cookie', 'assis_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        resposta.writeHead(204).end();
        return;
      }

      if (url.pathname === '/api/usuarios' && requisicao.method === 'GET') {
        if (!exigirUsuario(requisicao, resposta, 'administrador')) return;
        const usuarios = banco.prepare('SELECT * FROM usuarios ORDER BY id').all().map(usuarioPublico);
        enviarJson(resposta, 200, { usuarios });
        return;
      }

      if (url.pathname === '/api/usuarios' && requisicao.method === 'POST') {
        if (!exigirUsuario(requisicao, resposta, 'administrador')) return;
        const corpo = await lerJson(requisicao);
        const campos = {};
        const nome = textoObrigatorio(corpo.nome, 'nome', campos);
        const usuario = textoObrigatorio(corpo.usuario, 'usuario', campos);
        if (typeof corpo.senha !== 'string' || corpo.senha.length < 8) {
          campos.senha = 'Use pelo menos 8 caracteres.';
        }
        if (Object.keys(campos).length) {
          falha(resposta, 422, 'DADOS_INVALIDOS', 'Revise os campos destacados.', campos);
          return;
        }
        const protegida = criarSenhaProtegida(corpo.senha);
        const data = agora();
        try {
          const resultado = banco.prepare(`
            INSERT INTO usuarios
              (nome, usuario, senha_hash, senha_salt, perfil, ativo, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, 'auxiliar', 1, ?, ?)
          `).run(nome, usuario, protegida.hash, protegida.salt, data, data);
          const criado = banco.prepare('SELECT * FROM usuarios WHERE id = ?').get(resultado.lastInsertRowid);
          enviarJson(resposta, 201, { usuario: usuarioPublico(criado) });
        } catch (erro) {
          if (erro.message?.includes('UNIQUE constraint failed')) {
            falha(resposta, 409, 'USUARIO_EXISTENTE', 'Esse nome de usuário já está em uso.', { usuario: 'Escolha outro usuário.' });
          } else throw erro;
        }
        return;
      }

      const usuarioSenha = url.pathname.match(/^\/api\/usuarios\/(\d+)\/senha$/);
      if (usuarioSenha && requisicao.method === 'PUT') {
        if (!exigirUsuario(requisicao, resposta, 'administrador')) return;
        const alvo = banco.prepare("SELECT * FROM usuarios WHERE id = ? AND perfil = 'auxiliar'").get(Number(usuarioSenha[1]));
        if (!alvo) { falha(resposta, 404, 'AUXILIAR_NAO_ENCONTRADO', 'Auxiliar não encontrado.'); return; }
        const corpo = await lerJson(requisicao);
        if (typeof corpo.senha !== 'string' || corpo.senha.length < 8) {
          falha(resposta, 422, 'DADOS_INVALIDOS', 'A senha precisa ter pelo menos 8 caracteres.', { senha: 'Use pelo menos 8 caracteres.' }); return;
        }
        const protegida = criarSenhaProtegida(corpo.senha);
        banco.prepare('UPDATE usuarios SET senha_hash = ?, senha_salt = ?, atualizado_em = ? WHERE id = ?')
          .run(protegida.hash, protegida.salt, agora(), alvo.id);
        // Ao trocar a senha, sessões antigas desse auxiliar deixam de valer.
        for (const [token, sessao] of sessoes) if (sessao.usuarioId === alvo.id) sessoes.delete(token);
        enviarJson(resposta, 200, { usuario: usuarioPublico(banco.prepare('SELECT * FROM usuarios WHERE id = ?').get(alvo.id)) });
        return;
      }

      const usuarioId = url.pathname.match(/^\/api\/usuarios\/(\d+)$/);
      if (usuarioId && requisicao.method === 'PUT') {
        if (!exigirUsuario(requisicao, resposta, 'administrador')) return;
        const alvo = banco.prepare("SELECT * FROM usuarios WHERE id = ? AND perfil = 'auxiliar'").get(Number(usuarioId[1]));
        if (!alvo) { falha(resposta, 404, 'AUXILIAR_NAO_ENCONTRADO', 'Auxiliar não encontrado.'); return; }
        const corpo = await lerJson(requisicao);
        const campos = {};
        const nome = textoObrigatorio(corpo.nome, 'nome', campos);
        const nomeUsuario = textoObrigatorio(corpo.usuario, 'usuario', campos);
        if (Object.keys(campos).length) { falha(resposta, 422, 'DADOS_INVALIDOS', 'Revise os campos destacados.', campos); return; }
        try {
          banco.prepare('UPDATE usuarios SET nome = ?, usuario = ?, ativo = ?, atualizado_em = ? WHERE id = ?')
            .run(nome, nomeUsuario, corpo.ativo === false ? 0 : 1, agora(), alvo.id);
          if (corpo.ativo === false) {
            for (const [token, sessao] of sessoes) if (sessao.usuarioId === alvo.id) sessoes.delete(token);
          }
          enviarJson(resposta, 200, { usuario: usuarioPublico(banco.prepare('SELECT * FROM usuarios WHERE id = ?').get(alvo.id)) });
        } catch (erro) {
          if (erro.message?.includes('UNIQUE constraint failed')) falha(resposta, 409, 'USUARIO_EXISTENTE', 'Esse nome de usuário já está em uso.', { usuario: 'Escolha outro usuário.' });
          else throw erro;
        }
        return;
      }

      if (/^\/api\/(turmas|leitores|livros|exemplares)(\/|$)/.test(url.pathname)) {
        const sessao = exigirUsuario(requisicao, resposta);
        if (!sessao) return;
        const tratada = await tratarCadastros({
          requisicao, resposta, url, banco, usuario: sessao.usuario,
          lerJson, enviarJson, falha, agora,
        });
        if (tratada) return;
      }

      if (/^\/api\/(emprestimos|pendencias|painel|atividades|leitores\/\d+\/historico)(\/|$)/.test(url.pathname)) {
        const sessao = exigirUsuario(requisicao, resposta);
        if (!sessao) return;
        const tratada = await tratarCirculacao({
          requisicao, resposta, url, banco, usuario: sessao.usuario,
          lerJson, enviarJson, falha, agora,
        });
        if (tratada) return;
      }

      if (url.pathname.startsWith('/api/backups')) {
        const sessao = exigirUsuario(requisicao, resposta, 'administrador');
        if (!sessao) return;
        const tratada = await tratarBackups({
          requisicao, resposta, url, banco, lerBuffer, enviarJson, falha,
          async restaurarBanco(temporario) {
            trocarBanco(temporario);
          },
        });
        if (tratada) return;
      }

      if (url.pathname.startsWith('/api/sistema')) {
        const sessao = exigirUsuario(requisicao, resposta, 'administrador');
        if (!sessao) return;
        const tratada = await tratarSistema({
          requisicao, resposta, url, banco, usuario: sessao.usuario,
          lerJson, enviarJson, falha, reconstruirBanco,
        });
        if (tratada) return;
      }

      if (url.pathname.startsWith('/api/')) {
        falha(resposta, 404, 'ROTA_INEXISTENTE', 'Essa função não existe.');
        return;
      }

      if (['GET', 'HEAD'].includes(requisicao.method) && servirArquivo(requisicao, resposta, url.pathname)) return;
      resposta.writeHead(404).end('Não encontrado');
    } catch (erro) {
      console.error('Erro ao atender uma requisição:', erro);
      falha(resposta, erro.status || 500, 'ERRO_INTERNO', erro.status ? erro.message : 'Não foi possível concluir a ação.');
    }
  });

  servidor.on('close', () => banco.close());
  if (!configuracao.senhaInicialAdmin) {
    const verificarBackup = () => criarBackup(banco, 'automatico').catch((erro) => console.error('Não foi possível criar o backup diário:', erro));
    servidor.once('listening', verificarBackup);
    const relogioBackup = setInterval(verificarBackup, 60 * 60 * 1000);
    relogioBackup.unref();
  }
  return servidor;
}

module.exports = { criarServidorAssis };
