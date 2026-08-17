# Aplicação local offline com SQLite e executável congelado

O Assis será executado exclusivamente em um computador Windows, sem servidor remoto ou acesso pela rede. Adotamos HTML, CSS e JavaScript servidos por um processo local Node `24.19.0` empacotado com SEA, SQLite embutido, assets locais e instalação por usuário porque o uso precisa ser offline, invisível tecnicamente para a bibliotecária e sem dependências externas em runtime; Node, npm, postject e Inno Setup ficam congelados nas versões registradas no planejamento, e qualquer atualização exige gerar e validar novamente o instalador.
