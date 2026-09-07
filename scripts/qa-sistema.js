const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { criarCliente, iniciarAplicacaoDeTeste } = require('../tests/ajudantes');

async function executar() {
  const aplicacao = await iniciarAplicacaoDeTeste();
  try {
    const admin = criarCliente(aplicacao.url);
    await admin.requisitar('/api/sessao', {
      method: 'POST', body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
    });
    const status = await admin.requisitar('/api/sistema/status');
    assert.deepEqual(status.corpo, {
      integro: true,
      mensagem: 'Integridade do sistema ok. A instalação ocorreu com sucesso.',
    });
    const banco = new DatabaseSync(path.join(aplicacao.diretorio, 'assis.sqlite'));
    banco.exec('DROP INDEX leitores_identificador_unico');
    banco.close();
    assert.deepEqual((await admin.requisitar('/api/sistema/status')).corpo, {
      integro: false,
      mensagem: 'O sistema foi instalado incorretamente. Confira com a administradora o que aconteceu.',
    });
    const bancoCorrigido = new DatabaseSync(path.join(aplicacao.diretorio, 'assis.sqlite'));
    bancoCorrigido.exec("CREATE UNIQUE INDEX leitores_identificador_unico ON leitores(tipo, identificador) WHERE identificador IS NOT NULL");
    bancoCorrigido.close();
    await admin.requisitar('/api/turmas', {
      method: 'POST', body: JSON.stringify({ nome: '2º A', turno: 'Manhã', anoLetivo: 2026 }),
    });
    assert.equal((await admin.requisitar('/api/sistema/reparar', {
      method: 'POST', body: JSON.stringify({ senha: 'senha-errada', confirmacao: 'REINICIAR' }),
    })).status, 422);
    const reparado = await admin.requisitar('/api/sistema/reparar', {
      method: 'POST', body: JSON.stringify({ senha: 'senha-de-teste', confirmacao: 'REINICIAR' }),
    });
    assert.equal(reparado.status, 200);
    assert.match(reparado.corpo.backup, /^pre-reparo-.+\.sqlite$/);
    assert.equal((await admin.requisitar('/api/sessao')).status, 401);
    const novoAdmin = criarCliente(aplicacao.url);
    assert.equal((await novoAdmin.requisitar('/api/sessao', {
      method: 'POST', body: JSON.stringify({ usuario: 'biblioteca-regente', senha: 'senha-de-teste' }),
    })).status, 200);
    assert.deepEqual((await novoAdmin.requisitar('/api/turmas')).corpo.turmas, []);
    assert.equal((await novoAdmin.requisitar('/api/sistema/status')).corpo.integro, true);
    assert.equal((await novoAdmin.requisitar('/api/backups')).corpo.backups[0].tipo, 'Antes do reparo');
    process.stdout.write(JSON.stringify({ statusSistema: true, falhaDetectadaSemDetalhesTecnicos: true, senhaIncorretaRejeitada: true, backupCriado: true, dadosReinstalados: true, acessoAdministrativoMantido: true }, null, 2));
  } finally {
    await aplicacao.encerrar();
  }
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
