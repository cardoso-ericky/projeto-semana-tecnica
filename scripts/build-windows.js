const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { inject } = require('postject');

const RAIZ = path.join(__dirname, '..');
const BUILD = path.join(RAIZ, 'build');
const DIST = path.join(RAIZ, 'dist', 'windows');
const VERSAO_NODE = '24.19.0';
const HASH_NODE_WINDOWS = '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237';
const MODULOS = ['senhas', 'banco', 'cadastros', 'circulacao', 'arquivos', 'backups', 'servidor', 'iniciar'];
const ASSETS = [
  'index.html', 'reset.css', 'style.css', 'script.js', 'imagemlogo.webp',
  'fonts/atkinson-regular.woff2', 'fonts/atkinson-bold.woff2', 'fonts/germania-one.woff2',
];

function conferirFerramentas() {
  const node = process.versions.node;
  const npm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--version'], { encoding: 'utf8' }).stdout.trim();
  if (node !== VERSAO_NODE || npm !== '11.17.0') {
    throw new Error(`Build congelado exige Node ${VERSAO_NODE} e npm 11.17.0. Recebido: Node ${node}, npm ${npm}.`);
  }
}

function gerarArquivoUnico() {
  const partes = [`
const __modulos = Object.create(null);
const __cache = Object.create(null);
function __definir(nome, fabrica) { __modulos[nome] = fabrica; }
function __carregar(nome) {
  if (__cache[nome]) return __cache[nome].exports;
  const modulo = { exports: {} }; __cache[nome] = modulo;
  __modulos[nome](modulo, modulo.exports, __carregar);
  return modulo.exports;
}
`];
  for (const nome of MODULOS) {
    const caminho = path.join(RAIZ, 'back-end', `${nome}.js`);
    const fonte = readFileSync(caminho, 'utf8').replace(/require\((['"])\.\/([^'"]+)\1\)/g, "__carregar('$2')");
    partes.push(`\n__definir(${JSON.stringify(nome)}, function (module, exports, __carregar) {\n${fonte}\n});\n`);
  }
  partes.push("\n__carregar('iniciar').iniciar();\n");
  const destino = path.join(BUILD, 'assis-sea.js');
  writeFileSync(destino, partes.join(''));
  return destino;
}

async function baixarNodeWindows(destino) {
  if (!existsSync(destino)) {
    const resposta = await fetch(`https://nodejs.org/dist/v${VERSAO_NODE}/win-x64/node.exe`);
    if (!resposta.ok) throw new Error(`Download do Node Windows falhou: HTTP ${resposta.status}.`);
    await pipeline(Readable.fromWeb(resposta.body), require('node:fs').createWriteStream(destino));
  }
  const hash = createHash('sha256').update(readFileSync(destino)).digest('hex');
  if (hash !== HASH_NODE_WINDOWS) throw new Error('O node.exe baixado não corresponde à versão congelada.');
}

function ocultarConsole(executavel) {
  const dados = readFileSync(executavel);
  const inicioPe = dados.readUInt32LE(0x3c);
  const opcional = inicioPe + 24;
  if (dados.readUInt16LE(opcional) !== 0x20b) throw new Error('O executável Windows não é PE x64 como esperado.');
  // O valor 2 seleciona o subsistema gráfico do Windows. Isso evita que uma
  // janela preta apareça para a bibliotecária, embora o programa continue em JS.
  dados.writeUInt16LE(2, opcional + 68);
  writeFileSync(executavel, dados);
}

async function construir() {
  conferirFerramentas();
  mkdirSync(BUILD, { recursive: true }); mkdirSync(DIST, { recursive: true });
  const entrada = gerarArquivoUnico();
  const blob = path.join(BUILD, 'assis.blob');
  const configuracao = {
    main: entrada, output: blob, disableExperimentalSEAWarning: true,
    useSnapshot: false, useCodeCache: false,
    assets: Object.fromEntries(ASSETS.map((nome) => [nome, path.join(RAIZ, 'front-end', nome)])),
  };
  const configPath = path.join(BUILD, 'sea-config.json');
  writeFileSync(configPath, JSON.stringify(configuracao, null, 2));
  const sea = spawnSync(process.execPath, ['--experimental-sea-config', configPath], { stdio: 'inherit' });
  if (sea.status !== 0) throw new Error('O Node não conseguiu gerar o blob SEA.');

  const base = path.join(BUILD, `node-v${VERSAO_NODE}-win-x64.exe`);
  await baixarNodeWindows(base);
  const executavel = path.join(DIST, 'Assis.exe');
  writeFileSync(executavel, readFileSync(base));
  await inject(executavel, 'NODE_SEA_BLOB', readFileSync(blob), {
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  });
  ocultarConsole(executavel);
  const hashFinal = createHash('sha256').update(readFileSync(executavel)).digest('hex');
  writeFileSync(path.join(DIST, 'SHA256SUMS.txt'), `${hashFinal}  Assis.exe\n`);
  console.log(`Executável criado em ${executavel}`);
}

construir().catch((erro) => { console.error(erro.message); process.exitCode = 1; });
