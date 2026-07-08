
const botaoEmprestar = document.getElementById('emprestar');
const livrosDisponiveis = document.getElementById('livrosDisponiveis');
const livrosEmprestados = document.getElementById('livrosEmprestados');

livrosEmprestados.addEventListener('click', (event) =>{
    const conteudo= document.getElementById('conteudo');;
    conteudo.innerHTML = '';
    const texto = document.createElement('h2');
    texto.innerHTML = `teste livros empretados`;
    texto.style.color = 'yellow';
    texto.style.fontSize = '40px'
    conteudo.appendChild(texto);
})

livrosDisponiveis.addEventListener('click', (event) => {
    const conteudo = document.getElementById('conteudo');
    conteudo.innerHTML = '';
    const texto = document.createElement('h2');
    texto.innerHTML = `Teste Livro Disponiveis`;
    texto.style.color = 'yellow';
    texto.style.fontSize = '40px';
    conteudo.appendChild(texto);
});

botaoEmprestar.addEventListener('click', (event) => {
    const conteudo = document.getElementById('conteudo');
    conteudo.innerHTML = '';
    const formulario = document.createElement('div');
    formulario.innerHTML = `
        <form id="formularioEmprestimo" action="">
            <label for="nomeAluno">Nome do Aluno</label>
            <input type="text" name="nomeAluno" id="nomeAluno">
        </form> `;
    conteudo.appendChild(formulario);
});