const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Fernet = require('fernet');
const generarMiniatura = require('./genMinis'); // 👈 lo importamos aquí

function deriveFernetKey(password, salt) {
  const key = crypto.pbkdf2Sync(password, salt, 390000, 32, 'sha256');
  return Buffer.from(key).toString('base64');
}

function encryptFernet(plaintext, b64Key) {
  const secret = new Fernet.Secret(b64Key);
  const token = new Fernet.Token({ secret, time: Date.now(), iv: null });
  return token.encode(plaintext);
}

function loadPublicKey(pem) {
  return crypto.createPublicKey(pem);
}

function loadPrivateKey(pem) {
  return crypto.createPrivateKey({ key: pem, format: 'pem' });
}

// ---------- CIFRADO DE ARCHIVO ----------
async function cifrarArchivoIndividual(inputFile, rsaPubPem, namePassword, cryptDir) {
  const rsaPub = loadPublicKey(rsaPubPem);

  // Metadata path
  const metadataPath = path.join(cryptDir, 'metadata.json');
  let metadata = { salt: null, files: [] };
  if (fs.existsSync(metadataPath)) {
    try { metadata = JSON.parse(fs.readFileSync(metadataPath)); }
    catch { metadata = { salt: null, files: [] }; }
  }

  // Salt
  if (!metadata.salt) {
    const salt = crypto.randomBytes(16);
    metadata.salt = salt.toString('base64url');
  }
  const saltBuffer = Buffer.from(metadata.salt, 'base64url');
  const fernetKey = deriveFernetKey(namePassword, saltBuffer);

  const fname = path.basename(inputFile);
  const uuid = uuidv4(); // UUID que usaremos como referencia
  const anonName = encryptFernet(fname, fernetKey); // nombre cifrado para metadata

  // AES-GCM
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);

  // Crear carpeta si no existe
  if (!fs.existsSync(cryptDir)) fs.mkdirSync(cryptDir, { recursive: true });
  const outputFile = path.join(cryptDir, `${uuid}.enc`);
  const outputStream = fs.createWriteStream(outputFile);

  // Escribir primero el IV
  outputStream.write(iv);

  // Stream de lectura → cifrado → escritura
  await new Promise((resolve, reject) => {
    const inputStream = fs.createReadStream(inputFile);

    inputStream.pipe(cipher).pipe(outputStream);

    outputStream.on("finish", resolve);
    outputStream.on("error", reject);
    inputStream.on("error", reject);
  });

  const authTag = cipher.getAuthTag();

  // Cifrar AES con RSA-OAEP
  const encAesKey = crypto.publicEncrypt({ key: rsaPub, oaepHash: 'sha256' }, aesKey);

  // Append authTag al final del archivo
  fs.appendFileSync(outputFile, authTag);

  // Generar thumbnail con el mismo UUID
  const thumbnailsDir = process.env.PATH_THUMBNAILS || "public/images/thumbnails";
  if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });
  const thumbnailPath = path.join(thumbnailsDir, `${uuid}.png`);
  await generarMiniatura(inputFile, thumbnailPath);

  // Guardar en metadata
  metadata.files.push({
    uuid,
    original_name: fname,
    anon_name: anonName,
    encrypted_path: `${uuid}.enc`,
    rsa_encrypted_key: encAesKey.toString('base64url'),
    iv: iv.toString('base64url'),
    auth_tag: authTag.toString('base64url'),
    thumbnailPath
  });

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  fs.unlinkSync(inputFile); // borrar original
}



function cifrarDirectorio(rootDir, rsaPubPem, namePassword, cryptDir) {
  const files = fs.readdirSync(rootDir);
  for (const f of files) {
    const fullPath = path.join(rootDir, f);
    if (!fs.statSync(fullPath).isFile()) continue;
    if (f.endsWith('.jpg')) continue;
    cifrarArchivoIndividual(fullPath, rsaPubPem, namePassword, cryptDir);
  }
}

module.exports = {
  loadPublicKey,
  loadPrivateKey,
  cifrarArchivoIndividual,
  cifrarDirectorio
};


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

// module.exports = {
//   cargarRsaPublicaDeString: loadPublicKey,
//   cargarRsaPrivada: loadPrivateKey,
//   cifrarDirectorio,
//   cifrarArchivoIndividual
// };
