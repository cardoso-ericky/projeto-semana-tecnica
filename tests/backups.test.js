const { afterEach, beforeEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { criarCliente, iniciarAplicacaoDeTeste } = require('./ajudantes');

describe('cópias de segurança', () => {
  let aplicacao;
  let cliente;

  beforeEach(async () => {
    aplicacao = await iniciarAplicacaoDeTeste();
    cliente = criarCliente(aplicacao.url);
    await cliente.requisitar('/api/sessao', {
      method: 'POST',
      body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
    });
  });
  afterEach(async () => aplicacao.encerrar());

  test('cria, lista e exporta um backup manual', async () => {
    const criado = await cliente.requisitar('/api/backups', { method: 'POST', body: '{}' });
    assert.equal(criado.status, 201);
    assert.match(criado.corpo.nome, /^manual-.+\.sqlite$/);

    const lista = await cliente.requisitar('/api/backups');
    assert.equal(lista.status, 200);
    assert.equal(lista.corpo.backups[0].nome, criado.corpo.nome);

    const arquivo = await cliente.requisitar(`/api/backups/${encodeURIComponent(criado.corpo.nome)}`);
    assert.equal(arquivo.status, 200);
    assert.equal(arquivo.headers.get('content-type'), 'application/octet-stream');
    assert.ok(arquivo.corpo.length > 100);
  });

  test('rejeita arquivo inválido sem derrubar o banco atual', async () => {
    const restauracao = await cliente.requisitar('/api/backups/restaurar', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.from('isto não é um banco sqlite'),
    });
    assert.equal(restauracao.status, 422);
    assert.equal((await cliente.requisitar('/api/sessao')).status, 200);
  });
});
