const { backup, DatabaseSync } = require('node:sqlite');
const { createReadStream, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } = require('node:fs');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');

function nomeData() {
  const agora = new Date();
  const local = new Date(agora - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return local;
}

function pastaDe(banco) {
  const pastaBanco = path.dirname(banco.caminhoAssis);
  const raizDados = path.basename(pastaBanco) === 'data' ? path.dirname(pastaBanco) : pastaBanco;
  const pasta = path.join(raizDados, 'backups');
  mkdirSync(pasta, { recursive: true });
  return pasta;
}

async function criarBackup(banco, tipo = 'manual') {
  const pasta = pastaDe(banco);
  const instante = new Date().toISOString().replaceAll(':', '-').replace('.', '-');
  const nome = tipo === 'automatico' ? `automatico-${nomeData()}.sqlite` : `${tipo}-${instante}.sqlite`;
  const destino = path.join(pasta, nome);
  if (tipo === 'automatico' && existsSync(destino)) return destino;
  await backup(banco, destino);

  if (tipo === 'automatico') {
    const automaticos = readdirSync(pasta).filter((item) => item.startsWith('automatico-')).sort().reverse();
    // Trinta dias são suficientes para este computador escolar e evitam encher o disco sem aviso.
    for (const antigo of automaticos.slice(30)) unlinkSync(path.join(pasta, antigo));
  }
  return destino;
}

function listarBackups(banco) {
  return readdirSync(pastaDe(banco)).filter((nome) => nome.endsWith('.sqlite')).map((nome) => {
    const info = statSync(path.join(pastaDe(banco), nome));
    return {
      nome, tipo: nome.startsWith('automatico-') ? 'Automático' : nome.startsWith('pre-restauracao-') ? 'Antes de restauração' : nome.startsWith('pre-reparo-') ? 'Antes do reparo' : 'Manual',
      criadoEm: info.mtime.toISOString(), tamanho: info.size,
      tamanhoFormatado: info.size < 1024 * 1024 ? `${Math.ceil(info.size / 1024)} KB` : `${(info.size / 1024 / 1024).toFixed(1)} MB`,
    };
  }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

function validarBanco(caminho) {
  let candidato;
  try {
    candidato = new DatabaseSync(caminho, { readOnly: true });
    const integridade = candidato.prepare('PRAGMA integrity_check').get();
    if (integridade.integrity_check !== 'ok') throw new Error('O arquivo está corrompido.');
    const tabelas = new Set(candidato.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((item) => item.name));
    for (const obrigatoria of ['usuarios', 'turmas', 'leitores', 'livros', 'exemplares', 'emprestimos']) {
      if (!tabelas.has(obrigatoria)) throw new Error('O arquivo não é um backup compatível do Assis.');
    }
  } finally {
    candidato?.close();
  }
}

async function tratarBackups(contexto) {
  const { requisicao, resposta, url, banco, lerBuffer, enviarJson, falha, restaurarBanco } = contexto;
  if (url.pathname === '/api/backups' && requisicao.method === 'GET') {
    enviarJson(resposta, 200, { backups: listarBackups(banco) }); return true;
  }
  if (url.pathname === '/api/backups' && requisicao.method === 'POST') {
    const destino = await criarBackup(banco, 'manual');
    enviarJson(resposta, 201, { nome: path.basename(destino) }); return true;
  }
  if (url.pathname === '/api/backups/restaurar' && requisicao.method === 'POST') {
    const temporario = path.join(path.dirname(banco.caminhoAssis), `restaurar-${Date.now()}.sqlite`);
    try {
      await writeFile(temporario, await lerBuffer(requisicao, 512 * 1024 * 1024));
      validarBanco(temporario);
      await criarBackup(banco, 'pre-restauracao');
      await restaurarBanco(temporario);
      enviarJson(resposta, 200, { restaurado: true });
    } catch (erro) {
      if (existsSync(temporario)) unlinkSync(temporario);
      falha(resposta, 422, 'BACKUP_INVALIDO', erro.message || 'O arquivo não pôde ser restaurado.');
    }
    return true;
  }
  const baixar = url.pathname.match(/^\/api\/backups\/([^/]+)$/);
  if (baixar && requisicao.method === 'GET') {
    const nome = decodeURIComponent(baixar[1]);
    if (path.basename(nome) !== nome || !nome.endsWith('.sqlite')) { falha(resposta, 404, 'BACKUP_NAO_ENCONTRADO', 'Backup não encontrado.'); return true; }
    const arquivo = path.join(pastaDe(banco), nome);
    if (!existsSync(arquivo)) { falha(resposta, 404, 'BACKUP_NAO_ENCONTRADO', 'Backup não encontrado.'); return true; }
    resposta.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${nome}"`, 'content-length': statSync(arquivo).size });
    createReadStream(arquivo).pipe(resposta); return true;
  }
  return false;
}

module.exports = { criarBackup, tratarBackups };
