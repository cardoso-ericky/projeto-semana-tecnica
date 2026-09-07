const { createHash } = require('node:crypto');
const { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const script = path.join(raiz, 'installer', 'assis.iss');
const versaoInno = '6.7.3';
const hashInno = '9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732';
const imagemInno = 'amake/innosetup@sha256:e003376ba818547275fe10c95e2a29be0f2d12d45e9eb8f205b6672dc5685bb1';

async function obterInstaladorInno() {
  const destino = path.join(raiz, 'build', `innosetup-${versaoInno}.exe`);
  mkdirSync(path.dirname(destino), { recursive: true });
  if (!existsSync(destino)) {
    const url = `https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-${versaoInno}.exe`;
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`Download do Inno Setup falhou: HTTP ${resposta.status}.`);
    await pipeline(Readable.fromWeb(resposta.body), createWriteStream(destino));
  }
  const hash = createHash('sha256').update(readFileSync(destino)).digest('hex');
  if (hash !== hashInno) throw new Error('O instalador do Inno Setup não corresponde à versão 6.7.3 oficial.');
  return destino;
}

async function compilar() {
  if (process.platform === 'win32') {
    const compilador = process.env.ISCC || 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe';
    if (!existsSync(compilador)) throw new Error('Inno Setup 6.7.3 não encontrado. Defina ISCC com o caminho de ISCC.exe.');
    const resultado = spawnSync(compilador, [script], { cwd: raiz, stdio: 'inherit' });
    if (resultado.status !== 0) throw new Error('A compilação do instalador falhou.');
    registrarHash();
    return;
  }

  const docker = spawnSync('docker', ['version'], { stdio: 'ignore' });
  if (docker.status !== 0) throw new Error('No Linux, o build do instalador precisa do Docker para executar o Inno Setup oficial.');
  const instalador = await obterInstaladorInno();
  const autoridadeX = process.env.XAUTHORITY || `/run/user/${process.getuid()}/gdm/Xauthority`;
  if (!process.env.DISPLAY || !existsSync('/tmp/.X11-unix') || !existsSync(autoridadeX)) {
    throw new Error('O build Linux do Inno Setup precisa de uma sessão gráfica local ativa para o Wine.');
  }
  // O container fornece o Wine; instalamos por cima dele a versão oficial e
  // verificada. Assim o build não depende da versão "latest" da imagem.
  const comando = [
    'wine', `/work/${path.relative(raiz, instalador).replaceAll(path.sep, '/')}`,
    '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '&&',
    '/opt/bin/iscc', '/work/installer/assis.iss',
  ].join(' ');
  const resultado = spawnSync('docker', [
    'run', '--rm', '-v', `${raiz}:/work`, '-v', '/tmp/.X11-unix:/tmp/.X11-unix',
    '-v', `${autoridadeX}:/tmp/assis-Xauthority:ro`, '-e', `DISPLAY=${process.env.DISPLAY}`,
    '-e', 'XAUTHORITY=/tmp/assis-Xauthority', '--entrypoint', 'sh', imagemInno, '-lc', comando,
  ], { cwd: raiz, stdio: 'inherit' });
  if (resultado.status !== 0) throw new Error('A compilação do instalador no container falhou.');
  registrarHash();
}

function registrarHash() {
  const instalador = path.join(raiz, 'dist', 'Instalar Assis.exe');
  const hash = createHash('sha256').update(readFileSync(instalador)).digest('hex');
  writeFileSync(path.join(raiz, 'dist', 'SHA256SUMS.txt'), `${hash}  Instalar Assis.exe\n`);
}

compilar().catch((erro) => { console.error(erro.message); process.exitCode = 1; });
