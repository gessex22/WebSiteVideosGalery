const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const _ = require("lodash");
const ffmpeg = require("fluent-ffmpeg");
const recursiveReadDir = require("recursive-readdir");
const { v4: uuidv4 } = require("uuid");

const videosDir = path.join(process.env.PATHFILE);
const thumbnailsDir = path.join(__dirname, "public/images/thumbnails");
const videoDataFile = path.join(__dirname, "videos.json");
const videoDataErr = path.join(__dirname, "errs/err.json");
const allowedExtension = [".mp4", ".avi", ".mkv"];

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Función para generar miniatura de un video
function generateThumbnail(videoPath, name) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        folder: thumbnailsDir,
        size: "320x240",
        filename: name,
      })
      .on("end", () => resolve())
      .on("error", (err) => reject(err));
  });
}

// Función para obtener lista de videos de forma recursiva
async function getVideoList(dir) {
  let files = await readdir(dir);
  files = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(dir, file);
      const stats = await stat(filePath);
      if (stats.isDirectory()) {
        return getVideoList(filePath); // Recursivamente obtener videos en subdirectorios
      } else if (isVideoFile(filePath)) {
        const relativePath = path
          .relative(videosDir, filePath)
          .replace(/\\/g, "/"); // Ruta relativa usando '/' como separador
        return relativePath; // Devuelve la ruta relativa del archivo de video
      }
    })
  );
  return files.flat().filter((file) => file !== undefined);
}

// Función para verificar si un archivo es un archivo de video
function isVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return allowedExtension.includes(ext);
}

async function getDateofBirth(pathFile) {
  try {
    const data = await fs.statSync(pathFile);
    return data;
  } catch (error) {
    console.log(`error al obtener fecha de creacion` + error);
    return null;
  }
}

// Función para generar datos de video y miniatura y escribir a JSON
async function generateVideoData() {
  const videoList = await getVideoList(videosDir);
  const videosData = [];
  const videoErr = [];

  for (let i = 0; i < videoList.length; i++) {
    const videoPath = path.join(videosDir, videoList[i]);
    const videoName = path.parse(videoPath).name;
    const thumbnailName = uuidv4();
    //const thumbnailPath = path.join(thumbnailsDir, `${path.basename(videoPath, path.extname(videoPath))}.png`);
    const thumbnailPath = path.join(thumbnailsDir, `${thumbnailName}.png`);
    const dateOfCreation = await getDateofBirth(videoPath);
    // Generar miniatura si no existe
    if (!fs.existsSync(thumbnailPath)) {
      try {
        await generateThumbnail(videoPath, thumbnailName);
      } catch (err) {
        console.error("Error al generar miniatura para", videoPath);

        videoErr.push({
          videoPath,
          msgErr: err,
        });
        continue; // Continuar con el siguiente archivo
      }
    }

    // Agregar datos del video al arreglo
    videosData.push({
      id: i + 1,
      identificador: uuidv4(),   
      name: videoName,
      videoPath: `/videos/${videoList[i]}`, // Ruta relativa del video
      //thumbnailPath: `/thumbnails/${path.basename(videoPath, path.extname(videoPath))}.png`, // Ruta relativa de la miniatura
      thumbnailPath: `/images/thumbnails/${thumbnailName}.png`, // Ruta relativa de la miniatura
      dateOfCreationMs: `${dateOfCreation.birthtimeMs}`,
      dateOfCreation: `${dateOfCreation.birthtime}`,
    });
  }
  console.log("Datos de videos generados correctamente en videos.json");
  // ordenar en orden acendente
  const videosJson = videosData;
  videosJson.sort(
    (b, a) => new Date(a.dateOfCreation) - new Date(b.dateOfCreation)
  );

  // Escribir los datos de videos a un archivo JSON
  fs.writeFileSync(videoDataFile, JSON.stringify(videosJson, null, 2));
  fs.writeFileSync(videoDataErr, JSON.stringify(videoErr, null, 2));
  console.log("Datos ordenados");
}

generateVideoData();
const lagForCerialization = _.debounce(generateVideoData, 100);

const updateGalery = () => {
  console.log("Demon galery run..");
  fs.watch(videosDir, { recursive: true }, (event, fileName) => {
    if (allowedExtension.some((ext) => fileName.endsWith(ext))) {
      if (event === "rename") {
        console.log(`Updated Dir ${event} - ${fileName}`);
        lagForCerialization();
      }
    }
  });
};

module.exports = {
  updateGalery,
};
