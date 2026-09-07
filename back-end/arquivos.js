const { readFileSync } = require('node:fs');
const path = require('node:path');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function lerAsset(nome) {
  try {
    const sea = require('node:sea');
    if (sea.isSea()) return Buffer.from(sea.getAsset(nome));
  } catch {
    // Em desenvolvimento não existe um executável SEA, então seguimos lendo a pasta normalmente.
  }
  return readFileSync(path.join(__dirname, '..', 'front-end', nome));
}

function servirArquivo(requisicao, resposta, caminhoUrl) {
  const nome = caminhoUrl === '/' ? 'index.html' : decodeURIComponent(caminhoUrl.slice(1));
  // A lista explícita impede que uma URL tente ler arquivos fora da pasta do frontend.
  const permitidos = new Set([
    'index.html', 'style.css', 'reset.css', 'script.js', 'imagemlogo.webp',
    'fonts/atkinson-regular.woff2', 'fonts/atkinson-bold.woff2', 'fonts/germania-one.woff2',
  ]);
  if (!permitidos.has(nome)) return false;
  try {
    const conteudo = lerAsset(nome);
    const mutavel = ['.html', '.css', '.js'].includes(path.extname(nome));
    resposta.writeHead(200, {
      'content-type': TIPOS[path.extname(nome)] || 'application/octet-stream',
      'content-length': conteudo.length,
      // HTML, CSS e JavaScript mudam durante a manutenção local. Não os guardar
      // evita que a tela continue executando uma versão anterior após a atualização.
      'cache-control': mutavel ? 'no-store' : 'public, max-age=86400',
      'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    resposta.end(conteudo);
    return true;
  } catch {
    return false;
  }
}

module.exports = { servirArquivo };
