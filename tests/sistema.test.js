const { afterEach, beforeEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { criarCliente, iniciarAplicacaoDeTeste } = require('./ajudantes');

describe('integridade e reparo do sistema', () => {
  let aplicacao;
  let admin;

  beforeEach(async () => {
    aplicacao = await iniciarAplicacaoDeTeste();
    admin = criarCliente(aplicacao.url);
    await admin.requisitar('/api/sessao', {
      method: 'POST', body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
    });
  });

  afterEach(async () => aplicacao.encerrar());

  test('não reutiliza versões antigas dos arquivos da interface', async () => {
    for (const caminho of ['/', '/reset.css', '/style.css', '/script.js']) {
      const resposta = await admin.requisitar(caminho);
      assert.equal(resposta.status, 200);
      assert.equal(resposta.headers.get('cache-control'), 'no-store');
    }
  });

  test('informa apenas o resultado público da verificação de integridade', async () => {
    const resposta = await admin.requisitar('/api/sistema/status');
    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.corpo, {
      integro: true,
      mensagem: 'Integridade do sistema ok. A instalação ocorreu com sucesso.',
    });
  });

  test('somente a administradora acessa as configurações do sistema', async () => {
    await admin.requisitar('/api/usuarios', {
      method: 'POST', body: JSON.stringify({ nome: 'Ana Auxiliar', usuario: 'ana', senha: 'senha-da-ana' }),
    });
    const auxiliar = criarCliente(aplicacao.url);
    await auxiliar.requisitar('/api/sessao', {
      method: 'POST', body: JSON.stringify({ usuario: 'ana', senha: 'senha-da-ana' }),
    });
    assert.equal((await auxiliar.requisitar('/api/sistema/status')).status, 403);
    assert.equal((await auxiliar.requisitar('/api/sistema/reparar', {
      method: 'POST', body: JSON.stringify({ senha: 'senha-da-ana', confirmacao: 'REINICIAR' }),
    })).status, 403);
  });

  test('reparo exige confirmação e senha, cria backup e reinstala um banco limpo', async () => {
    await admin.requisitar('/api/turmas', {
      method: 'POST', body: JSON.stringify({ nome: '2º A', turno: 'Manhã', anoLetivo: 2026 }),
    });

    assert.equal((await admin.requisitar('/api/sistema/reparar', {
      method: 'POST', body: JSON.stringify({ senha: 'senha-de-teste', confirmacao: 'apagar' }),
    })).status, 422);
    assert.equal((await admin.requisitar('/api/sistema/reparar', {
      method: 'POST', body: JSON.stringify({ senha: 'senha-errada', confirmacao: 'REINICIAR' }),
    })).status, 422);

    const reparado = await admin.requisitar('/api/sistema/reparar', {
      method: 'POST', body: JSON.stringify({ senha: 'senha-de-teste', confirmacao: 'REINICIAR' }),
    });
    assert.equal(reparado.status, 200);
    assert.equal(reparado.corpo.reparado, true);
    assert.match(reparado.corpo.backup, /^pre-reparo-.+\.sqlite$/);
    assert.equal((await admin.requisitar('/api/sessao')).status, 401);

    const novoAdmin = criarCliente(aplicacao.url);
    assert.equal((await novoAdmin.requisitar('/api/sessao', {
      method: 'POST', body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
    })).status, 200);
    assert.deepEqual((await novoAdmin.requisitar('/api/turmas')).corpo.turmas, []);
    assert.equal((await novoAdmin.requisitar('/api/sistema/status')).corpo.integro, true);
    assert.equal((await novoAdmin.requisitar('/api/backups')).corpo.backups[0].tipo, 'Antes do reparo');
  });
});
