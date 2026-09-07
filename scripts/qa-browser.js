const { spawn } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { criarServidorAssis } = require('../back-end/servidor');

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function executar() {
  const porta = 9225;
  const perfilTemporario = mkdtempSync(path.join(tmpdir(), 'assis-chrome-'));
  const dadosTemporarios = mkdtempSync(path.join(tmpdir(), 'assis-browser-qa-'));
  const servidor = criarServidorAssis({ diretorioDados: dadosTemporarios, senhaInicialAdmin: 'senha-de-teste' });
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(4173, '127.0.0.1', resolve);
  });
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', `--remote-debugging-port=${porta}`,
    `--user-data-dir=${perfilTemporario}`, '--window-size=1440,1000', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let pagina;
    for (let tentativa = 0; tentativa < 30; tentativa++) {
      try {
        const paginas = await fetch(`http://127.0.0.1:${porta}/json/list`).then((resposta) => resposta.json());
        pagina = paginas.find((item) => item.type === 'page');
        if (pagina) break;
      } catch { /* O Chrome ainda está iniciando. */ }
      await esperar(100);
    }
    if (!pagina) throw new Error('Chrome não iniciou para o QA.');

    const socket = new WebSocket(pagina.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let proximoId = 1;
    const pendentes = new Map();
    const problemas = [];
    const externos = [];
    socket.onmessage = ({ data }) => {
      const mensagem = JSON.parse(data);
      if (mensagem.id && pendentes.has(mensagem.id)) {
        const { resolve, reject } = pendentes.get(mensagem.id); pendentes.delete(mensagem.id);
        mensagem.error ? reject(new Error(mensagem.error.message)) : resolve(mensagem.result);
      }
      if (mensagem.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(mensagem.params.type)) problemas.push(mensagem.params.args.map((item) => item.value || item.description).join(' '));
      if (mensagem.method === 'Network.loadingFailed') problemas.push(`Rede: ${mensagem.params.errorText}`);
      if (mensagem.method === 'Network.requestWillBeSent' && !mensagem.params.request.url.startsWith('http://127.0.0.1:4173') && !mensagem.params.request.url.startsWith('data:')) externos.push(mensagem.params.request.url);
    };
    const enviar = (method, params = {}) => new Promise((resolve, reject) => {
      const id = proximoId++; pendentes.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const avaliar = async (expression) => (await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
    const foto = async (nome) => {
      const { data } = await enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const pasta = path.join(process.cwd(), '.scratch', 'qa'); mkdirSync(pasta, { recursive: true });
      writeFileSync(path.join(pasta, nome), Buffer.from(data, 'base64'));
    };

    await Promise.all([enviar('Page.enable'), enviar('Runtime.enable'), enviar('Network.enable')]);
    await enviar('Page.navigate', { url: 'http://127.0.0.1:4173' }); await esperar(600);
    await foto('login-desktop.png');
    const loginVisivel = await avaliar("!document.querySelector('#tela-login').hidden");
    await avaliar(`(() => { document.querySelector('[name=usuario]').value='biblioteca-regente'; document.querySelector('[name=senha]').value='senha-incorreta'; document.querySelector('#form-login').requestSubmit(); })()`);
    for (let i = 0; i < 20 && !await avaliar("document.querySelector('#erro-login').textContent.length > 0"); i++) await esperar(100);
    const loginInvalidoAvisou = await avaliar("document.querySelector('#erro-login').textContent.includes('incorretos')");
    await avaliar(`(() => { document.querySelector('[name=usuario]').value='biblioteca-regente'; document.querySelector('[name=senha]').value='senha-de-teste'; document.querySelector('#form-login').requestSubmit(); })()`);
    for (let i = 0; i < 30 && !await avaliar("!document.querySelector('#aplicacao').hidden"); i++) await esperar(100);
    const loginConcluido = await avaliar("!document.querySelector('#aplicacao').hidden");
    if (!loginConcluido) throw new Error(`Login não abriu a aplicação: ${await avaliar("document.querySelector('#erro-login').textContent")}`);
    await esperar(300); await foto('inicio-desktop.png');
    const temaAlternado = await avaliar(`(() => { const botao=document.querySelector('#alternar-tema'); botao.click(); const resultado=document.documentElement.dataset.tema==='escuro' && botao.getAttribute('aria-checked')==='true' && botao.getAttribute('aria-label')==='Ativar tema claro'; botao.click(); return resultado; })()`);

    const navegacao = {};
    for (const paginaNome of ['emprestar', 'emprestimos', 'pendencias', 'livros', 'leitores', 'turmas', 'auxiliares', 'backups', 'configuracoes']) {
      await avaliar(`document.querySelector('[data-pagina="${paginaNome}"]').click()`); await esperar(250);
      navegacao[paginaNome] = await avaliar(`({
        titulo: document.querySelector('#titulo-pagina').textContent,
        erro: document.querySelector('#conteudo').textContent.includes('Não foi possível abrir esta página'),
        novosEmprestimosVisiveis: [...document.querySelectorAll('button')].filter((botao) =>
          botao.textContent.includes('Novo empréstimo') && (botao.offsetWidth || botao.offsetHeight)
        ).length,
      })`);
    }
    const acoesSemDuplicacao = Object.entries(navegacao).every(([paginaNome, dados]) =>
      dados.novosEmprestimosVisiveis === (paginaNome === 'emprestar' ? 0 : 1));
    if (!acoesSemDuplicacao) throw new Error(`Ação Novo empréstimo repetida: ${JSON.stringify(navegacao)}`);
    const statusSistema = await avaliar("document.querySelector('#status-sistema')?.textContent.trim() === 'Integridade do sistema ok. A instalação ocorreu com sucesso.'");
    await foto('configuracoes-desktop.png');
    await avaliar("document.querySelector('#reiniciar-reparar').click()"); await esperar(50);
    const reparoProtegido = await avaliar("document.querySelector('#confirmar-reparo').disabled && document.querySelector('#modal-corpo').textContent.includes('Todos os dados atuais serão apagados')");
    await avaliar("document.querySelector('#fechar-modal').click()");

    const marca = Date.now();
    const esperarAte = async (expressao) => { for (let i = 0; i < 40; i++) { if (await avaliar(expressao)) return true; await esperar(100); } return false; };
    await avaliar("document.querySelector('[data-pagina=\"turmas\"]').click()"); await esperarAte("!!document.querySelector('#nova-turma')");
    await avaliar(`document.querySelector('#nova-turma').click()`); await esperarAte("!!document.querySelector('#form-turma')");
    await avaliar(`(() => { const f=document.querySelector('#form-turma'); f.nome.value='QA ${marca}'; f.turno.value='Manhã'; f.anoLetivo.value='2026'; f.requestSubmit(); })()`);
    const turmaCriada = await esperarAte(`document.querySelector('#conteudo').textContent.includes('QA ${marca}')`);

    await avaliar("document.querySelector('[data-pagina=\"leitores\"]').click()"); await esperarAte("!!document.querySelector('#novo-leitor')");
    await avaliar("document.querySelector('#novo-leitor').click()"); await esperarAte("!!document.querySelector('#form-leitor')");
    await avaliar(`(() => { const f=document.querySelector('#form-leitor'); f.tipo.value='aluno'; f.tipo.dispatchEvent(new Event('change')); f.nome.value='Leitora QA ${marca}'; f.turmaId.value=[...f.turmaId.options].find(o=>o.textContent.includes('QA ${marca}')).value; f.requestSubmit(); })()`);
    const leitorCriado = await esperarAte(`document.querySelector('#conteudo').textContent.includes('Leitora QA ${marca}')`);

    await avaliar("document.querySelector('[data-pagina=\"livros\"]').click()"); await esperarAte("!!document.querySelector('#novo-livro')");
    await avaliar("document.querySelector('#novo-livro').click()"); await esperarAte("!!document.querySelector('#form-livro')");
    await avaliar(`(() => { const f=document.querySelector('#form-livro'); f.titulo.value='Livro QA ${marca}'; f.autor.value='Autoria Escolar'; f.codigos.value='QA-${marca}'; f.semCodigo.value='0'; f.requestSubmit(); })()`);
    const livroCriado = await esperarAte(`document.querySelector('#conteudo').textContent.includes('Livro QA ${marca}')`);

    await avaliar("document.querySelector('[data-pagina=\"emprestar\"]').click()"); await esperarAte("!!document.querySelector('#form-emprestimo')");
    await esperar(150); await avaliar("(() => { const campo=document.querySelector('#busca-leitor'); campo.focus(); campo.value='Leitora'; campo.dispatchEvent(new Event('input',{bubbles:true})); })()"); await esperar(100); await foto('emprestar-busca-desktop.png');
    await avaliar(`(() => { const tecla=(campo,key)=>campo.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})); const leitor=document.querySelector('#busca-leitor'); leitor.value='Leitora QA ${marca}'; leitor.dispatchEvent(new Event('input',{bubbles:true})); tecla(leitor,'ArrowDown'); tecla(leitor,'Enter'); const exemplar=document.querySelector('#busca-exemplar'); exemplar.focus(); exemplar.value='Livro QA ${marca}'; exemplar.dispatchEvent(new Event('input',{bubbles:true})); tecla(exemplar,'ArrowDown'); tecla(exemplar,'Enter'); document.querySelector('#form-emprestimo').requestSubmit(); })()`);
    await esperarAte("!document.querySelector('#confirmacao').hidden"); await avaliar("document.querySelector('#aceitar-confirmacao').click()");
    const emprestimoCriado = await esperarAte(`document.querySelector('#conteudo').textContent.includes('Livro QA ${marca}') && !!document.querySelector('[data-emprestimo="devolver"]')`);
    await avaliar("document.querySelector('[data-emprestimo=\"devolver\"]').click()"); await esperarAte("!document.querySelector('#confirmacao').hidden"); await avaliar("document.querySelector('#aceitar-confirmacao').click()");
    const devolucaoConcluida = await esperarAte("document.querySelector('#conteudo').textContent.includes('Nenhum empréstimo ativo')");
    const fluxo = { turmaCriada, leitorCriado, livroCriado, emprestimoCriado, devolucaoConcluida };

    await avaliar("document.querySelector('[data-pagina=\"inicio\"]').click()"); await esperar(250);
    await enviar('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }); await esperar(200);
    await foto('inicio-mobile.png');
    const largura = await avaliar("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})");
    socket.close();
    process.stdout.write(JSON.stringify({ loginVisivel, loginInvalidoAvisou, loginConcluido, temaAlternado, statusSistema, reparoProtegido, acoesSemDuplicacao, navegacao, fluxo, largura, problemas, externos }, null, 2));
  } finally {
    chrome.kill('SIGTERM');
    await esperar(200);
    await new Promise((resolve) => servidor.close(resolve));
    rmSync(perfilTemporario, { recursive: true, force: true });
    rmSync(dadosTemporarios, { recursive: true, force: true });
  }
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; });
