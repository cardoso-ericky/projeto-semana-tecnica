const { afterEach, beforeEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { criarCliente, iniciarAplicacaoDeTeste } = require('./ajudantes');

async function clienteAutenticado(url) {
  const cliente = criarCliente(url);
  await cliente.requisitar('/api/sessao', {
    method: 'POST',
    body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
  });
  return cliente;
}

describe('cadastros da biblioteca', () => {
  let aplicacao;
  let cliente;

  beforeEach(async () => {
    aplicacao = await iniciarAplicacaoDeTeste();
    cliente = await clienteAutenticado(aplicacao.url);
  });

  afterEach(async () => aplicacao.encerrar());

  test('cadastra uma turma válida e impede a combinação duplicada', async () => {
    const dados = { nome: '1º A', turno: 'Manhã', anoLetivo: 2026 };
    const criada = await cliente.requisitar('/api/turmas', {
      method: 'POST', body: JSON.stringify(dados),
    });
    assert.equal(criada.status, 201);
    assert.equal(criada.corpo.turma.turno, 'Manhã');

    const duplicada = await cliente.requisitar('/api/turmas', {
      method: 'POST', body: JSON.stringify(dados),
    });
    assert.equal(duplicada.status, 409);

    const turnoInvalido = await cliente.requisitar('/api/turmas', {
      method: 'POST', body: JSON.stringify({ ...dados, turno: 'Madrugada' }),
    });
    assert.equal(turnoInvalido.status, 422);
  });

  test('cadastra e edita um aluno sem perder sua identidade', async () => {
    const turma = await cliente.requisitar('/api/turmas', {
      method: 'POST',
      body: JSON.stringify({ nome: '1º B', turno: 'Tarde', anoLetivo: 2026 }),
    });
    const criado = await cliente.requisitar('/api/leitores', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'aluno', nome: 'João da Silva', identificador: 'A-10',
        telefone: '(42) 99999-0000', turmaId: turma.corpo.turma.id,
      }),
    });
    assert.equal(criado.status, 201);
    assert.equal(criado.corpo.leitor.turma.nome, '1º B');

    const editado = await cliente.requisitar(`/api/leitores/${criado.corpo.leitor.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        tipo: 'aluno', nome: 'João Pedro da Silva', identificador: 'A-10',
        telefone: '', turmaId: turma.corpo.turma.id,
      }),
    });
    assert.equal(editado.status, 200);
    assert.equal(editado.corpo.leitor.id, criado.corpo.leitor.id);
    assert.equal(editado.corpo.leitor.nome, 'João Pedro da Silva');

    const busca = await cliente.requisitar('/api/leitores?busca=A-10&tipo=aluno');
    assert.equal(busca.corpo.leitores.length, 1);
    assert.equal(busca.corpo.leitores[0].turma.turno, 'Tarde');
  });

  test('cria um livro e seus exemplares, inclusive unidades sem código', async () => {
    const criado = await cliente.requisitar('/api/livros', {
      method: 'POST',
      body: JSON.stringify({
        titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Romance',
        codigosExemplares: ['DC-01', '', null],
      }),
    });
    assert.equal(criado.status, 201);
    assert.equal(criado.corpo.livro.quantidadeTotal, 3);
    assert.equal(criado.corpo.livro.quantidadeDisponivel, 3);
    assert.deepEqual(criado.corpo.livro.exemplares.map((item) => item.codigo), ['DC-01', null, null]);

    const repetido = await cliente.requisitar('/api/livros', {
      method: 'POST',
      body: JSON.stringify({
        titulo: 'Outro livro', autor: 'Outra pessoa', codigosExemplares: ['DC-01'],
      }),
    });
    assert.equal(repetido.status, 409);

    const disponiveis = await cliente.requisitar('/api/livros/disponiveis?busca=Machado');
    assert.equal(disponiveis.status, 200);
    assert.equal(disponiveis.corpo.livros[0].quantidadeDisponivel, 3);
  });
});
