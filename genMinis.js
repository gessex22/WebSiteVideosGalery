const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function generarMiniatura(videoPath, thumbnailFullPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('child_process').spawn('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-ss', '00:00:02.000',
      '-vframes', '1',
      thumbnailFullPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

module.exports = generarMiniatura;
