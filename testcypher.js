const fs = require( 'fs')

const {
  cifrarArchivoIndividual,
} = require('./cypherv2');

const rsaPubPem =  fs.readFileSync('g22public_key.pem', 'utf-8');
const password = 'nuncaterindas';
const archivoAEncriptar = 'C:/test_videos/screen_1746143200691.mp4';
const carpetaEncrypted = './test_videos/';

cifrarArchivoIndividual(archivoAEncriptar, rsaPubPem, password, carpetaEncrypted);

console.log('Archivo cifrado individualmente y metadata actualizada');