const botaoEmprestar = document.getElementById('botaoEmprestar');
const livrosDisponiveis = document.getElementById('livrosDisponiveis');
const livrosEmprestados = document.getElementById('livrosEmprestados');

const botaoLoginHeader = document.getElementById('login');
const modalLogin = document.getElementById('modal-login');
const fecharModal = document.getElementById('fechar-modal');
const formLogin = document.getElementById('form-login');

botaoLoginHeader.addEventListener('click', () => {
    modalLogin.style.display = 'flex';
});

fecharModal.addEventListener('click', () => {
    modalLogin.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === modalLogin) {
        modalLogin.style.display = 'none';
    }
});

formLogin.addEventListener('submit', (event) => {
    event.preventDefault();
    const senha = document.getElementById('senha').value;
    if (senha) {
        modalLogin.style.display = 'none';
        document.getElementById('senha').value = '';
    }
});

const botaoTema = document.getElementById('botao-tema');
const iconeSol = document.getElementById('id-sol-tema');
const iconeLua = document.getElementById('id-lua-tema');
iconeLua.style.display = 'block';
iconeSol.style.display = 'none';


botaoTema.addEventListener('click', (event) => {
    if (iconeLua.style.display === 'block') {
        iconeLua.style.display = 'none';
        iconeSol.style.display = 'block';
        document.body.setAttribute('data-tema', 'escuro');
    } else {
        iconeLua.style.display = 'block';
        iconeSol.style.display = 'none';
        document.body.removeAttribute('data-tema');
    }
});

livrosEmprestados.addEventListener('click', (event) =>{
    const conteudo= document.getElementById('conteudo');;
    conteudo.innerHTML = '';
    const texto = document.createElement('h2');
    texto.innerHTML = `teste livros emprestados`;
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
            <label for="nomeAluno" style="color: var(--vermelho-primario);">Nome do Aluno</label>
            <input type="text" name="nomeAluno" id="nomeAluno">
        </form> `;
    conteudo.appendChild(formulario);
});
