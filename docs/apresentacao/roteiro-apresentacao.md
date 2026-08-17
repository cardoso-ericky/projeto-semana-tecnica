# Roteiro de apresentação — Assis

Apresentação estimada: 18 a 24 minutos. As falas abaixo são sugestões; não precisam ser decoradas palavra por palavra.

## Slide 1 — Assis

**Tempo:** 40 segundos

“O Assis é um sistema local e offline para organizar a biblioteca escolar. Ele foi desenvolvido por Samarone, Ericky, Gabriel, Thomas e Alisson usando HTML, CSS, JavaScript, Node.js e SQLite. Nesta apresentação vamos acompanhar o caminho completo: desde o clique no atalho até o registro permanente de um empréstimo.”

**Transição:** “Para entender a solução, primeiro precisamos lembrar qual era o problema.”

## Slide 2 — Antes do Assis

**Tempo:** 50 segundos

“O controle manual precisava responder a quatro perguntas o tempo todo: onde está o livro, quem levou, se o prazo acabou e quem recebeu a devolução. Quando esses fatos ficam espalhados em tabelas e anotações, uma pergunta simples exige procura e pode perder contexto.”

**Transição:** “Por isso o sistema foi dimensionado exatamente para essa rotina.”

## Slide 3 — Pequeno por decisão

**Tempo:** 50 segundos

“O Assis não tenta atender várias escolas nem funcionar como uma plataforma na nuvem. Ele atende uma biblioteca em um único computador. Isso permite funcionar sem internet e guardar tudo em um arquivo SQLite local. Há um administrador e auxiliares, mas não há servidor remoto, rede entre computadores ou arquitetura distribuída.”

**Transição:** “Mesmo pequeno, ele cobre todo o ciclo necessário.”

## Slide 4 — Funcionalidades

**Tempo:** 55 segundos

“O sistema reúne acesso local, cadastro de leitores, acervo, empréstimos, devoluções, pendências, histórico e backups. Leitor é o nome geral para aluno, professor ou funcionário. Acervo reúne o livro, que descreve a obra, e os exemplares, que são as cópias físicas.”

**Transição:** “Para quem usa, todas essas partes começam de uma forma muito simples.”

## Slide 5 — Jornada da bibliotecária

**Tempo:** 45 segundos

“A bibliotecária clica no atalho. O Assis inicia o servidor local, abre o navegador, apresenta o login e fica pronto para cadastrar, emprestar ou devolver. Se o programa já estiver ativo, um segundo clique não cria outro banco nem outro servidor: apenas abre a interface existente.”

**Transição:** “Agora vamos olhar o que existe por trás dessa experiência.”

## Slide 6 — Arquitetura

**Tempo:** 60 segundos

“Tudo acontece dentro do mesmo computador. O navegador apresenta HTML, CSS e JavaScript. Ele conversa pelo endereço local 127.0.0.1 com o processo Node.js, responsável por login, validações e API. O Node acessa o SQLite, que guarda cadastros e histórico. Nenhum desses blocos precisa acessar a internet durante o uso.”

**Transição:** “Isso também explica como os arquivos estáticos são usados.”

## Slide 7 — Arquivos estáticos

**Tempo:** 50 segundos

“O index.html contém a estrutura permanente da página. O style.css define identidade visual, componentes e responsividade. O script.js monta as páginas e chama a API local. Logo e fontes também ficam no projeto. O Node entrega apenas essa lista conhecida de arquivos, pelo mesmo endereço usado pela API.”

**Transição:** “Antes de entregar a primeira tela, o programa executa uma sequência de inicialização.”

## Slide 8 — Inicialização

**Tempo:** 60 segundos

“Primeiro o Assis procura outra instância respondendo na porta 47831. Se não encontrar, prepara as pastas, abre o SQLite, verifica a integridade, cria as tabelas necessárias e inicia o servidor apenas no endereço local. Por fim, abre o navegador. Se já encontrou a instância no primeiro passo, pula direto para a abertura da tela.”

**Transição:** “Com o sistema ativo, precisamos saber quem está realizando cada ação.”

## Slide 9 — Administrador e auxiliares

**Tempo:** 55 segundos

“O administrador já existe na instalação e pode operar o sistema, gerenciar auxiliares e cuidar dos backups. Os auxiliares podem realizar cadastros, empréstimos, devoluções e correções. Senhas são protegidas com hash, a sessão fica apenas no processo local e cada ação importante registra o usuário responsável.”

**Transição:** “Depois do login, a primeira tela resume o que merece atenção.”

## Slide 10 — Painel real

**Tempo:** 55 segundos

“Esta é uma captura real do sistema. A ação de novo empréstimo fica visível no topo. Os indicadores mostram ativos, atrasados, perdas ou danos e exemplares disponíveis. A área de atividade recente responde quem fez o quê por último. Assim, a pessoa começa pelo estado atual da biblioteca.”

**Transição:** “No código, cada responsabilidade também foi separada de forma direta.”

## Slide 11 — Módulos do back-end

**Tempo:** 60 segundos

“O iniciar.js cuida da abertura; servidor.js concentra HTTP e sessão; banco.js define SQLite; cadastros.js cuida de turmas, leitores e acervo; circulacao.js trata empréstimos e devoluções; backups.js protege as cópias; senhas.js protege credenciais; arquivos.js entrega o front-end. Essa separação ajuda alunos a localizar uma regra sem atravessar o projeto inteiro.”

**Transição:** “O mesmo princípio aparece na organização das pastas.”

## Slide 12 — Estrutura do projeto

**Tempo:** 55 segundos

“Quem quer mudar a tela começa em front-end. Quem quer mudar uma regra começa em back-end. Os testes mostram os comportamentos protegidos, os scripts geram a entrega, installer contém a instalação Windows e o README funciona como manual completo. A estrutura privilegia nomes diretos e poucos níveis.”

**Transição:** “Vamos seguir agora a ordem dos dados usados no dia a dia.”

## Slide 13 — Ordem dos cadastros

**Tempo:** 50 segundos

“Primeiro existe a turma, com nome, turno e ano letivo. Um aluno é cadastrado como leitor dessa turma. O livro descreve a obra e o exemplar identifica cada unidade física. Essa separação permite saber não apenas que a escola possui Dom Casmurro, mas qual cópia está disponível ou emprestada.”

**Transição:** “A diferença entre livro e exemplar é central para o sistema.”

## Slide 14 — Livro e exemplar

**Tempo:** 55 segundos

“Dom Casmurro é um livro, com título, autor, editora e outros dados bibliográficos. DC-001, DC-002 e DC-003 são exemplares físicos. Cada um pode estar normal, emprestado, danificado, perdido, em manutenção ou arquivado. O empréstimo sempre movimenta um exemplar específico.”

**Transição:** “Com leitor e exemplar cadastrados, podemos registrar a circulação.”

## Slide 15 — Empréstimo

**Tempo:** 60 segundos

“Na tela real, a pessoa busca o leitor, escolhe um exemplar disponível, confere a data de saída e o prazo sugerido de sete dias e confirma. A API grava leitor, exemplar e usuário que realizou a entrega. O banco impede que o mesmo exemplar tenha dois empréstimos ativos.”

**Transição:** “Nem todo empréstimo termina de uma única maneira.”

## Slide 16 — Estados da circulação

**Tempo:** 60 segundos

“O empréstimo começa ativo. A devolução registra data e responsável. Um lançamento incorreto pode ser cancelado, e uma devolução pode ser desfeita sem apagar o fato anterior. Perda ou dano mantém a pendência e altera o estado do exemplar. O encerramento sem devolução exige justificativa.”

**Transição:** “Essas mudanças aparecem como uma linha do tempo.”

## Slide 17 — Histórico

**Tempo:** 55 segundos

“O histórico acrescenta eventos em vez de reescrever o passado. Podemos ver quem emprestou, quem alterou o prazo, quem recebeu e quem corrigiu. Isso fornece uma auditoria simples, adequada a um sistema escolar local, sem criar um mecanismo complexo.”

**Transição:** “Agora veremos como essas informações se relacionam no SQLite.”

## Slide 18 — Modelo de dados

**Tempo:** 65 segundos

“Uma turma possui leitores. O leitor possui empréstimos ao longo do tempo. Cada empréstimo aponta para um exemplar, e cada exemplar pertence a um livro. Usuários aparecem nas operações e eventos para registrar responsabilidade. Eventos de empréstimo e exemplar preservam correções e mudanças de estado.”

**Transição:** “Cada uma dessas tabelas guarda um conjunto pequeno e bem definido de campos.”

## Slide 19 — Dicionário do banco

**Tempo:** 70 segundos

“Usuários guardam identidade, hash e perfil. Turmas organizam nome, turno e ano. Leitores guardam tipo, nome, contato e turma. Livros recebem os dados bibliográficos; exemplares recebem código e estado. Empréstimos ligam pessoas, unidades, operadores e datas. As tabelas de eventos guardam o que mudou, por quem e quando.”

**Transição:** “Além de armazenar, o próprio SQLite ajuda a impedir estados incorretos.”

## Slide 20 — Garantias do SQLite

**Tempo:** 60 segundos

“Chaves primárias dão identidade. Chaves estrangeiras impedem relações inexistentes. Um índice parcial impede empréstimo duplo do mesmo exemplar. Restrições CHECK limitam os valores permitidos. Itens com histórico são arquivados. Quando uma ação mexe em mais de uma tabela, uma transação garante que tudo conclua ou nada seja alterado.”

**Transição:** “Essas garantias entram em ação quando a tela chama a API.”

## Slide 21 — Da tela ao banco

**Tempo:** 60 segundos

“O clique dispara um fetch com JSON. O servidor reconhece a sessão, o módulo valida a regra, o SQLite executa a consulta e a resposta volta para atualizar a tela. A API usa códigos conhecidos: 200 para sucesso, 401 para sessão ausente, 409 para conflito e 422 para campo ou estado inválido.”

**Transição:** “Para proteger o conjunto de registros, existe uma rotina de backup.”

## Slide 22 — Backup e restauração

**Tempo:** 65 segundos

“O sistema mantém um backup automático por dia, preservando os trinta mais recentes. O administrador também cria cópias manuais. Antes de restaurar, o Assis cria outra cópia, verifica a integridade do arquivo escolhido e só então troca o banco. Esse mesmo fluxo permite migrar os dados para outro computador.”

**Transição:** “Com isso fechamos o caminho completo do sistema.”

## Slide 23 — Encerramento

**Tempo:** 45 segundos

“O Assis foi construído para ser simples de usar, claro para estudantes manterem e confiável para registrar a rotina. A demonstração final pode seguir cinco passos: entrar, cadastrar leitor, cadastrar livro e exemplar, emprestar e devolver consultando o histórico.”

**Transição para demonstração:** “Agora vamos executar esse percurso no sistema real.”

## Checklist para a demonstração ao vivo

- Iniciar o Assis antes da apresentação e manter o terminal em segundo plano.
- Usar somente dados fictícios.
- Deixar uma turma pronta caso o tempo seja curto.
- Mostrar que o exemplar some da lista de disponíveis depois do empréstimo.
- Mostrar o nome do operador na devolução e no histórico.
- Encerrar mostrando a tela de backups, sem restaurar durante a apresentação.
