# Assis — biblioteca escolar local e offline

O **Assis** é um sistema pequeno para registrar o acervo e a circulação de livros de uma biblioteca escolar. Ele foi desenhado para funcionar em **um único computador Windows**, sem internet, sem servidor externo e sem serviços na nuvem.

A interface é feita com HTML, CSS e JavaScript puro. O mesmo aplicativo inicia um servidor HTTP apenas no próprio computador, grava os dados em SQLite e abre a interface no navegador padrão.

> Este documento é também o manual técnico do projeto. Comece pela execução rápida e depois use o sumário para entender ou alterar cada parte.

## Sumário

- [O que o sistema faz](#o-que-o-sistema-faz)
- [Tecnologias e versões congeladas](#tecnologias-e-versões-congeladas)
- [Executar o projeto para desenvolver](#executar-o-projeto-para-desenvolver)
- [Como o aplicativo funciona](#como-o-aplicativo-funciona)
- [Mapa de pastas e arquivos](#mapa-de-pastas-e-arquivos)
- [Fluxo de uma operação](#fluxo-de-uma-operação)
- [Banco de dados SQLite](#banco-de-dados-sqlite)
- [Dicionário completo das tabelas](#dicionário-completo-das-tabelas)
- [Regras de negócio importantes](#regras-de-negócio-importantes)
- [API local](#api-local)
- [Front-end](#front-end)
- [Login, sessões e auxiliares](#login-sessões-e-auxiliares)
- [Backups, restauração e mudança de computador](#backups-restauração-e-mudança-de-computador)
- [Como criar ou alterar um CRUD](#como-criar-ou-alterar-um-crud)
- [Testes e validação manual](#testes-e-validação-manual)
- [Gerar o executável e o instalador](#gerar-o-executável-e-o-instalador)
- [Instalar, atualizar e desinstalar](#instalar-atualizar-e-desinstalar)
- [Como compartilhar o projeto](#como-compartilhar-o-projeto)
- [O que deve e não deve entrar no Git](#o-que-deve-e-não-deve-entrar-no-git)
- [Solução de problemas](#solução-de-problemas)
- [Checklist antes de entregar uma mudança](#checklist-antes-de-entregar-uma-mudança)
- [Glossário](#glossário)

## O que o sistema faz

O Assis oferece:

- login de um administrador e de auxiliares cadastrados pelo administrador;
- cadastro, edição, arquivamento e busca de turmas;
- cadastro, edição, arquivamento e busca de alunos, professores e funcionários;
- cadastro de livros e dos exemplares físicos de cada livro;
- consulta de livros disponíveis, emprestados e com pendências;
- empréstimo com prazo padrão de sete dias;
- edição do cadastro do leitor durante o empréstimo;
- devolução, cancelamento, alteração de prazo e desfazimento de devolução;
- registro de livro perdido ou danificado;
- histórico do leitor e trilha simples de quem emprestou ou recebeu a devolução;
- painel resumido;
- backup automático, backup manual e restauração pela interface;
- verificação da integridade da instalação e reinstalação protegida do banco.

Ele não possui acesso pela rede, sincronização, importação em lote, múltiplas bibliotecas ou integrações externas. Essa limitação é intencional: o sistema substitui controles feitos em tabelas por uma aplicação local simples.

## Tecnologias e versões congeladas

| Item | Versão ou escolha |
|---|---|
| Interface | HTML, CSS e JavaScript puro |
| Processo local | Node.js `24.19.0` |
| Gerenciador de pacotes | npm `11.17.0` |
| Banco | `node:sqlite`, incorporado ao Node.js |
| Testes | `node:test`, incorporado ao Node.js |
| Empacotamento | SEA do Node.js + `postject` `1.0.0-alpha.6` |
| Instalador | Inno Setup `6.7.3` |
| Sistema final | Windows 10 ou 11, x64 |

As versões estão registradas em `.nvmrc`, `.npmrc`, `package.json`, `package-lock.json` e nos scripts de build. O objetivo é conseguir reproduzir a mesma entrega no futuro.

Não há dependência npm em tempo de execução. As fontes, a logo, o HTML, o CSS e o JavaScript usados pela tela ficam dentro do próprio projeto e, no executável final, dentro do `Assis.exe`. O computador da biblioteca não precisa de Node.js nem de internet.

## Executar o projeto para desenvolver

### 1. Pré-requisitos

Instale:

- Git;
- Node.js exatamente `24.19.0`;
- npm exatamente `11.17.0`;
- um navegador moderno.

Se você usa `nvm`, a versão já está descrita em `.nvmrc`:

```bash
nvm install
nvm use
node --version
npm --version
```

O resultado esperado é:

```text
v24.19.0
11.17.0
```

### 2. Obter o código e instalar a ferramenta de build

```bash
git clone URL_DO_REPOSITORIO
cd projeto-semana-tecnica
npm ci
```

Use `npm ci` quando existir `package-lock.json`: ele instala exatamente as versões congeladas. `npm install` também funciona durante o desenvolvimento, mas pode reescrever o arquivo de lock se alguém alterar as dependências.

### 3. Executar os testes

```bash
npm test
```

Os testes criam bancos SQLite temporários fora do projeto. Eles não mexem no banco usado pelo servidor de desenvolvimento.

### 4. Iniciar o sistema

```bash
npm start
```

O comando:

1. descobre a pasta de dados do usuário;
2. cria a pasta e o banco se ainda não existirem;
3. verifica a integridade do SQLite;
4. inicia o servidor em `http://127.0.0.1:47831`;
5. abre o navegador padrão.

Mantenha o terminal aberto enquanto estiver usando o sistema. Para encerrar o servidor de desenvolvimento, pressione `Ctrl+C`.

Se executar `npm start` outra vez enquanto o Assis já estiver ativo, a segunda execução reconhece a instância existente, abre o navegador e termina. Assim, não são criados dois servidores para o mesmo banco.

### 5. Primeiro login

O banco novo recebe automaticamente a conta administradora `biblioteca-regente`. A senha inicial é fornecida separadamente a quem instala o sistema e não deve ser escrita em documentação pública. Depois do login, o administrador pode cadastrar e administrar auxiliares.

## Como o aplicativo funciona

### Visão geral

```text
┌─────────────────────────────────────────────────────────────┐
│ Computador da biblioteca                                    │
│                                                             │
│  ┌─────────────────┐   HTTP local    ┌───────────────────┐  │
│  │ Navegador       │◄───────────────►│ Assis.exe / Node  │  │
│  │ HTML + CSS + JS │  127.0.0.1      │ servidor + regras │  │
│  └─────────────────┘                 └─────────┬─────────┘  │
│                                               │ SQL          │
│                                     ┌─────────▼─────────┐   │
│                                     │ assis.sqlite      │   │
│                                     │ arquivo local     │   │
│                                     └───────────────────┘   │
└─────────────────────────────────────────────────────────────┘

                         nenhuma conexão externa
```

O navegador é somente a tela. Ele não abre o arquivo SQLite e não contém as regras críticas. O JavaScript da página envia pedidos para a API local; o back-end valida esses pedidos e usa consultas preparadas para ler ou alterar o banco.

O endereço `127.0.0.1` significa “este computador”. O servidor é ligado apenas nesse endereço e, por isso, outro computador da escola não consegue acessar o Assis pela rede.

### Inicialização pelo atalho

```text
duplo clique no atalho
          │
          ▼
há um Assis respondendo na porta 47831?
          │
     ┌────┴────┐
    sim       não
     │          │
     │          ├─ cria/verifica pastas
     │          ├─ abre/verifica o banco
     │          ├─ inicia o servidor local
     │          └─ agenda backup diário
     │
     └────────────► abre o navegador
```

Não aparece uma janela técnica para a bibliotecária. No instalador Windows, o executável usa o subsistema gráfico e inicia o navegador diretamente.

## Mapa de pastas e arquivos

```text
projeto-semana-tecnica/
├── back-end/
│   ├── iniciar.js        entrada do aplicativo e abertura do navegador
│   ├── servidor.js       HTTP, sessão, usuários e distribuição de rotas
│   ├── banco.js          conexão SQLite, esquema e conta inicial
│   ├── cadastros.js      CRUDs de turmas, leitores, livros e exemplares
│   ├── circulacao.js     empréstimos, devoluções, ocorrências e painel
│   ├── backups.js        criação, listagem e restauração de backups
│   ├── sistema.js        integridade da instalação e reparo protegido
│   ├── arquivos.js       entrega segura dos arquivos do front-end
│   └── senhas.js         criação e comparação de hashes de senha
├── front-end/
│   ├── index.html        estrutura fixa da página, login e diálogos
│   ├── reset.css         normalização básica entre navegadores
│   ├── style.css         visual, componentes, responsividade e impressão
│   ├── script.js         páginas, estado, eventos, formulários e API
│   ├── imagemlogo.webp   logo mostrada na interface
│   └── fonts/            fontes usadas sem depender da internet
├── tests/
│   ├── ajudantes.js      servidor e cliente HTTP usados pelos testes
│   ├── autenticacao.test.js
│   ├── cadastros.test.js
│   ├── circulacao.test.js
│   ├── backups.test.js
│   └── sistema.test.js
├── scripts/
│   ├── build-windows.js  gera o executável único de Windows
│   ├── build-installer.js gera o instalador com Inno Setup
│   ├── qa-browser.js     percorre a interface num Chrome de teste
│   └── qa-sistema.js     valida o reparo usando banco temporário
├── installer/
│   ├── assis.iss         receita do instalador Windows
│   └── assis.ico         ícone do aplicativo
├── docs/
│   ├── adr/              decisões técnicas duradouras
│   └── validation/       resultado conhecido da validação da entrega
├── package.json          comandos, versões e metadados
├── package-lock.json     versões npm exatas
├── .nvmrc                versão exata do Node.js
├── .npmrc                política de versões exatas
├── .gitignore            arquivos locais que não podem ser publicados
└── README.md             este manual
```

### Responsabilidade de cada camada

| Camada | Pode fazer | Não deve fazer |
|---|---|---|
| HTML | declarar a estrutura permanente e elementos acessíveis | consultar SQLite ou conter regras de empréstimo |
| CSS | definir aparência, layout, impressão e adaptação de tela | esconder uma regra de negócio |
| JavaScript do navegador | montar páginas, ler formulários e chamar a API | confiar que um dado já é válido |
| Servidor | autenticar, validar, aplicar regras e responder JSON | depender de internet |
| Módulos de domínio | executar consultas e transações do seu assunto | manipular elementos do navegador |
| SQLite | persistir e reforçar unicidade, relações e estados válidos | decidir sozinho toda a experiência da tela |

## Fluxo de uma operação

Exemplo: devolução de um livro.

```text
1. Usuário clica em “Devolver”
              │
2. front-end/script.js envia POST /api/emprestimos/:id/devolucao
              │
3. servidor.js identifica a sessão e o usuário
              │
4. circulacao.js valida o empréstimo e inicia a alteração
              │
5. SQLite muda o status e registra quem recebeu a devolução
              │
6. API responde JSON com sucesso ou erro conhecido
              │
7. front-end atualiza a lista e mostra uma mensagem
```

As respostas de erro seguem o mesmo formato:

```json
{
  "error": {
    "code": "codigo_curto",
    "message": "Explicação legível para a pessoa usuária.",
    "fields": {
      "campo": "Problema específico do campo."
    }
  }
}
```

`fields` aparece somente quando o erro pertence a campos específicos.

## Banco de dados SQLite

### Onde o banco fica

No Windows instalado:

```text
%LOCALAPPDATA%\Assis\data\assis.sqlite
```

No Linux usado para desenvolvimento:

```text
${XDG_DATA_HOME:-~/.local/share}/Assis/data/assis.sqlite
```

Os dados ficam fora da pasta do programa. Atualizar ou desinstalar o executável não apaga o acervo. Nunca coloque o banco real da escola dentro do repositório.

### Criação e abertura

`back-end/banco.js` cria o banco e todas as tabelas na primeira execução. Em cada abertura ele:

- ativa chaves estrangeiras com `PRAGMA foreign_keys = ON`;
- usa o modo de diário WAL;
- executa `PRAGMA quick_check` para detectar corrupção;
- cria o esquema dentro de uma transação;
- registra a versão do esquema;
- cria a conta administradora inicial se não houver usuários.

Datas com horário são armazenadas como texto ISO em UTC, por exemplo `2026-08-16T15:42:10.000Z`. Datas escolares sem horário usam `AAAA-MM-DD`.

### Diagrama de relações

```text
                              ┌──────────────┐
                              │  usuarios    │
                              └───┬──────┬───┘
                                  │      │
                   empresta/baixa │      │ registra
                                  │      │
┌─────────┐ 1        N ┌──────────▼───┐  │  ┌─────────────────────┐
│ turmas  ├────────────►  leitores    │  └─►│ eventos_emprestimo  │
└─────────┘              └──────┬──────┘     └──────────▲──────────┘
                               │ 1                       │ N
                               │                         │
                               │ N                 1     │
                        ┌──────▼────────┐────────────────┘
                        │ emprestimos   │
                        └──────┬────────┘
                               │ N
                               │
                               │ 1
┌─────────┐ 1        N ┌──────▼───────┐ 1        N ┌──────────────────┐
│ livros  ├────────────►  exemplares  ├────────────► eventos_exemplar │
└─────────┘              └──────────────┘           └────────▲─────────┘
                                                              │
                                                   usuarios ──┘ registra
```

Leitura rápida:

- uma turma possui muitos leitores, mas um aluno pertence a uma turma;
- um livro possui um ou mais exemplares físicos;
- um leitor pode ter vários empréstimos ao longo do tempo;
- cada empréstimo aponta para um exemplar;
- usuários aparecem nos empréstimos e eventos para formar o histórico de responsabilidade.

## Dicionário completo das tabelas

### `schema_migrations`

Controla quais versões estruturais já foram aplicadas.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `versao` | INTEGER | sim | chave primária |
| `aplicada_em` | TEXT | sim | instante ISO da aplicação |

O esquema atual é a versão `1`. Ao mudar tabelas em uma versão já instalada, não basta editar o `CREATE TABLE`: crie uma nova migração numerada para preservar os dados existentes.

### `usuarios`

Contém o administrador e os auxiliares que podem operar o sistema.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `id` | INTEGER | sim | chave primária autoincremental |
| `nome` | TEXT | sim | nome exibido no histórico |
| `usuario` | TEXT | sim | login único, sem diferenciar maiúsculas |
| `senha_hash` | TEXT | sim | resultado criptográfico; nunca é a senha aberta |
| `senha_salt` | TEXT | sim | valor aleatório usado no hash |
| `perfil` | TEXT | sim | `administrador` ou `auxiliar` |
| `ativo` | INTEGER | sim | `1` ativo, `0` desativado |
| `criado_em` | TEXT | sim | instante ISO |
| `atualizado_em` | TEXT | sim | instante ISO |

### `turmas`

Agrupa os alunos por nome, turno e ano letivo.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `id` | INTEGER | sim | chave primária autoincremental |
| `nome` | TEXT | sim | exemplo: `1º A` |
| `turno` | TEXT | sim | `Manhã`, `Tarde`, `Noite` ou `Integral` |
| `ano_letivo` | INTEGER | sim | entre 2000 e 2200 |
| `ativo` | INTEGER | sim | arquivamento lógico |
| `criado_em` | TEXT | sim | instante ISO |
| `atualizado_em` | TEXT | sim | instante ISO |

A combinação `nome + turno + ano_letivo` é única.

### `leitores`

“Leitor” é o nome geral de qualquer pessoa que pode pegar um livro.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `id` | INTEGER | sim | chave primária autoincremental |
| `tipo` | TEXT | sim | `aluno`, `professor` ou `funcionario` |
| `nome` | TEXT | sim | nome completo |
| `identificador` | TEXT | não | matrícula ou outro código interno |
| `telefone` | TEXT | não | contato opcional |
| `turma_id` | INTEGER | depende | aluno exige turma; outros tipos não usam turma |
| `ativo` | INTEGER | sim | arquivamento lógico |
| `criado_em` | TEXT | sim | instante ISO |
| `atualizado_em` | TEXT | sim | instante ISO |

Quando preenchido, o par `tipo + identificador` é único. `turma_id` referencia `turmas.id`.

### `livros`

Representa a obra bibliográfica. Um livro pode possuir vários exemplares físicos.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `id` | INTEGER | sim | chave primária autoincremental |
| `titulo` | TEXT | sim | título da obra |
| `autor` | TEXT | sim | autor principal |
| `editora` | TEXT | não | campo opcional |
| `edicao` | TEXT | não | campo opcional |
| `ano_publicacao` | INTEGER | não | ano da edição |
| `genero` | TEXT | não | categoria livre |
| `ativo` | INTEGER | sim | arquivamento lógico |
| `criado_em` | TEXT | sim | instante ISO |
| `atualizado_em` | TEXT | sim | instante ISO |

### `exemplares`

Representa cada cópia física de um livro.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `id` | INTEGER | sim | chave primária autoincremental |
| `livro_id` | INTEGER | sim | referencia `livros.id` |
| `codigo` | TEXT | não | tombo ou código único, se preenchido |
| `estado` | TEXT | sim | `normal`, `perdido`, `danificado`, `manutencao` ou `arquivado` |
| `criado_em` | TEXT | sim | instante ISO |
| `atualizado_em` | TEXT | sim | instante ISO |

Disponibilidade não é uma coluna. Ela é calculada: o exemplar precisa estar `normal` e não pode ter empréstimo ativo.

### `emprestimos`

Registra a saída, o prazo e a eventual devolução de um exemplar.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `id` | INTEGER | sim | chave primária autoincremental |
| `leitor_id` | INTEGER | sim | referencia `leitores.id` |
| `exemplar_id` | INTEGER | sim | referencia `exemplares.id` |
| `emprestado_por` | INTEGER | sim | usuário que registrou a saída |
| `devolvido_por` | INTEGER | não | usuário que recebeu a devolução |
| `data_saida` | TEXT | sim | data `AAAA-MM-DD` |
| `data_prevista` | TEXT | sim | prazo `AAAA-MM-DD` |
| `devolvido_em` | TEXT | não | instante ISO da devolução |
| `status` | TEXT | sim | `ativo`, `devolvido`, `cancelado` ou `encerrado_sem_devolucao` |
| `criado_em` | TEXT | sim | instante ISO |
| `atualizado_em` | TEXT | sim | instante ISO |

Um índice parcial impede que o mesmo exemplar tenha dois empréstimos ativos ao mesmo tempo.

### `eventos_exemplar`

Mantém a trilha das mudanças de estado de um exemplar.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `id` | INTEGER | sim | chave primária autoincremental |
| `exemplar_id` | INTEGER | sim | exemplar alterado |
| `estado_anterior` | TEXT | não | estado antes da mudança |
| `estado_novo` | TEXT | sim | estado depois da mudança |
| `usuario_id` | INTEGER | sim | quem registrou a mudança |
| `criado_em` | TEXT | sim | instante ISO |

### `eventos_emprestimo`

Registra acontecimentos adicionais sem apagar o que ocorreu antes.

| Coluna | Tipo | Obrigatória | Regra |
|---|---|---:|---|
| `id` | INTEGER | sim | chave primária autoincremental |
| `emprestimo_id` | INTEGER | sim | empréstimo relacionado |
| `tipo` | TEXT | sim | tipo do acontecimento |
| `usuario_id` | INTEGER | sim | quem realizou a ação |
| `detalhes` | TEXT | não | objeto JSON serializado com dados auxiliares |
| `criado_em` | TEXT | sim | instante ISO |

## Regras de negócio importantes

### Cadastro e arquivamento

- Cadastros podem ser editados depois de criados.
- Administrador e auxiliares podem editar leitores, inclusive dentro do fluxo de empréstimo.
- O tipo de um leitor não é trocado depois do cadastro; isso evita misturar regras e históricos.
- Um item com histórico não é apagado fisicamente: ele é arquivado.
- Exclusão física só é aceita quando não existe registro que dependa daquele cadastro.

### Livros e exemplares

- `livros` descreve a obra; `exemplares` descreve as cópias físicas.
- Dois exemplares do mesmo livro podem ter códigos e estados diferentes.
- Somente exemplar em estado `normal` e sem empréstimo ativo aparece como disponível.
- Exemplar perdido, danificado, em manutenção ou arquivado não pode ser emprestado.

### Empréstimos e pendências

- O prazo sugerido é sete dias depois da saída e pode ser alterado.
- Um exemplar nunca pode ter dois empréstimos ativos.
- Um empréstimo fica atrasado quando a data prevista é anterior à data atual e ainda está ativo.
- A devolução registra o usuário que recebeu o livro.
- Cancelar e desfazer uma devolução não apagam o fato: geram eventos no histórico.
- Perda ou dano altera o estado do exemplar e mantém a pendência visível.
- Encerrar uma ocorrência sem devolução exige justificativa e não libera automaticamente o exemplar bloqueado.

### Histórico

O histórico deve responder pelo menos:

- quem pegou o exemplar;
- qual livro e exemplar foram envolvidos;
- quando saiu e qual era o prazo;
- quem registrou o empréstimo;
- quando voltou;
- quem recebeu a devolução;
- quais correções ou ocorrências foram registradas.

## API local

Todas as rotas começam com `/api`. Exceto saúde e criação de sessão, elas exigem login. Rotas administrativas exigem o perfil `administrador`.

### Sessão e usuários

| Método | Caminho | Acesso | Função |
|---|---|---|---|
| GET | `/api/saude` | público | confirma que a instância local está ativa |
| POST | `/api/sessao` | público | faz login |
| GET | `/api/sessao` | autenticado | informa a sessão atual |
| DELETE | `/api/sessao` | autenticado | encerra a sessão |
| GET | `/api/usuarios` | administrador | lista usuários |
| POST | `/api/usuarios` | administrador | cria um auxiliar |
| PUT | `/api/usuarios/:id` | administrador | edita, ativa ou desativa auxiliar |
| PUT | `/api/usuarios/:id/senha` | administrador | redefine a senha de auxiliar |

### Turmas e leitores

| Método | Caminho | Função |
|---|---|---|
| GET | `/api/turmas` | lista turmas |
| POST | `/api/turmas` | cria turma |
| PUT | `/api/turmas/:id` | edita turma |
| DELETE | `/api/turmas/:id` | exclui ou arquiva conforme dependências |
| GET | `/api/leitores` | lista e filtra leitores |
| POST | `/api/leitores` | cria leitor |
| GET | `/api/leitores/:id` | busca um leitor |
| PUT | `/api/leitores/:id` | edita leitor |
| DELETE | `/api/leitores/:id` | exclui ou arquiva conforme histórico |
| GET | `/api/leitores/:id/historico` | mostra empréstimos e eventos do leitor |

Filtros de leitores: `busca`, `tipo`, `turmaId`, `turno`, `anoLetivo` e `arquivados=1`.

### Livros e exemplares

| Método | Caminho | Função |
|---|---|---|
| GET | `/api/livros` | lista livros; aceita `busca` |
| POST | `/api/livros` | cria livro e exemplares iniciais |
| GET | `/api/livros/:id` | detalha livro e exemplares |
| PUT | `/api/livros/:id` | edita livro |
| DELETE | `/api/livros/:id` | exclui ou arquiva conforme histórico |
| GET | `/api/livros/disponiveis` | lista exemplares emprestáveis; aceita `busca` |
| POST | `/api/livros/:id/exemplares` | acrescenta exemplar |
| PUT | `/api/exemplares/:id` | edita código ou estado |
| DELETE | `/api/exemplares/:id` | exclui ou arquiva exemplar |

### Circulação

| Método | Caminho | Função |
|---|---|---|
| GET | `/api/emprestimos` | lista por `busca` e `status` |
| POST | `/api/emprestimos` | cria empréstimo |
| PUT | `/api/emprestimos/:id/prazo` | altera prazo e audita a mudança |
| POST | `/api/emprestimos/:id/devolucao` | registra devolução |
| POST | `/api/emprestimos/:id/cancelamento` | cancela lançamento incorreto |
| POST | `/api/emprestimos/:id/desfazer-devolucao` | corrige uma devolução lançada por engano |
| POST | `/api/emprestimos/:id/ocorrencia` | registra perda ou dano |
| POST | `/api/emprestimos/:id/encerramento` | encerra sem devolução, com justificativa |
| GET | `/api/pendencias` | lista atrasos e ocorrências; aceita `hoje` |
| GET | `/api/painel` | retorna os totais da tela inicial; aceita `hoje` |

### Backups

| Método | Caminho | Acesso | Função |
|---|---|---|---|
| GET | `/api/backups` | administrador | lista backups |
| POST | `/api/backups` | administrador | cria backup manual |
| GET | `/api/backups/:nome` | administrador | baixa uma cópia |
| POST | `/api/backups/restaurar` | administrador | valida e restaura SQLite enviado |

O arquivo enviado para restauração é limitado a 512 MiB.

### Configurações do sistema

| Método | Caminho | Acesso | Função |
|---|---|---|---|
| GET | `/api/sistema/status` | administrador | verifica integridade, estrutura, índices, migração e vínculos do banco |
| POST | `/api/sistema/reparar` | administrador | cria backup e reinstala o banco mantendo o acesso administrativo |

O reparo exige novamente a senha da administradora e a confirmação literal `REINICIAR`. Ele encerra todas as sessões e remove os dados operacionais atuais somente depois de criar um backup `pre-reparo-*.sqlite`.

### Códigos HTTP mais usados

| Código | Significado no projeto |
|---:|---|
| 200 | leitura ou alteração concluída |
| 201 | cadastro criado |
| 204 | operação concluída sem corpo de resposta |
| 400 | pedido malformado |
| 401 | login ausente, inválido ou expirado |
| 403 | usuário sem permissão administrativa |
| 404 | rota ou registro não encontrado |
| 409 | conflito de regra, dependência ou duplicidade |
| 413 | arquivo maior que o limite |
| 422 | campos ou estado da operação inválidos |
| 500 | falha inesperada do servidor |

## Front-end

O front-end é uma aplicação de página única sem framework. `front-end/index.html` mantém a estrutura geral; `front-end/script.js` troca o conteúdo central de acordo com a seção escolhida.

### Estado e navegação

O script mantém apenas o estado necessário para desenhar a tela atual, como usuário, rota, filtros e registros carregados. A fonte verdadeira dos dados sempre é a API/SQLite. Atualizar a página pode limpar o estado visual, mas não apaga cadastros.

O menu principal leva a painel, empréstimos, devoluções, pendências, livros, leitores, turmas e administração, conforme a permissão.

### Formulários e modais

Os formulários são construídos e ligados a eventos em JavaScript. O fluxo recomendado é:

1. abrir o modal com valores vazios ou dados existentes;
2. validar campos básicos no navegador para ajudar a pessoa usuária;
3. enviar JSON para a API;
4. tratar a resposta da API como validação definitiva;
5. fechar o modal, recarregar a lista e mostrar um aviso.

Não use HTML inserido diretamente com dados não confiáveis. Prefira `textContent` e as funções auxiliares existentes para evitar que um nome cadastrado seja interpretado como código da página.

### Estilos

`front-end/style.css` contém:

- variáveis de cor e tamanho;
- componentes de botão, campo, tabela, cartão, aviso e modal;
- layout lateral no desktop;
- adaptação para telas estreitas;
- regras de impressão;
- tema escuro;
- fontes locais declaradas com `@font-face`.

Ao criar um componente, reutilize classes existentes antes de criar variações. Teste pelo menos em largura de desktop e em 375 px.

## Login, sessões e auxiliares

- Senhas não ficam em texto aberto no banco.
- `back-end/senhas.js` usa `scrypt` e comparação segura.
- Cada auxiliar recebe um `salt` aleatório próprio.
- A sessão fica somente na memória do processo e dura até 12 horas.
- O navegador recebe um cookie `HttpOnly`, `SameSite=Strict` e sem persistência após o fechamento da sessão do navegador.
- Reiniciar o Assis encerra as sessões, mas não altera os cadastros.
- Apenas o administrador lista, cria, desativa e redefine a senha de auxiliares.
- O auxiliar pode operar os cadastros e a circulação, mas não gerencia usuários, backups nem configurações do sistema.

O sistema também verifica a origem de operações que alteram dados, usa uma política de conteúdo restrita, entrega somente arquivos estáticos conhecidos e utiliza consultas SQL preparadas. Ainda assim, ele foi projetado para uso local; abrir a porta para a rede exigiria uma nova análise técnica e de segurança.

## Backups, restauração e mudança de computador

### Pastas

No Windows:

```text
Banco:   %LOCALAPPDATA%\Assis\data\assis.sqlite
Backups: %LOCALAPPDATA%\Assis\backups\
```

### Política automática

- O servidor tenta criar um backup ao iniciar e verifica novamente a cada hora.
- Existe no máximo um backup automático por dia.
- São mantidos os 30 backups automáticos mais recentes.
- Backups manuais não entram nesse limite.
- Antes de uma restauração, o sistema cria um backup do estado anterior.
- Antes de reiniciar e reparar, o sistema cria um backup completo do estado anterior.

Nomes esperados:

```text
automatico-2026-08-16.sqlite
manual-2026-08-16T15-42-10-000Z.sqlite
pre-restauracao-2026-08-16T15-45-02-000Z.sqlite
pre-reparo-2026-08-16T16-20-00-000Z.sqlite
```

### Como restaurar

1. Entre com o administrador.
2. Abra **Administração → Backups**.
3. Escolha o arquivo `.sqlite` correto.
4. Confirme a restauração.
5. Faça login novamente quando solicitado.
6. Confira painel, livros, leitores e um histórico conhecido.

Antes de substituir o banco, o Assis abre o arquivo candidato separadamente, executa `PRAGMA integrity_check` e confere as tabelas obrigatórias. Mesmo assim, mantenha mais de uma cópia de um backup importante.

### Como mudar para outro computador

1. No computador antigo, crie e baixe um backup manual.
2. Copie esse `.sqlite` para um pendrive confiável.
3. Instale o Assis no computador novo.
4. Abra o aplicativo e entre como administrador.
5. Restaure o backup pela tela de Administração.
6. Valide alguns cadastros e históricos antes de abandonar o computador antigo.

Não copie arquivos `-wal` ou `-shm` isoladamente. Use o backup produzido pelo sistema.

## Como criar ou alterar um CRUD

CRUD significa **criar, consultar, atualizar e excluir**. No Assis, “excluir” normalmente vira arquivar quando já existe histórico.

### Passo 1: escreva a regra em linguagem comum

Antes do código, responda:

- qual é o nome do cadastro?
- quais campos são obrigatórios e opcionais?
- o que não pode se repetir?
- outro cadastro depende dele?
- ele pode ser apagado ou precisa ser arquivado?
- quem pode alterar?
- qual fato precisa aparecer no histórico?

Essa lista evita criar uma tabela que não representa a rotina da biblioteca.

### Passo 2: altere o esquema com uma nova migração

Para um exemplo fictício de editoras, a tabela poderia ser:

```sql
CREATE TABLE editoras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL COLLATE NOCASE UNIQUE,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
```

Em um banco que já existe, crie a versão `2` e execute a alteração apenas quando `schema_migrations` ainda não contiver essa versão. Faça todas as mudanças da versão em uma transação e registre `aplicada_em` somente no final.

Modelo conceitual:

```js
if (!migracaoFoiAplicada(2)) {
  banco.exec('BEGIN');
  try {
    banco.exec('CREATE TABLE ...');
    registrarMigracao(2);
    banco.exec('COMMIT');
  } catch (erro) {
    banco.exec('ROLLBACK');
    throw erro;
  }
}
```

Não copie esse trecho sem adaptar às funções reais de `back-end/banco.js`. Teste a migração em dois cenários: banco vazio e cópia de um banco da versão anterior.

### Passo 3: crie as consultas do back-end

Coloque o módulo junto do assunto mais próximo ou crie um arquivo pequeno, por exemplo `back-end/editoras.js`. Use consultas preparadas e liste explicitamente as colunas.

```js
const inserir = banco.prepare(`
  INSERT INTO editoras (nome, ativo, criado_em, atualizado_em)
  VALUES (?, 1, ?, ?)
`);

const listar = banco.prepare(`
  SELECT id, nome, ativo, criado_em, atualizado_em
  FROM editoras
  WHERE ativo = 1
  ORDER BY nome COLLATE NOCASE
`);
```

Nunca monte SQL concatenando texto vindo de formulário. Valide tipo, tamanho, valores permitidos e existência das relações antes de gravar.

### Passo 4: defina a API

Um CRUD simples costuma seguir:

```text
GET    /api/editoras       lista e pesquisa
POST   /api/editoras       cria
GET    /api/editoras/:id   detalha
PUT    /api/editoras/:id   edita
DELETE /api/editoras/:id   exclui ou arquiva
```

O módulo deve retornar `true` quando tratar uma rota e `false` quando a rota não for dele. `back-end/servidor.js` continua responsável por sessão, erros gerais e resposta de rota inexistente.

Use os mesmos formatos de sucesso e erro das rotas atuais. Para criação, responda `201`; para conflito de nome, `409`; para campos inválidos, `422`; para identificador ausente, `404`.

### Passo 5: ligue o módulo ao servidor

Importe o tratador em `back-end/servidor.js` e chame-o depois da autenticação. A ordem importa: caminhos específicos, como `/api/livros/disponiveis`, precisam ser avaliados antes de padrões genéricos com `:id`.

### Passo 6: crie a tela

Em `front-end/script.js`:

1. adicione a entrada de navegação, se necessária;
2. crie a função que carrega a lista pela API;
3. desenhe estados de carregamento, vazio, erro e sucesso;
4. crie o formulário de inclusão/edição;
5. conecte os botões por eventos;
6. recarregue os dados depois de salvar ou arquivar.

Em `front-end/index.html`, altere somente a estrutura que realmente precisa existir desde a abertura. Em `style.css`, reaproveite componentes antes de acrescentar classes.

### Passo 7: faça o teste primeiro

Crie um arquivo em `tests/` ou acrescente o comportamento ao arquivo do módulo. Um teste de CRUD deve cobrir pelo menos:

- acesso sem login negado;
- criação válida;
- campo obrigatório inválido;
- duplicidade;
- listagem ou busca;
- edição;
- exclusão sem dependência;
- arquivamento quando existe histórico;
- permissão especial, se houver.

Use a API HTTP pública do sistema e um banco temporário real, como fazem os testes atuais. Isso verifica rota, validação, regra e SQLite juntos.

### Passo 8: valide o conjunto

```bash
npm test
npm run qa:browser
git diff --check
```

Depois faça uma passagem manual no navegador, inclusive em tela estreita. Se a mudança mexer no esquema ou no empacotamento, gere e teste o instalador em Windows.

### Como alterar uma coluna existente

SQLite tem limitações em algumas alterações de coluna. Para uma mudança complexa, a migração segura normalmente é:

```text
BEGIN
  criar tabela nova com o formato desejado
  copiar e transformar os dados antigos
  conferir contagens e relações
  remover a tabela antiga
  renomear a tabela nova
  recriar índices
  registrar a versão
COMMIT
```

Faça um backup antes e escreva um teste que abre um banco antigo conhecido. Nunca apague uma coluna com dados históricos apenas porque a tela parou de mostrá-la.

## Testes e validação manual

### Testes automatizados

```bash
npm test
```

O comando usa o executor incorporado ao Node.js, sem framework adicional. A concorrência é `1` para deixar os cenários previsíveis. Cada grupo abre um servidor numa porta livre e um SQLite temporário real.

Os testes atuais cobrem:

- login, logout, sessão e permissões;
- criação, edição, ativação e senha de auxiliares;
- validações e duplicidades de turmas, leitores e livros;
- exemplares e disponibilidade;
- empréstimo, bloqueio de duplicidade e devolução;
- mudança de prazo, cancelamento e desfazimento;
- perda, pendência e encerramento justificado;
- histórico do leitor;
- criação de backup e rejeição de restauração inválida.

O teste é o alarme do projeto. Execute antes da mudança para conhecer o ponto de partida e depois para descobrir regressões. Ao corrigir um defeito, acrescente primeiro um teste que falha pelo motivo correto.

### Percurso automatizado no navegador

```bash
npm run qa:browser
```

Esse script exige Google Chrome em `/usr/bin/google-chrome`. Ele inicia uma instância temporária na porta `4173`, faz login, percorre as áreas, cadastra dados, empresta e devolve um livro, verifica o console e salva capturas em `.scratch/qa/`.

Os dados e as capturas desse percurso são temporários e não entram no Git. Se o Chrome estiver em outro caminho, ajuste a constante correspondente em `scripts/qa-browser.js`.

### Validação manual mínima

Depois de uma mudança visível:

1. testar login inválido e válido;
2. abrir todas as áreas do menu;
3. testar a operação alterada do começo ao fim;
4. testar erro, lista vazia e cadastro já preenchido;
5. verificar teclado, foco do modal e mensagens;
6. verificar desktop e largura de 375 px;
7. confirmar que o console do navegador não mostra erros;
8. confirmar que a aba Rede não acessa endereços externos.

O resultado validado da entrega atual está em [docs/validation/relatorio-final.md](docs/validation/relatorio-final.md).

## Gerar o executável e o instalador

### Executável único

```bash
npm run build:exe
```

Esse comando executa os testes e depois:

1. confere Node `24.19.0` e npm `11.17.0`;
2. reúne os módulos do back-end;
3. incorpora os arquivos do front-end;
4. cria um blob SEA do Node.js;
5. obtém o `node.exe` Windows x64 da versão congelada;
6. confere o SHA-256 do arquivo obtido;
7. injeta o aplicativo com `postject`;
8. troca o subsistema do executável para gráfico;
9. grava o hash final.

Saída:

```text
dist/windows/Assis.exe
dist/windows/SHA256SUMS.txt
```

O download feito durante o build é uma necessidade da máquina de desenvolvimento. O `Assis.exe` produzido não baixa nada quando é usado.

### Instalador Windows

```bash
npm run build:installer
```

O comando chama o build do executável e compila `installer/assis.iss`.

No Windows, instale Inno Setup `6.7.3`. Se ele não estiver no caminho padrão, defina `ISCC` apontando para `ISCC.exe`.

No Linux, o script usa Docker e uma sessão gráfica local para executar a versão oficial congelada do compilador. Docker serve somente para produzir o instalador; não faz parte da instalação na biblioteca.

Saída:

```text
dist/Instalar Assis.exe
dist/SHA256SUMS.txt
```

`dist/` é ignorada pelo Git porque contém artefatos grandes e reproduzíveis. Publique o instalador como anexo de uma versão ou entregue-o por pendrive, acompanhado do SHA-256.

### Teste obrigatório da entrega

Antes de entregar, use Windows 10 ou 11 x64 sem Node.js instalado:

1. confira o SHA-256;
2. desligue a rede;
3. instale sem privilégios administrativos;
4. abra pelo atalho;
5. confirme que não aparece console;
6. abra o atalho novamente e confirme que só há uma instância;
7. faça login, cadastro, empréstimo e devolução;
8. crie e restaure um backup;
9. reinicie o Windows e confira os dados;
10. reinstale e confirme que o banco foi preservado.

O projeto não possui certificado de assinatura de código. O Windows pode exibir SmartScreen; confirme a origem e o hash antes de escolher **Mais informações → Executar assim mesmo**.

## Instalar, atualizar e desinstalar

### Instalação para a biblioteca

1. Copie `Instalar Assis.exe` para o computador.
2. Confira o hash fornecido junto do arquivo.
3. Abra o instalador e avance.
4. Não é necessária senha de administrador do Windows.
5. Use o atalho **Assis** na Área de Trabalho ou no menu Iniciar.
6. O banco será criado automaticamente no primeiro uso.

O programa é instalado, por padrão, em:

```text
%LOCALAPPDATA%\Programs\Assis
```

### Atualização

1. Crie um backup manual.
2. Feche o navegador e encerre a instância do Assis, se estiver ativa.
3. Execute o novo instalador.
4. Abra o atalho e confira a versão/mudança.
5. Valide um cadastro e um histórico existente.

Como os dados ficam em `%LOCALAPPDATA%\Assis`, instalar uma nova versão não deve substituir o banco. Mudanças de esquema precisam ter migração compatível.

### Desinstalação

O desinstalador remove o programa e os atalhos, mas preserva `%LOCALAPPDATA%\Assis`. Isso evita apagar acidentalmente o acervo.

Se algum dia for necessário apagar definitivamente os dados, primeiro produza e valide um backup. A remoção da pasta de dados deve ser uma decisão manual e consciente, não uma função automática do instalador.

## Como compartilhar o projeto

### Compartilhar com quem vai usar

Entregue somente:

- `Instalar Assis.exe`;
- o arquivo `SHA256SUMS.txt` correspondente;
- a credencial inicial por um canal separado;
- uma orientação curta sobre backup.

Não entregue `node_modules`, código-fonte, banco de desenvolvimento ou pasta de build intermediária para a bibliotecária.

### Compartilhar uma nova versão pelo GitHub

O código e a documentação entram no repositório. O instalador entra como anexo de uma **Release**, não como commit.

Fluxo sugerido:

```bash
npm ci
npm test
npm run build:installer
git status --short
git diff --check
```

Depois de revisar e criar o commit, crie uma versão no GitHub com um nome como `v1.0.0` e anexe:

```text
Instalar Assis.exe
SHA256SUMS.txt
```

Na descrição, informe mudanças visíveis, compatibilidade Windows e passos de atualização. Não anexe nenhum `.sqlite` real.

### Compartilhar o código sem GitHub

Quando existir um commit limpo, é possível gerar um ZIP apenas com arquivos versionados:

```bash
git archive --format=zip --output=assis-codigo-fonte.zip HEAD
```

Isso respeita o que está no Git e evita incluir banco, backups, artefatos e anotações locais.

### Compartilhar os dados com outro computador

Não exponha a porta `47831` e não mude o endereço para `0.0.0.0`. Para transferir o acervo, use o backup manual e a restauração descritos anteriormente.

## O que deve e não deve entrar no Git

### Deve entrar

- código de `back-end/` e `front-end/`;
- testes;
- scripts reproduzíveis de build e validação;
- receita e ícone do instalador;
- `package.json` e `package-lock.json`;
- este README, decisões técnicas e relatórios explicativos públicos.

### Não deve entrar

- `node_modules/`;
- `dist/` e `build/`;
- bancos `*.sqlite` ou `*.db` e seus arquivos auxiliares;
- backups e dados reais da biblioteca;
- capturas e dados temporários de QA;
- logs e arquivos `.env`;
- planejamento interno, especificações de trabalho e tickets locais;
- configurações ou instruções locais de ferramentas de desenvolvimento.

O `.gitignore` cobre esses grupos. Antes de qualquer commit, execute:

```bash
git status --short --ignored
git ls-files
```

`git status --ignored` mostra também o que foi bloqueado. `git ls-files` é a lista definitiva do que já está sob controle do Git. Se um arquivo sensível já tiver sido versionado no passado, adicionar ao `.gitignore` não basta: ele precisa ser removido do índice e, se continha segredo, o segredo deve ser trocado.

Nunca use `git add .` sem ler o resultado de `git status`. Prefira adicionar somente os caminhos revisados.

## Solução de problemas

### `npm ci` recusa a versão do Node ou npm

O projeto usa `engine-strict`. Ative Node `24.19.0` e npm `11.17.0`, confirme com `node --version` e `npm --version` e tente novamente.

### O navegador não abriu

Com o processo ainda ativo, abra manualmente:

```text
http://127.0.0.1:47831
```

Se a página não responder, veja a mensagem no terminal.

### A porta `47831` já está em uso

Primeiro tente abrir o endereço acima. Se aparecer o Assis, a instância já existe. Se aparecer outro programa, encerre esse programa antes de iniciar o Assis; mudar a porta exige alterar também a lógica de reutilização da instância.

### Login expirou

A sessão dura até 12 horas e fica na memória. Reiniciar o aplicativo também encerra sessões. Faça login novamente; os dados permanecem no SQLite.

### O sistema informa banco corrompido

Não continue gravando. Preserve o arquivo atual, abra o Assis com um banco válido e restaure o backup mais recente conhecido. Depois confira históricos importantes.

### Restauração foi recusada

O arquivo pode não ser SQLite válido, pode estar corrompido ou pode não conter as tabelas do Assis. Escolha um backup gerado pelo próprio sistema, sem renomear arquivos auxiliares `-wal` ou `-shm` como se fossem o banco.

### Um livro não aparece como disponível

Confira:

- se existe exemplar cadastrado;
- se o exemplar está `normal`;
- se já há empréstimo ativo;
- se livro ou exemplar foi arquivado;
- se o filtro de busca está vazio ou corresponde ao título, autor ou código.

### `npm run qa:browser` não encontra o Chrome

Instale Google Chrome ou ajuste o caminho no começo de `scripts/qa-browser.js`. Esse comando é auxiliar; `npm test` continua sendo obrigatório.

### O build não consegue obter o Node ou Inno Setup

A máquina de build precisa de internet para obter ferramentas congeladas que ainda não estejam em cache. O script rejeita arquivos cujo SHA-256 não corresponde ao esperado. Não desative essa verificação; corrija rede, cache ou versão.

### O Windows mostra SmartScreen

O executável não é assinado. Confira se veio da entrega oficial e valide o SHA-256. Somente depois use **Mais informações → Executar assim mesmo**.

### Preciso zerar o ambiente de desenvolvimento

Primeiro faça backup. Encerre o servidor e mova a pasta de dados para outro nome, em vez de apagá-la. Ao iniciar novamente, o Assis criará um banco vazio. No Linux, a pasta padrão é `~/.local/share/Assis`; no Windows, `%LOCALAPPDATA%\Assis`.

## Checklist antes de entregar uma mudança

- [ ] A regra foi escrita de forma compreensível.
- [ ] Campos opcionais, obrigatórios e duplicidades foram definidos.
- [ ] A mudança de banco possui migração para instalações existentes.
- [ ] SQL usa parâmetros e relações são validadas.
- [ ] Exclusão respeita o histórico.
- [ ] A API mantém formatos e códigos conhecidos.
- [ ] A tela trata carregamento, vazio, erro e sucesso.
- [ ] Textos cadastrados não são injetados como HTML.
- [ ] Existe teste para o comportamento novo ou corrigido.
- [ ] `npm test` termina sem falhas.
- [ ] A interface foi verificada em desktop e 375 px.
- [ ] Nenhuma requisição externa apareceu no uso normal.
- [ ] `git diff --check` não mostra problemas.
- [ ] `git status --short --ignored` não revela banco, segredo ou anotação local prestes a entrar.
- [ ] Se houve mudança de build, o instalador foi testado em Windows sem Node.
- [ ] Se houve mudança de banco, backup e restauração foram testados.

## Glossário

| Termo | Significado neste projeto |
|---|---|
| CRUD | criar, consultar, atualizar e excluir/arquivar cadastros |
| Leitor | aluno, professor ou funcionário que pode pegar livro |
| Livro | a obra, como título e autor |
| Exemplar | uma cópia física específica do livro |
| Empréstimo | registro da saída temporária de um exemplar |
| Baixa/devolução | confirmação de que o exemplar voltou |
| Pendência | empréstimo atrasado, perda, dano ou situação ainda não resolvida |
| Arquivamento lógico | manter o registro e marcar `ativo = 0` para preservar histórico |
| Migração | alteração versionada no formato do banco existente |
| API | caminhos HTTP locais usados pela tela para falar com o servidor |
| SQLite | banco inteiro armazenado em arquivos locais |
| WAL | modo do SQLite que melhora segurança e concorrência das gravações |
| Hash | representação irreversível usada para verificar senha sem guardá-la aberta |
| SHA-256 | resumo usado para conferir se um arquivo de entrega é exatamente o esperado |
| SEA | mecanismo do Node.js para formar um executável único |

O Assis é deliberadamente simples: um computador, uma biblioteca, um banco local e um conjunto pequeno de regras que pode ser entendido e mantido por estudantes.
