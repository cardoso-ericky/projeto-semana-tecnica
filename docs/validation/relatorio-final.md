# Relatório de validação — Assis

Data: 17 de agosto de 2026.

## Resultado automatizado

- `npm test`: 15 testes aprovados, 0 falhas.
- Limite testado: API HTTP pública com SQLite temporário real, sem mocks dos módulos do Assis.
- Cobertura comportamental: login, sessão, papéis, auxiliares, turmas, leitores, livros, exemplares, empréstimo, prazo, devolução, cancelamento, desfazimento, perda, encerramento de ocorrência, histórico e backup inválido.
- `npm run qa:browser`: login inválido/válido, todas as áreas da navegação, cadastro de turma, aluno e livro, empréstimo e devolução aprovados.
- Navegador: nenhum erro de console, nenhuma requisição externa e nenhuma rolagem horizontal em 375 px.
- Revisão estática da interface: nenhum alerta. Não existe baseline visual anterior, portanto a comparação automática de regressão visual é inconclusiva; as capturas desktop e mobile foram revisadas manualmente.
- `npm audit`: 0 vulnerabilidades conhecidas.
- `git diff --check`: nenhum erro de espaço ou patch.

## Empacotamento

- Node: `24.19.0`.
- npm: `11.17.0`.
- postject: `1.0.0-alpha.6`.
- Inno Setup: `6.7.3` oficial, com instalador de ferramenta verificado por SHA-256.
- `Assis.exe`: PE x64 com subsistema GUI e recurso `NODE_SEA_BLOB` presente.
- Smoke test sob Wine 11: saúde local, login inicial e fonte incorporada responderam corretamente sem Node instalado no ambiente.
- `Instalar Assis.exe`: compilação concluída em português, por usuário, com atalhos e ícone da logo.

## Artefatos

- `dist/windows/Assis.exe` — SHA-256 `f196e0318dc705b3c607e43377fb44cbd552eedd061fd207c06739a4637d8584`.
- `dist/Instalar Assis.exe` — SHA-256 `a5b65350d26ce42abcc73f5ec26807b11cd20cec2e59e3b91654042f9095e60d`.
- Os mesmos valores estão nos arquivos `SHA256SUMS.txt` das respectivas pastas.

## Aceite manual ainda necessário

Antes de instalar no computador definitivo, executar em Windows 10 ou 11 x64:

1. Instalar sem privilégios administrativos e com a rede desligada.
2. Confirmar atalhos, ícone, ausência de console e abertura do navegador.
3. Abrir o atalho duas vezes e confirmar que continua existindo apenas uma instância.
4. Fazer um empréstimo, devolução, backup e restauração.
5. Reiniciar o Windows e confirmar a persistência do banco.
6. Reinstalar e desinstalar, confirmando que `%LOCALAPPDATA%\Assis` permanece preservado.

Esse aceite depende de um Windows real e não pode ser certificado apenas pelo ambiente Linux/Wine usado no desenvolvimento.
