const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

function criarSenhaProtegida(senha, salt = randomBytes(16).toString('hex')) {
  if (typeof senha !== 'string' || senha.length < 8) {
    throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  }

  return {
    salt,
    hash: scryptSync(senha, salt, 64).toString('hex'),
  };
}

function senhaConfere(senha, hashEsperado, salt) {
  const recebido = scryptSync(senha, salt, 64);
  const esperado = Buffer.from(hashEsperado, 'hex');
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

module.exports = { criarSenhaProtegida, senhaConfere };
