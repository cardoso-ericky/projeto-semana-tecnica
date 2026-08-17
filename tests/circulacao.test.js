const { afterEach, beforeEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { criarCliente, iniciarAplicacaoDeTeste } = require('./ajudantes');

async function prepararCenario(url) {
  const cliente = criarCliente(url);
  await cliente.requisitar('/api/sessao', {
    method: 'POST', body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
  });
  const turma = await cliente.requisitar('/api/turmas', {
    method: 'POST', body: JSON.stringify({ nome: '1º C', turno: 'Manhã', anoLetivo: 2026 }),
  });
  const leitor = await cliente.requisitar('/api/leitores', {
    method: 'POST', body: JSON.stringify({ tipo: 'aluno', nome: 'Maria Oliveira', turmaId: turma.corpo.turma.id }),
  });
  const livro = await cliente.requisitar('/api/livros', {
    method: 'POST', body: JSON.stringify({ titulo: 'Capitães da Areia', autor: 'Jorge Amado', codigosExemplares: ['CA-01'] }),
  });
  return { cliente, leitor: leitor.corpo.leitor, livro: livro.corpo.livro, exemplar: livro.corpo.livro.exemplares[0] };
}

describe('circulação de livros', () => {
  let aplicacao;
  let cenario;

  beforeEach(async () => {
    aplicacao = await iniciarAplicacaoDeTeste();
    cenario = await prepararCenario(aplicacao.url);
  });
  afterEach(async () => aplicacao.encerrar());

  test('empresta, impede uma segunda saída e registra a devolução', async () => {
    const emprestado = await cenario.cliente.requisitar('/api/emprestimos', {
      method: 'POST',
      body: JSON.stringify({ leitorId: cenario.leitor.id, exemplarId: cenario.exemplar.id, dataSaida: '2026-08-16' }),
    });
    assert.equal(emprestado.status, 201);
    assert.equal(emprestado.corpo.emprestimo.dataPrevista, '2026-08-23');
    assert.equal(emprestado.corpo.emprestimo.emprestadoPor.nome, 'Biblioteca Regente');

    const repetido = await cenario.cliente.requisitar('/api/emprestimos', {
      method: 'POST', body: JSON.stringify({ leitorId: cenario.leitor.id, exemplarId: cenario.exemplar.id }),
    });
    assert.equal(repetido.status, 409);

    const devolvido = await cenario.cliente.requisitar(`/api/emprestimos/${emprestado.corpo.emprestimo.id}/devolucao`, {
      method: 'POST', body: JSON.stringify({}),
    });
    assert.equal(devolvido.status, 200);
    assert.equal(devolvido.corpo.emprestimo.status, 'devolvido');
    assert.equal(devolvido.corpo.emprestimo.devolvidoPor.nome, 'Biblioteca Regente');

    const disponiveis = await cenario.cliente.requisitar('/api/livros/disponiveis?busca=CA-01');
    assert.equal(disponiveis.corpo.livros[0].quantidadeDisponivel, 1);

    const historico = await cenario.cliente.requisitar(`/api/leitores/${cenario.leitor.id}/historico`);
    assert.equal(historico.corpo.emprestimos.length, 1);
    assert.equal(historico.corpo.emprestimos[0].status, 'devolvido');
  });

  test('perda continua pendente e só encerra com justificativa', async () => {
    const criado = await cenario.cliente.requisitar('/api/emprestimos', {
      method: 'POST',
      body: JSON.stringify({
        leitorId: cenario.leitor.id, exemplarId: cenario.exemplar.id,
        dataSaida: '2026-08-01', dataPrevista: '2026-08-08',
      }),
    });
    const id = criado.corpo.emprestimo.id;
    const ocorrencia = await cenario.cliente.requisitar(`/api/emprestimos/${id}/ocorrencia`, {
      method: 'POST', body: JSON.stringify({ tipo: 'perdido' }),
    });
    assert.equal(ocorrencia.status, 200);
    assert.equal(ocorrencia.corpo.emprestimo.status, 'ativo');
    assert.equal(ocorrencia.corpo.emprestimo.exemplar.estado, 'perdido');

    const pendencias = await cenario.cliente.requisitar('/api/pendencias?hoje=2026-08-16');
    assert.equal(pendencias.corpo.leitores[0].emprestimos[0].ocorrencia, 'perdido');

    const semMotivo = await cenario.cliente.requisitar(`/api/emprestimos/${id}/encerramento`, {
      method: 'POST', body: JSON.stringify({ justificativa: '' }),
    });
    assert.equal(semMotivo.status, 422);

    const encerrado = await cenario.cliente.requisitar(`/api/emprestimos/${id}/encerramento`, {
      method: 'POST', body: JSON.stringify({ justificativa: 'Família comunicou que não encontrou o livro.' }),
    });
    assert.equal(encerrado.status, 200);
    assert.equal(encerrado.corpo.emprestimo.status, 'encerrado_sem_devolucao');

    const livro = await cenario.cliente.requisitar(`/api/livros/${cenario.livro.id}`);
    assert.equal(livro.corpo.livro.quantidadeDisponivel, 0);
    assert.equal(livro.corpo.livro.exemplares[0].estado, 'perdido');
  });

  test('alterar prazo, desfazer devolução e cancelar preserva todos os eventos', async () => {
    const criado = await cenario.cliente.requisitar('/api/emprestimos', {
      method: 'POST', body: JSON.stringify({ leitorId: cenario.leitor.id, exemplarId: cenario.exemplar.id, dataSaida: '2026-08-16' }),
    });
    const id = criado.corpo.emprestimo.id;
    const prazo = await cenario.cliente.requisitar(`/api/emprestimos/${id}/prazo`, {
      method: 'PUT', body: JSON.stringify({ dataPrevista: '2026-08-30' }),
    });
    assert.equal(prazo.corpo.emprestimo.dataPrevista, '2026-08-30');
    await cenario.cliente.requisitar(`/api/emprestimos/${id}/devolucao`, { method: 'POST', body: '{}' });
    const desfeito = await cenario.cliente.requisitar(`/api/emprestimos/${id}/desfazer-devolucao`, { method: 'POST', body: '{}' });
    assert.equal(desfeito.corpo.emprestimo.status, 'ativo');
    const cancelado = await cenario.cliente.requisitar(`/api/emprestimos/${id}/cancelamento`, { method: 'POST', body: '{}' });
    assert.equal(cancelado.corpo.emprestimo.status, 'cancelado');

    const historico = await cenario.cliente.requisitar(`/api/leitores/${cenario.leitor.id}/historico`);
    assert.deepEqual(historico.corpo.emprestimos[0].eventos.map((evento) => evento.tipo), [
      'criacao', 'mudanca_prazo', 'devolucao', 'desfazer_devolucao', 'cancelamento',
    ]);
  });
});
