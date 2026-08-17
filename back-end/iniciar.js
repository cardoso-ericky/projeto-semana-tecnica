const { homedir } = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { criarServidorAssis } = require('./servidor');

const PORTA = 47831;
const URL = `http://127.0.0.1:${PORTA}`;

function diretorioDoAssis() {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local'), 'Assis');
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share'), 'Assis');
}

function abrirNavegador() {
  const comando = process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const argumentos = process.platform === 'win32' ? ['/c', 'start', '', URL] : [URL];
  const filho = spawn(comando, argumentos, { detached: true, stdio: 'ignore', windowsHide: true });
  filho.unref();
}

async function instanciaJaExiste() {
  try {
    const resposta = await fetch(`${URL}/api/saude`, { signal: AbortSignal.timeout(1200) });
    return resposta.ok;
  } catch {
    return false;
  }
}

async function iniciar() {
  if (await instanciaJaExiste()) {
    abrirNavegador();
    return;
  }

  const servidor = criarServidorAssis({ diretorioDados: path.join(diretorioDoAssis(), 'data') });
  servidor.once('error', async (erro) => {
    if (erro.code === 'EADDRINUSE' && await instanciaJaExiste()) {
      abrirNavegador();
      return;
    }
    console.error('Não foi possível iniciar o Assis:', erro);
    process.exitCode = 1;
  });
  servidor.listen(PORTA, '127.0.0.1', abrirNavegador);
}

if (require.main === module) iniciar();

module.exports = { iniciar };
