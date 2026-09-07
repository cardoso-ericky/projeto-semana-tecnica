const { afterEach, beforeEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { criarCliente, iniciarAplicacaoDeTeste } = require('./ajudantes');

describe('login e usuários locais', () => {
  let aplicacao;

  beforeEach(async () => {
    aplicacao = await iniciarAplicacaoDeTeste();
  });

  afterEach(async () => {
    await aplicacao.encerrar();
  });

  test('o administrador inicial entra, consulta a sessão e sai', async () => {
    const cliente = criarCliente(aplicacao.url);

    const negado = await cliente.requisitar('/api/sessao', {
      method: 'POST',
      body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'errada' }),
    });
    assert.equal(negado.status, 401);

    const login = await cliente.requisitar('/api/sessao', {
      method: 'POST',
      body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
    });
    assert.equal(login.status, 200);
    assert.equal(login.corpo.usuario.perfil, 'administrador');
    assert.equal(login.corpo.usuario.usuario, 'biblioteca-regente');

    const sessao = await cliente.requisitar('/api/sessao');
    assert.equal(sessao.status, 200);
    assert.equal(sessao.corpo.usuario.nome, 'Biblioteca Regente');

    const saida = await cliente.requisitar('/api/sessao', { method: 'DELETE' });
    assert.equal(saida.status, 204);
    assert.equal((await cliente.requisitar('/api/sessao')).status, 401);
  });

  test('somente o administrador cadastra auxiliares', async () => {
    const admin = criarCliente(aplicacao.url);
    await admin.requisitar('/api/sessao', {
      method: 'POST',
      body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
    });

    const criado = await admin.requisitar('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Ana Auxiliar',
        usuario: 'ana',
        senha: 'senha-da-ana',
      }),
    });
    assert.equal(criado.status, 201);
    assert.equal(criado.corpo.usuario.perfil, 'auxiliar');

    const auxiliar = criarCliente(aplicacao.url);
    const login = await auxiliar.requisitar('/api/sessao', {
      method: 'POST',
      body: JSON.stringify({ usuario: 'ana', senha: 'senha-da-ana' }),
    });
    assert.equal(login.status, 200);

    const proibido = await auxiliar.requisitar('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Outro', usuario: 'outro', senha: '12345678' }),
    });
    assert.equal(proibido.status, 403);

    const lista = await admin.requisitar('/api/usuarios');
    assert.equal(lista.status, 200);
    assert.deepEqual(
      lista.corpo.usuarios.map((usuario) => usuario.usuario),
      ['biblioteca-regente', 'ana'],
    );
    assert.equal('senha' in lista.corpo.usuarios[1], false);
  });

  test('desativação encerra a sessão e a administradora pode redefinir a senha', async () => {
    const admin = criarCliente(aplicacao.url);
    await admin.requisitar('/api/sessao', { method: 'POST', body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }) });
    const criado = await admin.requisitar('/api/usuarios', {
      method: 'POST', body: JSON.stringify({ nome: 'Bia Auxiliar', usuario: 'bia', senha: 'senha-antiga' }),
    });
    const id = criado.corpo.usuario.id;
    const bia = criarCliente(aplicacao.url);
    await bia.requisitar('/api/sessao', { method: 'POST', body: JSON.stringify({ usuario: 'bia', senha: 'senha-antiga' }) });

    await admin.requisitar(`/api/usuarios/${id}`, {
      method: 'PUT', body: JSON.stringify({ nome: 'Bia Auxiliar', usuario: 'bia', ativo: false }),
    });
    assert.equal((await bia.requisitar('/api/sessao')).status, 401);

    await admin.requisitar(`/api/usuarios/${id}`, {
      method: 'PUT', body: JSON.stringify({ nome: 'Bia Auxiliar', usuario: 'bia', ativo: true }),
    });
    await admin.requisitar(`/api/usuarios/${id}/senha`, {
      method: 'PUT', body: JSON.stringify({ senha: 'senha-nova-segura' }),
    });
    assert.equal((await criarCliente(aplicacao.url).requisitar('/api/sessao', { method: 'POST', body: JSON.stringify({ usuario: 'bia', senha: 'senha-antiga' }) })).status, 401);
    assert.equal((await criarCliente(aplicacao.url).requisitar('/api/sessao', { method: 'POST', body: JSON.stringify({ usuario: 'bia', senha: 'senha-nova-segura' }) })).status, 200);
  });
});
