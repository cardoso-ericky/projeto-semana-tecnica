const telaLogin = document.querySelector('#tela-login');
const aplicacao = document.querySelector('#aplicacao');
const conteudo = document.querySelector('#conteudo');
const modal = document.querySelector('#modal');
const estado = { usuario: null, pagina: 'inicio', cache: {} };

const paginas = {
  inicio: ['Início', 'Visão geral da biblioteca'],
  emprestar: ['Novo empréstimo', 'Circulação'],
  emprestimos: ['Livros emprestados', 'Circulação'],
  pendencias: ['Devedores e pendências', 'Circulação'],
  livros: ['Livros e exemplares', 'Acervo'],
  leitores: ['Alunos e leitores', 'Leitores'],
  turmas: ['Turmas', 'Leitores'],
  auxiliares: ['Auxiliares', 'Administração'],
  backups: ['Backups', 'Administração'],
  configuracoes: ['Configurações', 'Administração'],
};

function h(valor) {
  // Todo texto cadastrado passa por aqui antes de entrar no HTML. Assim, um nome
  // com sinais como < ou > continua sendo texto, não vira uma instrução do navegador.
  return String(valor ?? '').replace(/[&<>'"]/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[caractere]));
}

function dataBr(valor) {
  if (!valor) return '—';
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function dataHoraBr(valor) {
  if (!valor) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
}

function hojeLocal() {
  const agora = new Date();
  const compensacao = agora.getTimezoneOffset() * 60000;
  return new Date(agora - compensacao).toISOString().slice(0, 10);
}

async function api(caminho, opcoes = {}) {
  const configuracao = { ...opcoes, headers: { ...opcoes.headers } };
  if (configuracao.body && typeof configuracao.body !== 'string' && !(configuracao.body instanceof Blob)) {
    configuracao.headers['content-type'] = 'application/json';
    configuracao.body = JSON.stringify(configuracao.body);
  }
  const resposta = await fetch(caminho, configuracao);
  if (resposta.status === 401 && caminho !== '/api/sessao') mostrarLogin();
  const tipo = resposta.headers.get('content-type') || '';
  const corpo = resposta.status === 204 ? null : tipo.includes('application/json') ? await resposta.json() : await resposta.text();
  if (!resposta.ok) {
    const erro = new Error(corpo?.error?.message || 'Não foi possível concluir a ação.');
    erro.campos = corpo?.error?.fields || {};
    erro.status = resposta.status;
    throw erro;
  }
  return corpo;
}

function avisar(mensagem, tipo = 'sucesso') {
  const item = document.createElement('div');
  item.className = `aviso ${tipo === 'erro' ? 'aviso--erro' : ''}`;
  item.textContent = mensagem;
  document.querySelector('#avisos').append(item);
  setTimeout(() => item.remove(), 4200);
}

function iniciais(nome) {
  return nome.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
}

function mostrarLogin() {
  estado.usuario = null;
  telaLogin.hidden = false;
  aplicacao.hidden = true;
  document.querySelector('#form-login input').focus();
}

function mostrarAplicacao(usuario) {
  estado.usuario = usuario;
  telaLogin.hidden = true;
  aplicacao.hidden = false;
  document.querySelector('#nome-usuario').textContent = usuario.nome;
  document.querySelector('#perfil-usuario').textContent = usuario.perfil === 'administrador' ? 'Administradora' : 'Auxiliar';
  document.querySelector('#avatar-usuario').textContent = iniciais(usuario.nome);
  document.querySelector('#nav-admin').hidden = usuario.perfil !== 'administrador';
  navegar(estado.pagina);
}

async function navegar(pagina) {
  if (!paginas[pagina]) pagina = 'inicio';
  if (['auxiliares', 'backups', 'configuracoes'].includes(pagina) && estado.usuario?.perfil !== 'administrador') pagina = 'inicio';
  estado.pagina = pagina;
  const [titulo, contexto] = paginas[pagina];
  document.querySelector('#titulo-pagina').textContent = titulo;
  document.querySelector('#contexto-pagina').textContent = contexto;
  // A ação global não precisa aparecer quando o formulário já está aberto.
  document.querySelector('#novo-emprestimo-global').hidden = pagina === 'emprestar';
  document.querySelectorAll('[data-pagina]').forEach((botao) => botao.classList.toggle('ativo', botao.dataset.pagina === pagina));
  document.querySelector('#barra-lateral').classList.remove('aberta');
  conteudo.innerHTML = '<div class="carregando">Consultando os registros…</div>';
  try {
    await ({
      inicio: renderInicio, emprestar: renderEmprestar, emprestimos: renderEmprestimos,
      pendencias: renderPendencias, livros: renderLivros, leitores: renderLeitores,
      turmas: renderTurmas, auxiliares: renderAuxiliares, backups: renderBackups,
      configuracoes: renderConfiguracoes,
    }[pagina])();
    conteudo.focus();
  } catch (erro) {
    conteudo.innerHTML = `<div class="vazio"><div><h2>Não foi possível abrir esta página</h2><p>${h(erro.message)}</p><button class="botao botao--secundario" data-recarregar> tentar novamente </button></div></div>`;
  }
}

function cabecalho(titulo, texto, acao = '') {
  return `<div class="cabecalho-conteudo"><div><h2>${h(titulo)}</h2><p>${h(texto)}</p></div>${acao}</div>`;
}

function vazio(titulo, texto) {
  return `<div class="vazio"><div><h3>${h(titulo)}</h3><p>${h(texto)}</p></div></div>`;
}

function etiqueta(texto, tipo = '') {
  return `<span class="etiqueta ${tipo ? `etiqueta--${tipo}` : ''}">${h(texto)}</span>`;
}

function textoNormalizado(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function criarCombobox({ raiz, nome, opcoes, textoBusca, textoSelecionado, detalhe, vazio, aoSelecionar }) {
  const campo = raiz.querySelector('[role="combobox"]');
  const valor = raiz.querySelector(`input[type="hidden"][name="${nome}"]`);
  const lista = raiz.querySelector('[role="listbox"]');
  const status = raiz.querySelector('[role="status"]');
  let resultados = [];
  let indiceAtivo = -1;
  let selecionado = null;

  const fechar = () => {
    raiz.classList.remove('aberto');
    campo.setAttribute('aria-expanded', 'false');
    campo.removeAttribute('aria-activedescendant');
    lista.hidden = true;
    indiceAtivo = -1;
  };

  const destacar = (indice) => {
    if (!resultados.length) return;
    indiceAtivo = (indice + resultados.length) % resultados.length;
    lista.querySelectorAll('[role="option"]').forEach((item, posicao) => item.classList.toggle('ativa', posicao === indiceAtivo));
    const ativo = lista.querySelectorAll('[role="option"]')[indiceAtivo];
    campo.setAttribute('aria-activedescendant', ativo.id);
    ativo.scrollIntoView({ block: 'nearest' });
  };

  const selecionar = (opcao) => {
    selecionado = opcao;
    valor.value = String(opcao.id);
    campo.value = textoSelecionado(opcao);
    campo.setCustomValidity('');
    aoSelecionar?.(opcao);
    fechar();
  };

  const abrir = () => {
    const termo = textoNormalizado(selecionado && campo.value === textoSelecionado(selecionado) ? '' : campo.value);
    const encontrados = opcoes.filter((opcao) => textoNormalizado(textoBusca(opcao)).includes(termo));
    resultados = encontrados.slice(0, 8);
    indiceAtivo = -1;
    lista.innerHTML = resultados.length
      ? resultados.map((opcao) => `<li class="combobox__opcao" id="${lista.id}-opcao-${opcao.id}" role="option" aria-selected="${String(opcao.id) === valor.value}"><strong>${h(textoSelecionado(opcao))}</strong><span>${h(detalhe(opcao))}</span></li>`).join('')
      : `<li class="combobox__vazio" role="presentation">${h(vazio)}</li>`;
    status.textContent = encontrados.length > resultados.length
      ? `${resultados.length} de ${encontrados.length} resultados. Digite mais para refinar.`
      : encontrados.length === 1 ? '1 resultado.' : `${encontrados.length} resultados.`;
    raiz.classList.add('aberto');
    campo.setAttribute('aria-expanded', 'true');
    lista.hidden = false;
  };

  campo.addEventListener('focus', abrir);
  campo.addEventListener('blur', fechar);
  campo.addEventListener('input', () => {
    if (selecionado && campo.value !== textoSelecionado(selecionado)) {
      selecionado = null;
      valor.value = '';
      aoSelecionar?.(null);
    }
    campo.setCustomValidity('');
    abrir();
  });
  campo.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (lista.hidden) abrir();
      destacar(indiceAtivo + (evento.key === 'ArrowDown' ? 1 : -1));
    } else if (evento.key === 'Enter' && !lista.hidden && indiceAtivo >= 0) {
      evento.preventDefault(); selecionar(resultados[indiceAtivo]);
    } else if (evento.key === 'Escape') {
      evento.preventDefault(); fechar();
    } else if (evento.key === 'Tab') fechar();
  });
  lista.addEventListener('pointerdown', (evento) => {
    const opcao = evento.target.closest('[role="option"]');
    if (!opcao) return;
    evento.preventDefault();
    selecionar(resultados[[...lista.querySelectorAll('[role="option"]')].indexOf(opcao)]);
  });

  return {
    validar() {
      if (valor.value) return true;
      campo.setCustomValidity(`Escolha ${nome === 'leitorId' ? 'um leitor' : 'um livro e exemplar'} na lista de resultados.`);
      campo.reportValidity();
      campo.focus();
      abrir();
      return false;
    },
    atualizarSelecionado(opcao) {
      if (!selecionado || selecionado.id !== opcao.id) return;
      selecionado = opcao;
      campo.value = textoSelecionado(opcao);
    },
    fechar,
  };
}

async function renderInicio() {
  const { totais, atividades } = await api('/api/painel');
  const nomesEventos = {
    criacao: 'registrou o empréstimo', devolucao: 'recebeu a devolução', mudanca_prazo: 'alterou o prazo',
    cancelamento: 'cancelou o empréstimo', desfazer_devolucao: 'desfez a devolução',
    perdido: 'registrou um livro perdido', danificado: 'registrou um livro danificado',
    encerramento_ocorrencia: 'encerrou uma ocorrência',
  };
  conteudo.innerHTML = `
    ${cabecalho('Bom trabalho, ' + estado.usuario.nome.split(' ')[0], 'Aqui está o que merece atenção hoje.')}
    <section class="indicadores" aria-label="Resumo da biblioteca">
      <button class="indicador" data-ir="emprestimos"><span>Empréstimos ativos</span><strong>${totais.ativos}</strong><small>Acompanhar circulação →</small></button>
      <button class="indicador indicador--alerta" data-ir="pendencias"><span>Em atraso</span><strong>${totais.atrasados}</strong><small>Ver devedores →</small></button>
      <button class="indicador indicador--erro" data-ir="pendencias"><span>Perdas ou danos</span><strong>${totais.ocorrencias}</strong><small>Ver ocorrências →</small></button>
      <button class="indicador indicador--ok" data-ir="livros"><span>Exemplares disponíveis</span><strong>${totais.disponiveis}</strong><small>Consultar acervo →</small></button>
    </section>
    <div class="grade-inicio">
      <section class="painel"><header class="painel__titulo"><h2>Atividade recente</h2><span class="texto-suave">Últimos 10 registros</span></header>
        ${atividades.length ? atividades.map((item) => `<article class="atividade"><span class="atividade__marca">${item.tipo === 'devolucao' ? '↙' : '↗'}</span><div><p>${h(item.usuario)} ${h(nomesEventos[item.tipo] || item.tipo)}</p><small>${h(item.livro)} · ${h(item.leitor)}${item.exemplar ? ` · ${h(item.exemplar)}` : ''}</small></div><time>${dataHoraBr(item.criadoEm)}</time></article>`).join('') : vazio('Tudo tranquilo por aqui', 'As movimentações aparecerão conforme os livros circularem.')}
      </section>
      <aside class="painel"><header class="painel__titulo"><h2>Ações rápidas</h2></header><div class="atalhos">
        <button class="atalho" data-ir="emprestar">Emprestar um livro <span>→</span></button>
        <button class="atalho" data-ir="emprestimos">Dar baixa em devolução <span>→</span></button>
        <button class="atalho" data-ir="leitores">Cadastrar leitor <span>→</span></button>
        <button class="atalho" data-ir="livros">Adicionar livro <span>→</span></button>
      </div></aside>
    </div>`;
}

async function renderEmprestar() {
  const [{ leitores }, { livros }, { leitores: pendencias }] = await Promise.all([api('/api/leitores'), api('/api/livros/disponiveis'), api('/api/pendencias')]);
  estado.cache.leitores = leitores;
  const leitoresComPendencia = new Set(pendencias.map((grupo) => grupo.leitor.id));
  const exemplares = livros.flatMap((livro) => livro.exemplares.filter((item) => item.disponivel).map((item) => ({ ...item, livro })));
  conteudo.innerHTML = `${cabecalho('Registrar empréstimo', 'Cada operação movimenta um exemplar para um leitor.')}
    <section class="painel"><form class="formulario formulario--painel" id="form-emprestimo">
      <div class="campo-form largura-total">
        <label for="busca-leitor">Leitor</label>
        <div class="combobox" id="combobox-leitor">
          <div class="combobox__controle"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="busca-leitor" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="lista-leitores" aria-describedby="ajuda-leitor status-leitor" autocomplete="off" placeholder="Busque por nome, matrícula ou turma"><svg class="combobox__seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg></div>
          <input type="hidden" name="leitorId"><ul class="combobox__lista" id="lista-leitores" role="listbox" aria-label="Leitores encontrados" hidden></ul><span class="combobox__status" id="status-leitor" role="status" aria-live="polite"></span>
        </div>
        <span class="ajuda" id="ajuda-leitor">Digite para filtrar. O cadastro pode ser corrigido sem apagar o restante do formulário.</span>
      </div>
      <div><button class="botao-link" type="button" id="editar-leitor-emprestimo" disabled>Editar leitor selecionado</button></div><div></div>
      <p class="largura-total aviso-pendencia" id="aviso-leitor-pendente" hidden>Este leitor já possui atraso, perda ou dano. O novo empréstimo continua permitido, mas confirme a situação com ele.</p>
      <div class="campo-form largura-total">
        <label for="busca-exemplar">Livro e exemplar</label>
        <div class="combobox" id="combobox-exemplar">
          <div class="combobox__controle"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="busca-exemplar" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="lista-exemplares" aria-describedby="ajuda-exemplar status-exemplar" autocomplete="off" placeholder="Busque por título, autor ou código"><svg class="combobox__seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg></div>
          <input type="hidden" name="exemplarId"><ul class="combobox__lista" id="lista-exemplares" role="listbox" aria-label="Livros e exemplares encontrados" hidden></ul><span class="combobox__status" id="status-exemplar" role="status" aria-live="polite"></span>
        </div>
        <span class="ajuda" id="ajuda-exemplar">A busca mostra somente unidades disponíveis para empréstimo.</span>
      </div>
      <label>Data de saída<input name="dataSaida" type="date" value="${hojeLocal()}" required></label>
      <label>Previsão de devolução<input name="dataPrevista" type="date" required></label>
      <div class="acoes"><button class="botao botao--primario" type="submit" ${!leitores.length || !exemplares.length ? 'disabled' : ''}>Revisar e confirmar</button></div>
    </form></section>
    ${!leitores.length ? '<p class="erro-form">Cadastre um leitor antes de emprestar.</p>' : ''}${!exemplares.length ? '<p class="erro-form">Não há exemplares disponíveis neste momento.</p>' : ''}`;
  const form = document.querySelector('#form-emprestimo');
  const saida = form.dataSaida;
  const previsao = form.dataPrevista;
  const botaoEditarLeitor = document.querySelector('#editar-leitor-emprestimo');
  const avisoLeitorPendente = document.querySelector('#aviso-leitor-pendente');
  const leitorCombobox = criarCombobox({
    raiz: document.querySelector('#combobox-leitor'), nome: 'leitorId', opcoes: leitores,
    textoBusca: (item) => `${item.nome} ${item.identificador || ''} ${item.tipo} ${item.turma?.nome || ''} ${item.turma?.turno || ''}`,
    textoSelecionado: (item) => item.nome,
    detalhe: (item) => `${item.identificador || item.tipo}${item.turma ? ` · ${item.turma.nome} · ${item.turma.turno}` : ''}`,
    vazio: 'Nenhum leitor encontrado. Tente outro nome, matrícula ou turma.',
    aoSelecionar: (item) => {
      botaoEditarLeitor.disabled = !item;
      avisoLeitorPendente.hidden = !item || !leitoresComPendencia.has(Number(item.id));
    },
  });
  const exemplarCombobox = criarCombobox({
    raiz: document.querySelector('#combobox-exemplar'), nome: 'exemplarId', opcoes: exemplares,
    textoBusca: (item) => `${item.livro.titulo} ${item.livro.autor} ${item.codigo || ''}`,
    textoSelecionado: (item) => item.livro.titulo,
    detalhe: (item) => `${item.livro.autor} · ${item.codigo || `Exemplar ${item.id}`}`,
    vazio: 'Nenhuma unidade disponível encontrada. Tente outro título, autor ou código.',
  });
  const sugerirPrazo = () => { const data = new Date(`${saida.value}T12:00:00`); data.setDate(data.getDate() + 7); previsao.value = data.toISOString().slice(0, 10); };
  sugerirPrazo(); saida.addEventListener('change', sugerirPrazo);
  botaoEditarLeitor.addEventListener('click', () => abrirFormularioLeitor(leitores.find((item) => item.id === Number(form.leitorId.value)), async (salvo) => {
    const indice = leitores.findIndex((item) => item.id === salvo.id);
    leitores[indice] = salvo;
    leitorCombobox.atualizarSelecionado(salvo);
  }));
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!leitorCombobox.validar() || !exemplarCombobox.validar()) return;
    const dados = Object.fromEntries(new FormData(form));
    const leitor = leitores.find((item) => item.id === Number(dados.leitorId));
    const exemplar = exemplares.find((item) => item.id === Number(dados.exemplarId));
    const aceitou = await confirmar('Confirmar empréstimo', `${leitor.nome} receberá “${exemplar.livro.titulo}” (${exemplar.codigo || 'sem código'}) até ${dataBr(dados.dataPrevista)}. Responsável: ${estado.usuario.nome}.`);
    if (!aceitou) return;
    try { await api('/api/emprestimos', { method:'POST', body:dados }); avisar('Empréstimo registrado com sucesso.'); navegar('emprestimos'); }
    catch (erro) { avisar(erro.message, 'erro'); }
  });
}

async function renderEmprestimos(busca = '') {
  const { emprestimos } = await api(`/api/emprestimos?status=ativo&busca=${encodeURIComponent(busca)}`);
  conteudo.innerHTML = `${cabecalho('Circulação atual', 'Atrasos aparecem primeiro. Use nome, título ou código para localizar uma devolução.')}
    <form class="barra-filtros" id="buscar-emprestimos"><input name="busca" value="${h(busca)}" placeholder="Buscar por leitor, livro ou código"><button class="botao botao--secundario">Buscar</button></form>
    <div class="tabela-caixa">${emprestimos.length ? `<table><thead><tr><th>Livro / exemplar</th><th>Leitor</th><th>Prazo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${emprestimos.map((item) => {
      const atrasado = item.dataPrevista < hojeLocal();
      return `<tr><td><span class="titulo-celula">${h(item.exemplar.livro.titulo)}</span><span class="subtexto">${h(item.exemplar.codigo || `Exemplar ${item.exemplar.id}`)}</span></td><td><span class="titulo-celula">${h(item.leitor.nome)}</span><span class="subtexto">${h(item.leitor.identificador || item.leitor.tipo)}</span></td><td>${dataBr(item.dataPrevista)}</td><td>${item.ocorrencia ? etiqueta(item.ocorrencia, 'erro') : atrasado ? etiqueta('Atrasado', 'alerta') : etiqueta('Em dia', 'ok')}</td><td><div class="acoes"><button class="botao-link" data-emprestimo="devolver" data-id="${item.id}">Devolver</button><button class="botao-link" data-emprestimo="prazo" data-id="${item.id}">Prazo</button><button class="botao-link" data-emprestimo="ocorrencia" data-id="${item.id}">Perda/dano</button><button class="botao-link" data-emprestimo="cancelar" data-id="${item.id}">Cancelar</button></div></td></tr>`;
    }).join('')}</tbody></table>` : vazio('Nenhum empréstimo ativo', busca ? 'Tente outro termo de busca.' : 'Os próximos empréstimos aparecerão aqui.')}</div>`;
  document.querySelector('#buscar-emprestimos').addEventListener('submit', (e) => { e.preventDefault(); renderEmprestimos(new FormData(e.currentTarget).get('busca')); });
}

async function acaoEmprestimo(acao, id) {
  if (acao === 'devolver') {
    if (!await confirmar('Confirmar devolução', `A baixa será assinada por ${estado.usuario.nome}. Confirme que o exemplar foi recebido.`)) return;
    await api(`/api/emprestimos/${id}/devolucao`, { method:'POST', body:{} }); avisar('Devolução registrada.'); navegar('emprestimos'); return;
  }
  if (acao === 'cancelar') {
    if (!await confirmar('Cancelar lançamento', 'Use esta correção apenas quando o empréstimo foi registrado por engano. O histórico será preservado.')) return;
    await api(`/api/emprestimos/${id}/cancelamento`, { method:'POST', body:{} }); avisar('Empréstimo cancelado.'); navegar('emprestimos'); return;
  }
  if (acao === 'prazo') {
    abrirModal('Alterar prazo', 'Correção de empréstimo', `<form id="form-prazo" class="formulario"><label class="largura-total">Nova previsão<input name="dataPrevista" type="date" required></label><div class="acoes"><button class="botao botao--primario">Salvar novo prazo</button></div></form>`);
    document.querySelector('#form-prazo').addEventListener('submit', async (e) => { e.preventDefault(); try { await api(`/api/emprestimos/${id}/prazo`, { method:'PUT', body:Object.fromEntries(new FormData(e.currentTarget)) }); fecharModal(); avisar('Prazo atualizado.'); navegar('emprestimos'); } catch (erro) { avisar(erro.message,'erro'); } }); return;
  }
  if (acao === 'ocorrencia') {
    abrirModal('Registrar perda ou dano', 'Ocorrência', `<form id="form-ocorrencia" class="formulario"><label class="largura-total">Condição<select name="tipo"><option value="perdido">Livro perdido</option><option value="danificado">Livro danificado</option></select></label><p class="largura-total texto-suave">A ocorrência não dá baixa: ela permanece como pendência do leitor até ser resolvida.</p><div class="acoes"><button class="botao botao--perigo">Registrar ocorrência</button></div></form>`);
    document.querySelector('#form-ocorrencia').addEventListener('submit', async (e) => { e.preventDefault(); try { await api(`/api/emprestimos/${id}/ocorrencia`, { method:'POST', body:Object.fromEntries(new FormData(e.currentTarget)) }); fecharModal(); avisar('Ocorrência registrada.'); navegar('pendencias'); } catch (erro) { avisar(erro.message,'erro'); } });
  }
}

async function renderPendencias() {
  const { leitores } = await api('/api/pendencias');
  conteudo.innerHTML = `${cabecalho('Quem precisa de acompanhamento', 'Atrasos e ocorrências ficam agrupados por leitor.', '<button class="botao botao--secundario" data-imprimir>Imprimir lista</button>')}
    ${leitores.length ? leitores.map((grupo) => `<section class="cartao-pendencia"><header><div><h3>${h(grupo.leitor.nome)}</h3><p class="texto-suave">${h(grupo.leitor.telefone || grupo.leitor.identificador || grupo.leitor.tipo)}</p></div><button class="botao-link" data-historico="${grupo.leitor.id}">Ver histórico</button></header><div class="tabela-caixa tabela-caixa--plana"><table><thead><tr><th>Livro</th><th>Exemplar</th><th>Vencimento</th><th>Pendência</th><th>Ação</th></tr></thead><tbody>${grupo.emprestimos.map((item) => `<tr><td>${h(item.exemplar.livro.titulo)}</td><td>${h(item.exemplar.codigo || `Exemplar ${item.exemplar.id}`)}</td><td>${dataBr(item.dataPrevista)}<span class="subtexto">${item.diasAtraso ? `${item.diasAtraso} dia(s)` : 'Ainda no prazo'}</span></td><td>${item.ocorrencia ? etiqueta(item.ocorrencia,'erro') : etiqueta('Atrasado','alerta')}</td><td>${item.ocorrencia ? `<button class="botao-link" data-resolver="${item.id}">Resolver ocorrência</button>` : `<button class="botao-link" data-emprestimo="devolver" data-id="${item.id}">Devolver</button>`}</td></tr>`).join('')}</tbody></table></div></section>`).join('') : vazio('Nenhuma pendência', 'Não há atrasos, perdas ou danos ativos.')}`;
}

function resolverOcorrencia(id) {
  abrirModal('Encerrar sem devolução', 'Resolver ocorrência', `<form id="form-resolver" class="formulario"><p class="largura-total texto-suave">O exemplar continuará bloqueado como perdido ou danificado. Esta ação apenas encerra a pendência do leitor.</p><label class="largura-total">Justificativa<textarea name="justificativa" required placeholder="Explique como a ocorrência foi resolvida"></textarea></label><div class="acoes"><button class="botao botao--perigo">Encerrar ocorrência</button></div></form>`);
  document.querySelector('#form-resolver').addEventListener('submit', async (e) => { e.preventDefault(); try { await api(`/api/emprestimos/${id}/encerramento`, { method:'POST', body:Object.fromEntries(new FormData(e.currentTarget)) }); fecharModal(); avisar('Ocorrência encerrada e histórico preservado.'); navegar('pendencias'); } catch (erro) { avisar(erro.message,'erro'); } });
}

async function renderLivros(busca = '') {
  const { livros } = await api(`/api/livros?busca=${encodeURIComponent(busca)}`);
  estado.cache.livros = livros;
  conteudo.innerHTML = `${cabecalho('Catálogo da biblioteca', 'Cada livro reúne suas unidades físicas e a disponibilidade é calculada automaticamente.', '<button class="botao botao--primario" id="novo-livro">+ Adicionar livro</button>')}
    <form class="barra-filtros" id="buscar-livros"><input name="busca" value="${h(busca)}" placeholder="Título, autor ou código"><button class="botao botao--secundario">Buscar</button></form>
    <div class="tabela-caixa">${livros.length ? `<table><thead><tr><th>Livro</th><th>Gênero</th><th>Exemplares</th><th>Disponíveis</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${livros.map((livro) => `<tr><td><span class="titulo-celula">${h(livro.titulo)}</span><span class="subtexto">${h(livro.autor)}</span></td><td>${h(livro.genero || '—')}</td><td>${livro.quantidadeTotal}</td><td>${livro.quantidadeDisponivel}</td><td>${livro.ativo ? etiqueta('Ativo','ok') : etiqueta('Arquivado')}</td><td><div class="acoes"><button class="botao-link" data-livro="unidades" data-id="${livro.id}">Unidades</button><button class="botao-link" data-livro="editar" data-id="${livro.id}">Editar</button></div></td></tr>`).join('')}</tbody></table>` : vazio('Nenhum livro encontrado', busca ? 'Tente outro termo.' : 'Adicione o primeiro título do acervo.')}</div>`;
  document.querySelector('#novo-livro').addEventListener('click', () => abrirFormularioLivro());
  document.querySelector('#buscar-livros').addEventListener('submit', (e) => { e.preventDefault(); renderLivros(new FormData(e.currentTarget).get('busca')); });
}

function abrirFormularioLivro(livro = null) {
  abrirModal(livro ? 'Editar livro' : 'Adicionar livro', 'Acervo', `<form id="form-livro" class="formulario">
    <label>Título<input name="titulo" value="${h(livro?.titulo)}" required></label><label>Autor<input name="autor" value="${h(livro?.autor)}" required></label>
    <label>Editora <span class="ajuda">opcional</span><input name="editora" value="${h(livro?.editora)}"></label><label>Edição <span class="ajuda">opcional</span><input name="edicao" value="${h(livro?.edicao)}"></label>
    <label>Ano <span class="ajuda">opcional</span><input name="anoPublicacao" type="number" value="${h(livro?.anoPublicacao)}"></label><label>Gênero <span class="ajuda">opcional</span><input name="genero" value="${h(livro?.genero)}"></label>
    ${livro ? `<label class="largura-total"><span><input class="checkbox" type="checkbox" name="ativo" ${livro.ativo ? 'checked' : ''}> Livro ativo</span></label>` : `<label class="largura-total">Códigos dos exemplares <span class="ajuda">um por linha; linhas vazias criam unidades sem código</span><textarea name="codigos" placeholder="ASSIS-001&#10;ASSIS-002"></textarea></label><label>Quantidade sem código <input name="semCodigo" type="number" min="0" value="1"></label>`}
    <div class="acoes">${livro ? `<button class="botao botao--perigo" type="button" data-excluir-livro="${livro.id}">Excluir definitivamente</button>` : ''}<button class="botao botao--primario">${livro ? 'Salvar alterações' : 'Cadastrar livro'}</button></div></form>`);
  document.querySelector('#form-livro').addEventListener('submit', async (e) => {
    e.preventDefault(); const dados = Object.fromEntries(new FormData(e.currentTarget));
    if (livro) dados.ativo = e.currentTarget.ativo.checked;
    else {
      const codigos = dados.codigos.split('\n').map((item) => item.trim()).filter(Boolean);
      for (let i = 0; i < Number(dados.semCodigo || 0); i++) codigos.push('');
      dados.codigosExemplares = codigos.length ? codigos : ['']; delete dados.codigos; delete dados.semCodigo;
    }
    try { await api(livro ? `/api/livros/${livro.id}` : '/api/livros', { method:livro ? 'PUT' : 'POST', body:dados }); fecharModal(); avisar(livro ? 'Livro atualizado.' : 'Livro cadastrado.'); navegar('livros'); } catch (erro) { avisar(erro.message,'erro'); }
  });
}

function mostrarUnidades(livro) {
  abrirModal(livro.titulo, 'Exemplares', `<div class="acoes acoes--separadas"><button class="botao botao--primario" id="adicionar-exemplar">+ Nova unidade</button></div><div class="tabela-caixa"><table><thead><tr><th>Código</th><th>Condição</th><th>Disponibilidade</th><th></th></tr></thead><tbody>${livro.exemplares.map((item) => `<tr><td>${h(item.codigo || 'Sem código')}</td><td>${h(item.estado)}</td><td>${item.disponivel ? etiqueta('Disponível','ok') : etiqueta('Indisponível','alerta')}</td><td><button class="botao-link" data-editar-exemplar="${item.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>`);
  document.querySelector('#adicionar-exemplar').addEventListener('click', () => abrirFormularioExemplar(livro));
  document.querySelectorAll('[data-editar-exemplar]').forEach((botao) => botao.addEventListener('click', () => abrirFormularioExemplar(livro, livro.exemplares.find((item) => item.id === Number(botao.dataset.editarExemplar)))));
}

function abrirFormularioExemplar(livro, exemplar = null) {
  abrirModal(exemplar ? 'Editar exemplar' : 'Adicionar exemplar', livro.titulo, `<form id="form-exemplar" class="formulario"><label class="largura-total">Código <span class="ajuda">opcional</span><input name="codigo" value="${h(exemplar?.codigo)}"></label>${exemplar ? `<label class="largura-total">Condição<select name="estado">${['normal','perdido','danificado','manutencao','arquivado'].map((estadoItem) => `<option value="${estadoItem}" ${exemplar.estado === estadoItem ? 'selected' : ''}>${estadoItem}</option>`).join('')}</select></label>` : ''}<div class="acoes">${exemplar ? `<button class="botao botao--perigo" type="button" data-excluir-exemplar="${exemplar.id}">Excluir definitivamente</button>` : ''}<button class="botao botao--primario">Salvar exemplar</button></div></form>`);
  document.querySelector('#form-exemplar').addEventListener('submit', async (e) => { e.preventDefault(); try { await api(exemplar ? `/api/exemplares/${exemplar.id}` : `/api/livros/${livro.id}/exemplares`, { method:exemplar ? 'PUT' : 'POST', body:Object.fromEntries(new FormData(e.currentTarget)) }); fecharModal(); avisar('Exemplar salvo.'); navegar('livros'); } catch (erro) { avisar(erro.message,'erro'); } });
}

async function renderLeitores(busca = '', tipo = '', turmaId = '', turno = '', anoLetivo = '') {
  const [{ leitores }, { turmas }] = await Promise.all([
    api(`/api/leitores?busca=${encodeURIComponent(busca)}&tipo=${encodeURIComponent(tipo)}&turmaId=${encodeURIComponent(turmaId)}&turno=${encodeURIComponent(turno)}&anoLetivo=${encodeURIComponent(anoLetivo)}`),
    api('/api/turmas'),
  ]);
  estado.cache.leitores = leitores;
  const anos = [...new Set(turmas.map((item) => item.anoLetivo))].sort((a,b) => b-a);
  conteudo.innerHTML = `${cabecalho('Pessoas que usam a biblioteca', 'Cadastros continuam editáveis e o histórico permanece na mesma pessoa.', '<button class="botao botao--primario" id="novo-leitor">+ Cadastrar leitor</button>')}
    <form class="barra-filtros" id="buscar-leitores"><input name="busca" value="${h(busca)}" placeholder="Nome, matrícula ou código"><select name="tipo"><option value="">Todos os tipos</option><option value="aluno" ${tipo==='aluno'?'selected':''}>Alunos</option><option value="professor" ${tipo==='professor'?'selected':''}>Professores</option><option value="funcionario" ${tipo==='funcionario'?'selected':''}>Funcionários</option></select><select name="turmaId"><option value="">Todas as turmas</option>${turmas.map((item)=>`<option value="${item.id}" ${String(item.id)===String(turmaId)?'selected':''}>${h(item.nome)}</option>`).join('')}</select><select name="turno"><option value="">Todos os turnos</option>${['Manhã','Tarde','Noite','Integral'].map((item)=>`<option ${item===turno?'selected':''}>${item}</option>`).join('')}</select><select name="anoLetivo"><option value="">Todos os anos</option>${anos.map((item)=>`<option ${String(item)===String(anoLetivo)?'selected':''}>${item}</option>`).join('')}</select><button class="botao botao--secundario">Filtrar</button></form>
    <div class="tabela-caixa">${leitores.length ? `<table><thead><tr><th>Nome</th><th>Tipo</th><th>Turma</th><th>Contato</th><th>Ações</th></tr></thead><tbody>${leitores.map((item) => `<tr><td><span class="titulo-celula">${h(item.nome)}</span><span class="subtexto">${h(item.identificador || 'Sem identificação')}</span></td><td>${h(item.tipo)}</td><td>${item.turma ? `${h(item.turma.nome)}<span class="subtexto">${h(item.turma.turno)} · ${item.turma.anoLetivo}</span>` : '—'}</td><td>${h(item.telefone || '—')}</td><td><div class="acoes"><button class="botao-link" data-leitor="editar" data-id="${item.id}">Editar</button><button class="botao-link" data-historico="${item.id}">Histórico</button></div></td></tr>`).join('')}</tbody></table>` : vazio('Nenhum leitor encontrado', busca ? 'Tente outro termo ou filtro.' : 'Cadastre alunos, professores e funcionários aos poucos.')}</div>`;
  document.querySelector('#novo-leitor').addEventListener('click', () => abrirFormularioLeitor());
  document.querySelector('#buscar-leitores').addEventListener('submit', (e) => { e.preventDefault(); const f=new FormData(e.currentTarget); renderLeitores(f.get('busca'),f.get('tipo'),f.get('turmaId'),f.get('turno'),f.get('anoLetivo')); });
}

async function abrirFormularioLeitor(leitor = null, aoSalvar = null) {
  const { turmas } = await api('/api/turmas');
  abrirModal(leitor ? 'Editar cadastro' : 'Cadastrar leitor', 'Leitores', `<form id="form-leitor" class="formulario">
    <label>Tipo<select name="tipo" ${leitor ? 'disabled' : ''}><option value="aluno" ${leitor?.tipo==='aluno'?'selected':''}>Aluno</option><option value="professor" ${leitor?.tipo==='professor'?'selected':''}>Professor</option><option value="funcionario" ${leitor?.tipo==='funcionario'?'selected':''}>Funcionário</option></select></label>
    <label>Nome completo<input name="nome" value="${h(leitor?.nome)}" required></label><label>Matrícula ou código <span class="ajuda">opcional</span><input name="identificador" value="${h(leitor?.identificador)}"></label><label>Telefone <span class="ajuda">opcional</span><input name="telefone" value="${h(leitor?.telefone)}"></label>
    <label class="largura-total" id="campo-turma">Turma<select name="turmaId"><option value="">Selecione</option>${turmas.filter((item) => item.ativo || item.id === leitor?.turma?.id).map((item) => `<option value="${item.id}" ${item.id===leitor?.turma?.id?'selected':''}>${h(item.nome)} — ${h(item.turno)} · ${item.anoLetivo}</option>`).join('')}</select></label>
    ${leitor ? `<label class="largura-total"><span><input class="checkbox" type="checkbox" name="ativo" ${leitor.ativo?'checked':''}> Cadastro ativo</span></label>` : ''}<div class="acoes">${leitor ? `<button class="botao botao--perigo" type="button" data-excluir-leitor="${leitor.id}">Excluir definitivamente</button>` : ''}<button class="botao botao--primario">Salvar cadastro</button></div></form>`);
  const form = document.querySelector('#form-leitor');
  const tipo = form.tipo; const ajustar = () => { document.querySelector('#campo-turma').hidden = tipo.value !== 'aluno'; form.turmaId.required = tipo.value === 'aluno'; }; ajustar(); tipo.addEventListener('change', ajustar);
  form.addEventListener('submit', async (e) => { e.preventDefault(); const dados=Object.fromEntries(new FormData(form)); dados.tipo=tipo.value; if(tipo.value!=='aluno') dados.turmaId=null; if(leitor) dados.ativo=form.ativo.checked; try { const resposta=await api(leitor?`/api/leitores/${leitor.id}`:'/api/leitores',{method:leitor?'PUT':'POST',body:dados}); fecharModal(); avisar('Cadastro salvo.'); if(aoSalvar) await aoSalvar(resposta.leitor); else navegar('leitores'); } catch(erro){avisar(erro.message,'erro');} });
}

async function abrirHistorico(id) {
  const { leitor, emprestimos } = await api(`/api/leitores/${id}/historico`);
  abrirModal(`Histórico de ${leitor.nome}`, leitor.tipo, `<div class="acoes acoes--separadas"><button class="botao botao--secundario" data-imprimir>Imprimir histórico</button></div>${emprestimos.length ? emprestimos.map((item) => `<article class="painel historico-item"><h3>${h(item.exemplar.livro.titulo)}</h3><p>${h(item.exemplar.codigo || 'Sem código')} · Saída ${dataBr(item.dataSaida)} · Previsão ${dataBr(item.dataPrevista)}</p><p class="historico-item__status">${etiqueta(item.status,item.status==='devolvido'?'ok':item.status==='ativo'?'alerta':'')}</p>${item.eventos.map((evento) => `<small class="historico-evento">${dataHoraBr(evento.criadoEm)} — ${h(evento.tipo.replaceAll('_',' '))} por ${h(evento.usuario.nome)}</small>`).join('')}${item.status === 'devolvido' ? `<button class="botao-link" data-desfazer-devolucao="${item.id}" data-leitor-id="${leitor.id}">Desfazer esta devolução</button>` : ''}</article>`).join('') : vazio('Sem empréstimos', 'Este leitor ainda não possui movimentações.')}`);
}

async function renderTurmas() {
  const { turmas } = await api('/api/turmas'); estado.cache.turmas=turmas;
  conteudo.innerHTML = `${cabecalho('Organização das turmas', 'Turno e ano ficam na turma, sem repetir informação no cadastro de cada aluno.', '<button class="botao botao--primario" id="nova-turma">+ Nova turma</button>')}<div class="tabela-caixa">${turmas.length?`<table><thead><tr><th>Turma</th><th>Turno</th><th>Ano letivo</th><th>Situação</th><th></th></tr></thead><tbody>${turmas.map((item)=>`<tr><td class="titulo-celula">${h(item.nome)}</td><td>${h(item.turno)}</td><td>${item.anoLetivo}</td><td>${item.ativo?etiqueta('Ativa','ok'):etiqueta('Arquivada')}</td><td><button class="botao-link" data-turma="${item.id}">Editar</button></td></tr>`).join('')}</tbody></table>`:vazio('Nenhuma turma','Cadastre a turma antes de adicionar seus alunos.')}</div>`;
  document.querySelector('#nova-turma').addEventListener('click',()=>abrirFormularioTurma());
}

function abrirFormularioTurma(turma=null){
  abrirModal(turma?'Editar turma':'Nova turma','Leitores',`<form id="form-turma" class="formulario"><label>Nome<input name="nome" value="${h(turma?.nome)}" required></label><label>Turno<select name="turno">${['Manhã','Tarde','Noite','Integral'].map((item)=>`<option ${item===turma?.turno?'selected':''}>${item}</option>`).join('')}</select></label><label>Ano letivo<input name="anoLetivo" type="number" min="2000" max="2200" value="${turma?.anoLetivo||new Date().getFullYear()}" required></label>${turma?`<label><span><input class="checkbox" type="checkbox" name="ativo" ${turma.ativo?'checked':''}> Turma ativa</span></label>`:''}<div class="acoes">${turma ? `<button class="botao botao--perigo" type="button" data-excluir-turma="${turma.id}">Excluir definitivamente</button>` : ''}<button class="botao botao--primario">Salvar turma</button></div></form>`);
  const form=document.querySelector('#form-turma');form.addEventListener('submit',async(e)=>{e.preventDefault();const dados=Object.fromEntries(new FormData(form));if(turma)dados.ativo=form.ativo.checked;try{await api(turma?`/api/turmas/${turma.id}`:'/api/turmas',{method:turma?'PUT':'POST',body:dados});fecharModal();avisar('Turma salva.');navegar('turmas');}catch(erro){avisar(erro.message,'erro');}});
}

async function renderAuxiliares(){
  const {usuarios}=await api('/api/usuarios');estado.cache.usuarios=usuarios.filter((item)=>item.perfil==='auxiliar');
  conteudo.innerHTML=`${cabecalho('Equipe auxiliar','A administradora controla quem pode registrar movimentações.','<button class="botao botao--primario" id="novo-auxiliar">+ Novo auxiliar</button>')}<div class="tabela-caixa">${estado.cache.usuarios.length?`<table><thead><tr><th>Nome</th><th>Usuário</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${estado.cache.usuarios.map((item)=>`<tr><td class="titulo-celula">${h(item.nome)}</td><td>${h(item.usuario)}</td><td>${item.ativo?etiqueta('Ativo','ok'):etiqueta('Desativado')}</td><td><div class="acoes"><button class="botao-link" data-auxiliar="editar" data-id="${item.id}">Editar</button><button class="botao-link" data-auxiliar="senha" data-id="${item.id}">Redefinir senha</button></div></td></tr>`).join('')}</tbody></table>`:vazio('Nenhum auxiliar','Cadastre apenas pessoas que realmente usarão o sistema.')}</div>`;
  document.querySelector('#novo-auxiliar').addEventListener('click',()=>abrirFormularioAuxiliar());
}

function abrirFormularioAuxiliar(auxiliar=null){
  abrirModal(auxiliar?'Editar auxiliar':'Novo auxiliar','Administração',`<form id="form-auxiliar" class="formulario"><label>Nome<input name="nome" value="${h(auxiliar?.nome)}" required></label><label>Usuário<input name="usuario" value="${h(auxiliar?.usuario)}" required></label>${auxiliar?`<label class="largura-total"><span><input class="checkbox" type="checkbox" name="ativo" ${auxiliar.ativo?'checked':''}> Acesso ativo</span></label>`:`<label class="largura-total">Senha inicial<input name="senha" type="password" minlength="8" required></label>`}<div class="acoes"><button class="botao botao--primario">Salvar auxiliar</button></div></form>`);
  const form=document.querySelector('#form-auxiliar');form.addEventListener('submit',async(e)=>{e.preventDefault();const dados=Object.fromEntries(new FormData(form));if(auxiliar)dados.ativo=form.ativo.checked;try{await api(auxiliar?`/api/usuarios/${auxiliar.id}`:'/api/usuarios',{method:auxiliar?'PUT':'POST',body:dados});fecharModal();avisar('Auxiliar salvo.');navegar('auxiliares');}catch(erro){avisar(erro.message,'erro');}});
}

function redefinirSenha(auxiliar){
  abrirModal('Redefinir senha',auxiliar.nome,`<form id="form-senha" class="formulario"><label class="largura-total">Nova senha<input name="senha" type="password" minlength="8" required></label><div class="acoes"><button class="botao botao--primario">Salvar nova senha</button></div></form>`);
  document.querySelector('#form-senha').addEventListener('submit',async(e)=>{e.preventDefault();try{await api(`/api/usuarios/${auxiliar.id}/senha`,{method:'PUT',body:Object.fromEntries(new FormData(e.currentTarget))});fecharModal();avisar('Senha redefinida.');}catch(erro){avisar(erro.message,'erro');}});
}

async function renderBackups(){
  try{const {backups}=await api('/api/backups');conteudo.innerHTML=`${cabecalho('Cópias de segurança','Guarde também uma cópia em pen drive de tempos em tempos.','<button class="botao botao--primario" id="criar-backup">Criar backup agora</button>')}<div class="tabela-caixa">${backups.length?`<table><thead><tr><th>Arquivo</th><th>Tipo</th><th>Criado em</th><th>Tamanho</th><th></th></tr></thead><tbody>${backups.map((item)=>`<tr><td>${h(item.nome)}</td><td>${h(item.tipo)}</td><td>${dataHoraBr(item.criadoEm)}</td><td>${h(item.tamanhoFormatado)}</td><td><a class="botao-link" href="/api/backups/${encodeURIComponent(item.nome)}">Baixar</a></td></tr>`).join('')}</tbody></table>`:vazio('Nenhum backup','Crie a primeira cópia de segurança agora.')}</div><section class="painel painel--espacado"><h2>Restaurar uma cópia</h2><p class="texto-suave bloco-ajuda">Escolha somente um arquivo de backup criado pelo Assis. O estado atual será protegido antes da troca.</p><form id="form-restaurar" class="barra-filtros"><input name="arquivo" type="file" accept=".sqlite,.db" required><button class="botao botao--perigo">Restaurar</button></form></section>`;
    document.querySelector('#criar-backup').addEventListener('click',async()=>{try{await api('/api/backups',{method:'POST',body:{}});avisar('Backup criado.');navegar('backups');}catch(erro){avisar(erro.message,'erro');}});
    document.querySelector('#form-restaurar').addEventListener('submit',async(e)=>{e.preventDefault();const arquivo=e.currentTarget.arquivo.files[0];if(!arquivo||!await confirmar('Restaurar backup','O banco atual será protegido e substituído. Depois será necessário entrar novamente.'))return;try{await api('/api/backups/restaurar',{method:'POST',headers:{'content-type':'application/octet-stream'},body:arquivo});avisar('Backup restaurado. Entre novamente.');mostrarLogin();}catch(erro){avisar(erro.message,'erro');}});
  }catch(erro){conteudo.innerHTML=vazio('Backups ainda indisponíveis',erro.message);}
}

function conteudoStatusSistema(status) {
  return `<span class="status-sistema__icone" aria-hidden="true">
    ${status.integro
      ? '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01"/></svg>'}
    </span><div><strong>${h(status.mensagem)}</strong></div>`;
}

async function renderConfiguracoes() {
  const status = await api('/api/sistema/status');
  conteudo.innerHTML = `${cabecalho('Configurações do sistema', 'Verifique a instalação ou reconstrua o Assis quando houver uma falha grave.')}
    <section class="painel configuracoes-sistema">
      <div class="configuracoes-sistema__bloco">
        <div><h3>Status do sistema</h3><p class="texto-suave">Confere a estrutura e a integridade do banco de dados local.</p></div>
        <div class="status-sistema ${status.integro ? 'status-sistema--ok' : 'status-sistema--erro'}" id="status-sistema" role="status">${conteudoStatusSistema(status)}</div>
        <button class="botao botao--secundario" type="button" id="verificar-sistema">Verificar novamente</button>
      </div>
      <div class="configuracoes-sistema__bloco configuracoes-sistema__bloco--perigo">
        <div><h3>Reiniciar tudo e reparar</h3><p class="texto-suave">Cria um backup, apaga os dados atuais e reinstala todas as tabelas. Use somente quando o sistema não iniciar corretamente.</p></div>
        <button class="botao botao--perigo" type="button" id="reiniciar-reparar">Reiniciar tudo e reparar</button>
      </div>
    </section>`;

  document.querySelector('#verificar-sistema').addEventListener('click', async (evento) => {
    const botao = evento.currentTarget;
    botao.disabled = true;
    botao.textContent = 'Verificando…';
    try {
      const atualizado = await api('/api/sistema/status');
      const caixa = document.querySelector('#status-sistema');
      caixa.className = `status-sistema ${atualizado.integro ? 'status-sistema--ok' : 'status-sistema--erro'}`;
      caixa.innerHTML = conteudoStatusSistema(atualizado);
    } catch {
      const caixa = document.querySelector('#status-sistema');
      caixa.className = 'status-sistema status-sistema--erro';
      caixa.innerHTML = conteudoStatusSistema({ integro:false, mensagem:'O sistema foi instalado incorretamente. Confira com a administradora o que aconteceu.' });
    } finally {
      botao.disabled = false;
      botao.textContent = 'Verificar novamente';
    }
  });
  document.querySelector('#reiniciar-reparar').addEventListener('click', abrirReparoSistema);
}

function abrirReparoSistema() {
  abrirModal('Reiniciar tudo e reparar', 'Configurações', `<form id="form-reparar-sistema" class="formulario">
    <div class="largura-total alerta-reparo"><strong>Todos os dados atuais serão apagados.</strong><p>Antes disso, o Assis guardará uma cópia completa em Backups. Seu usuário e sua senha de administradora serão mantidos.</p></div>
    <label class="largura-total">Senha da administradora<input name="senha" type="password" autocomplete="current-password" required></label>
    <label class="largura-total">Digite REINICIAR para confirmar<input name="confirmacao" autocomplete="off" spellcheck="false" required></label>
    <p class="erro-form largura-total" id="erro-reparo" role="alert"></p>
    <div class="acoes"><button class="botao botao--perigo" id="confirmar-reparo" disabled>Apagar dados e reinstalar</button></div>
  </form>`);
  const form = document.querySelector('#form-reparar-sistema');
  const botao = document.querySelector('#confirmar-reparo');
  const ajustar = () => { botao.disabled = form.confirmacao.value !== 'REINICIAR' || !form.senha.value; };
  form.confirmacao.addEventListener('input', ajustar);
  form.senha.addEventListener('input', ajustar);
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    botao.disabled = true;
    botao.textContent = 'Reinstalando…';
    document.querySelector('#erro-reparo').textContent = '';
    try {
      const resposta = await api('/api/sistema/reparar', { method:'POST', body:Object.fromEntries(new FormData(form)) });
      fecharModal();
      avisar(resposta.mensagem);
      mostrarLogin();
    } catch (erro) {
      document.querySelector('#erro-reparo').textContent = erro.message;
      botao.textContent = 'Apagar dados e reinstalar';
      ajustar();
    }
  });
}

function abrirModal(titulo, contexto, corpo){document.querySelector('#modal-titulo').textContent=titulo;document.querySelector('#modal-contexto').textContent=contexto;document.querySelector('#modal-corpo').innerHTML=corpo;modal.showModal();}
function fecharModal(){if(modal.open)modal.close();}
function confirmar(titulo,texto){return new Promise((resolve)=>{const caixa=document.querySelector('#confirmacao');document.querySelector('#confirmacao-titulo').textContent=titulo;document.querySelector('#confirmacao-texto').textContent=texto;caixa.hidden=false;const terminar=(valor)=>{caixa.hidden=true;document.querySelector('#aceitar-confirmacao').onclick=null;document.querySelector('#cancelar-confirmacao').onclick=null;resolve(valor);};document.querySelector('#aceitar-confirmacao').onclick=()=>terminar(true);document.querySelector('#cancelar-confirmacao').onclick=()=>terminar(false);});}

async function excluirCadastro(tipo, id, pagina) {
  if (!await confirmar('Excluir definitivamente?', 'A exclusão só funciona para cadastros criados por engano e ainda sem histórico. Caso contrário, arquive o cadastro.')) return;
  try {
    await api(`/api/${tipo}/${id}`, { method:'DELETE' });
    fecharModal(); avisar('Cadastro excluído.'); navegar(pagina);
  } catch (erro) { avisar(erro.message, 'erro'); }
}

document.querySelector('#form-login').addEventListener('submit',async(e)=>{e.preventDefault();const form=e.currentTarget;const botao=form.querySelector('button[type="submit"]');const erro=document.querySelector('#erro-login');botao.disabled=true;erro.textContent='';try{const resposta=await api('/api/sessao',{method:'POST',body:Object.fromEntries(new FormData(form))});form.reset();mostrarAplicacao(resposta.usuario);}catch(falha){erro.textContent=falha.message;}finally{botao.disabled=false;}});
document.querySelector('#mostrar-senha').addEventListener('click',()=>{const campo=document.querySelector('#form-login [name="senha"]');campo.type=campo.type==='password'?'text':'password';});
document.querySelector('#navegacao').addEventListener('click',(e)=>{const botao=e.target.closest('[data-pagina]');if(botao)navegar(botao.dataset.pagina);});
document.body.addEventListener('click',async(e)=>{const ir=e.target.closest('[data-ir]');if(ir)navegar(ir.dataset.ir);if(e.target.closest('[data-imprimir]'))window.print();if(e.target.matches('[data-recarregar]'))navegar(estado.pagina);const emp=e.target.closest('[data-emprestimo]');if(emp){try{await acaoEmprestimo(emp.dataset.emprestimo,Number(emp.dataset.id));}catch(erro){avisar(erro.message,'erro');}}const resolver=e.target.closest('[data-resolver]');if(resolver)resolverOcorrencia(Number(resolver.dataset.resolver));const hist=e.target.closest('[data-historico]');if(hist)abrirHistorico(Number(hist.dataset.historico));const livroBotao=e.target.closest('[data-livro]');if(livroBotao){const livro=estado.cache.livros.find((item)=>item.id===Number(livroBotao.dataset.id));if(livroBotao.dataset.livro==='editar')abrirFormularioLivro(livro);else mostrarUnidades(livro);}const leitor=e.target.closest('[data-leitor="editar"]');if(leitor)abrirFormularioLeitor(estado.cache.leitores.find((item)=>item.id===Number(leitor.dataset.id)));const turma=e.target.closest('[data-turma]');if(turma)abrirFormularioTurma(estado.cache.turmas.find((item)=>item.id===Number(turma.dataset.turma)));const aux=e.target.closest('[data-auxiliar]');if(aux){const item=estado.cache.usuarios.find((usuario)=>usuario.id===Number(aux.dataset.id));if(aux.dataset.auxiliar==='editar')abrirFormularioAuxiliar(item);else redefinirSenha(item);}});
document.body.addEventListener('click', async (e) => {
  const exclusoes = [
    ['[data-excluir-livro]', 'excluirLivro', 'livros', 'livros'],
    ['[data-excluir-exemplar]', 'excluirExemplar', 'exemplares', 'livros'],
    ['[data-excluir-leitor]', 'excluirLeitor', 'leitores', 'leitores'],
    ['[data-excluir-turma]', 'excluirTurma', 'turmas', 'turmas'],
  ];
  for (const [seletor, chave, recurso, pagina] of exclusoes) {
    const botao = e.target.closest(seletor);
    if (botao) { await excluirCadastro(recurso, Number(botao.dataset[chave]), pagina); return; }
  }
  const desfazer = e.target.closest('[data-desfazer-devolucao]');
  if (desfazer && await confirmar('Desfazer devolução?', 'O exemplar voltará a aparecer como emprestado. Use somente para corrigir uma baixa feita por engano.')) {
    try {
      await api(`/api/emprestimos/${desfazer.dataset.desfazerDevolucao}/desfazer-devolucao`, { method:'POST', body:{} });
      fecharModal(); avisar('Devolução desfeita.'); navegar('emprestimos');
    } catch (erro) { avisar(erro.message, 'erro'); }
  }
});
document.querySelector('#fechar-modal').addEventListener('click',fecharModal);modal.addEventListener('click',(e)=>{if(e.target===modal)fecharModal();});
document.querySelector('#sair').addEventListener('click',async()=>{await api('/api/sessao',{method:'DELETE'});mostrarLogin();});
document.querySelector('#menu-mobile').addEventListener('click',()=>document.querySelector('#barra-lateral').classList.toggle('aberta'));
const alternadorTema = document.querySelector('#alternar-tema');
function aplicarTema(escuro) {
  document.documentElement.dataset.tema = escuro ? 'escuro' : '';
  alternadorTema.setAttribute('aria-checked', String(escuro));
  alternadorTema.setAttribute('aria-label', escuro ? 'Ativar tema claro' : 'Ativar tema escuro');
  alternadorTema.title = escuro ? 'Ativar tema claro' : 'Ativar tema escuro';
}
alternadorTema.addEventListener('click',()=>{const escuro=document.documentElement.dataset.tema!=='escuro';aplicarTema(escuro);localStorage.setItem('assis-tema',escuro?'escuro':'claro');});
aplicarTema(localStorage.getItem('assis-tema')==='escuro');

(async()=>{try{const resposta=await api('/api/sessao');mostrarAplicacao(resposta.usuario);}catch{mostrarLogin();}})();
