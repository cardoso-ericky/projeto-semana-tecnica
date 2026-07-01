CREATE DATABASE biblioteca;
USE biblioteca;

CREATE TABLE livro (
    idLivro INT PRIMARY KEY,
    titulo VARCHAR(200),
    edicao CHAR(5),
    editora VARCHAR(100),
    unidades INT,
    genero VARCHAR(200),
    ano INT
);

CREATE TABLE aluno (
    idAluno INT,
    nome VARCHAR(100),
    turma CHAR(3),
    turno ENUM('MANHÃ', 'TARDE', 'NOITE'),
    fk_Leitor_idLeitor INT,
    PRIMARY KEY (idAluno, fk_Leitor_idLeitor)
);

CREATE TABLE professor (
    idProfessor INT,
    nome VARCHAR(100),
    fk_Leitor_idLeitor INT,
    PRIMARY KEY (idProfessor, fk_Leitor_idLeitor)
);

CREATE TABLE Leitor (
    idLeitor INT PRIMARY KEY,
    nome VARCHAR(200),
    telefone CHAR(20)
);

CREATE TABLE Empréstimo (
    datainicial DATE,
    datadevolucao DATE,
    fk_Leitor_idLeitor INT
);

CREATE TABLE Exemplar (
    estado VARCHAR(200),
    fk_livro_idLivro INT
);

CREATE TABLE funcionario (
    nome VARCHAR(100),
    idfuncionario INT,
    fk_Leitor_idLeitor INT,
    PRIMARY KEY (idfuncionario, fk_Leitor_idLeitor)
);
 
ALTER TABLE aluno ADD CONSTRAINT FK_aluno_2
    FOREIGN KEY (fk_Leitor_idLeitor)
    REFERENCES Leitor (idLeitor)
    ON DELETE CASCADE;
 
ALTER TABLE professor ADD CONSTRAINT FK_professor_2
    FOREIGN KEY (fk_Leitor_idLeitor)
    REFERENCES Leitor (idLeitor)
    ON DELETE CASCADE;
 
ALTER TABLE Empréstimo ADD CONSTRAINT FK_Empréstimo_1
    FOREIGN KEY (fk_Leitor_idLeitor)
    REFERENCES Leitor (idLeitor)
    ON DELETE CASCADE;
 
ALTER TABLE Exemplar ADD CONSTRAINT FK_Exemplar_1
    FOREIGN KEY (fk_livro_idLivro)
    REFERENCES livro (idLivro)
    ON DELETE CASCADE;
 
ALTER TABLE funcionario ADD CONSTRAINT FK_funcionario_2
    FOREIGN KEY (fk_Leitor_idLeitor)
    REFERENCES Leitor (idLeitor)
    ON DELETE CASCADE;