const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- CONFIGURACIÓN FERNET ----------
const Fernet = require('fernet');

function deriveFernetKey(password, salt) {
  const key = crypto.pbkdf2Sync(
    password, salt, 390000, 32, 'sha256'
  );
  // Fernet key ha de ser base64 URL-safe de 32 bytes
  return Buffer.from(key).toString('base64');
}

function encryptFernet(plaintext, b64Key) {
  const secret = new Fernet.Secret(b64Key);
  const token = new Fernet.Token({
    secret: secret,
    time: Date.now(),
    iv: null,     // deja que la librería genere IV aleatorio
  });
  return token.encode(plaintext);
}

function decryptFernet(tokenStr, b64Key) {
  const secret = new Fernet.Secret(b64Key);
  const token = new Fernet.Token({ secret: secret, token: tokenStr, ttl: 0 });
  return token.decode();
}

// ---------- RSA ----------
function loadPublicKey(pem) {
  return crypto.createPublicKey(pem);
}

function loadPrivateKey(pem) {
  return crypto.createPrivateKey({ key: pem, format: 'pem' });
}

// ---------- CIFRADO DIRECTORIO ----------
function cifrarDirectorio(rootDir, rsaPubPem, namePassword, cryptDir) {
  const rsaPub = loadPublicKey(rsaPubPem);
  const salt = crypto.randomBytes(16);
  const fernetKey = deriveFernetKey(namePassword, salt);
  const metadata = { salt: salt.toString('base64url'), files: [] };

  const files = fs.readdirSync(rootDir);
  for (const fname of files) {
    const fullPath = path.join(rootDir, fname);
    if (!fs.statSync(fullPath).isFile()) continue;
    if (fname.endsWith('.jpg')) continue; // No ciframos miniaturas

    // AES key + IV
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cfb', aesKey, iv);
    const data = fs.readFileSync(fullPath);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

    // Cifrar AES key con RSA-OAEP
    const encAesKey = crypto.publicEncrypt(
      { key: rsaPub, oaepHash: 'sha256' }, aesKey
    );

    // Guardar archivo cifrado en cryptDir
    const anonName = encryptFernet(fname, fernetKey);
    const outputFile = path.join(cryptDir, fname + '.enc');
    fs.writeFileSync(outputFile, Buffer.concat([iv, encrypted]));

    metadata.files.push({
      encrypted_path: path.relative(cryptDir, outputFile),
      anon_name: anonName,
      name : fname, 
      rsa_encrypted_key: encAesKey.toString('base64url'),
      iv: iv.toString('base64url')
    });

    fs.unlinkSync(fullPath);
  }

  // Guardar metadata.json en cryptDir
  fs.writeFileSync(
    path.join(cryptDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
}

// ---------- CIFRADO ARCHIVO INDIVIDUAL ----------
function cifrarArchivoIndividual(inputFile, rsaPubPem, namePassword, cryptDir) {
  const rsaPub = loadPublicKey(rsaPubPem);

  // Metadata path
  const metadataPath = path.join(cryptDir, 'metadata.json');

  // Cargar o crear metadata
  let metadata = { salt: null, files: [] };
  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath));
    } catch {
      metadata = { salt: null, files: [] };
    }
  }

  // Si no existe salt, crearlo y guardar ya que es necesario para deriveFernetKey
  if (!metadata.salt) {
    const salt = crypto.randomBytes(12);
    metadata.salt = salt.toString('base64url');
  }
  const saltBuffer = Buffer.from(metadata.salt, 'base64url');

  const fernetKey = deriveFernetKey(namePassword, saltBuffer);

  const fname = path.basename(inputFile);

  // Leer archivo a cifrar
  const data = fs.readFileSync(inputFile);

  // AES key + IV (12 bytes para GCM es lo recomendado)
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  // Crear cipher AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Cifrar AES key con RSA (OAEP SHA256)
  const encAesKey = crypto.publicEncrypt(
    { key: rsaPub, oaepHash: 'sha256' }, aesKey
  );

  // Nombre archivo cifrado (anonimizado)
  const anonName = encryptFernet(fname, fernetKey);
  const outputFile = path.join(cryptDir, fname + '.enc');

  // Crear cryptDir si no existe
  if (!fs.existsSync(cryptDir)) fs.mkdirSync(cryptDir, { recursive: true });

  // Guardar archivo cifrado con formato: [IV][ENCRYPTED][AUTHTAG]
  fs.writeFileSync(outputFile, Buffer.concat([iv, encrypted, authTag]));

  // Añadir a metadata
  metadata.files.push({
    encrypted_path: outputFile,
    anon_name: anonName,
    name : fname,
    rsa_encrypted_key: encAesKey.toString('base64url'),
    iv: iv.toString('base64url'),
    auth_tag: authTag.toString('base64url')
  });

  // Guardar metadata actualizado
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Borrar archivo original
  fs.unlinkSync(inputFile);
}


// ---------- DESCIFRADO DIRECTORIO ----------
// function descifrarDirectorio(rootDir, rsaPrivPem, namePassword) {
//   const rsaPriv = loadPrivateKey(rsaPrivPem);
//   const metadataPath = path.join(rootDir, 'metadata.json');
//   if (!fs.existsSync(metadataPath)) throw new Error('metadata.json no encontrado');
//   const metadata = JSON.parse(fs.readFileSync(metadataPath));

//   const salt = Buffer.from(metadata.salt, 'base64url');
//   const fernetKey = deriveFernetKey(namePassword, salt);

//   for (const entry of metadata.files) {
//     const encFull = path.join(rootDir, entry.encrypted_path);
//     const fileBuf = fs.readFileSync(encFull);

//     const iv = Buffer.from(entry.iv, 'base64url');
//     const encrypted = fileBuf.slice(iv.length);

//     // Descifrar AES key
//     const aesKey = crypto.privateDecrypt(
//       { key: rsaPriv, oaepHash: 'sha256' },
//       Buffer.from(entry.rsa_encrypted_key, 'base64url')
//     );

//     // Descifrar contenido
//     const decipher = crypto.createDecipheriv('aes-256-cfb', aesKey, iv);
//     const data = Buffer.concat([decipher.update(encrypted), decipher.final()]);

//     // Recuperar nombre original
//     const origName = decryptFernet(entry.anon_name, fernetKey);
//     const outPath = path.join(rootDir, origName);
//     fs.writeFileSync(outPath, data);
//     fs.unlinkSync(encFull);
//   }
// }

module.exports = {
  cargarRsaPublicaDeString: loadPublicKey,
  cargarRsaPrivada: loadPrivateKey,
  cifrarDirectorio,
  cifrarArchivoIndividual
};
