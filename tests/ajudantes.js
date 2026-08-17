const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { criarServidorAssis } = require('../back-end/servidor');

async function iniciarAplicacaoDeTeste() {
  const diretorio = await mkdtemp(path.join(tmpdir(), 'assis-teste-'));
  const servidor = criarServidorAssis({
    diretorioDados: diretorio,
    senhaInicialAdmin: 'senha-de-teste',
  });

  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const porta = servidor.address().port;

  return {
    url: `http://127.0.0.1:${porta}`,
    diretorio,
    async encerrar() {
      await new Promise((resolve, reject) => {
        servidor.close((erro) => (erro ? reject(erro) : resolve()));
      });
      await rm(diretorio, { recursive: true, force: true });
    },
  };
}

function criarCliente(urlBase) {
  let cookie = '';

  return {
    async requisitar(caminho, opcoes = {}) {
      const cabecalhos = { ...opcoes.headers };
      if (opcoes.body && !cabecalhos['content-type']) {
        cabecalhos['content-type'] = 'application/json';
      }
      if (cookie) cabecalhos.cookie = cookie;

      const resposta = await fetch(`${urlBase}${caminho}`, {
        ...opcoes,
        headers: cabecalhos,
      });
      const recebido = resposta.headers.get('set-cookie');
      if (recebido) cookie = recebido.split(';', 1)[0];

      const tipo = resposta.headers.get('content-type') || '';
      const corpo = tipo.includes('application/json')
        ? await resposta.json()
        : await resposta.text();
      return { status: resposta.status, corpo, headers: resposta.headers };
    },
  };
}

module.exports = { criarCliente, iniciarAplicacaoDeTeste };
