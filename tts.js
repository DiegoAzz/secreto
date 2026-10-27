// tts.js - Locución Neuronal Ultra-Realista (Microsoft Edge Neural TTS)
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIO_DIR = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Voz: es-CO-SalomeNeural (Voz colombiana femenina, cálida, seductora y humana)
const VOICE = 'es-CO-SalomeNeural';
let ttsInstance = null;

async function getTts() {
  if (!ttsInstance) {
    ttsInstance = new MsEdgeTTS();
    await ttsInstance.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  }
  return ttsInstance;
}

/**
 * Genera un archivo MP3 neuronal para el texto dado.
 * Retorna la URL pública relativa (ej: /audio/abc123.mp3)
 */
async function generateSpeechAudio(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    const cleanText = text.trim();
    const hash = crypto.createHash('md5').update(cleanText + '_' + VOICE).digest('hex');
    const filename = `speech_${hash}.mp3`;
    const filePath = path.join(AUDIO_DIR, filename);

    // Si ya fue generado anteriormente, retornar la URL de inmediato
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
      return `/audio/${filename}`;
    }

    const tts = await getTts();
    const { audioStream } = tts.toStream(cleanText, {
      rate: '-5%',   // Ligeramente más pausado, seductor y envolvente
      pitch: '+0Hz',  // Tono natural humano
      volume: '+0%'
    });

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(filePath);
      audioStream.pipe(ws);
      ws.on('finish', resolve);
      audioStream.on('error', reject);
      ws.on('error', reject);
    });

    console.log(`[TTS Neuronal] Audio generado con éxito para: "${cleanText.substring(0, 35)}..."`);
    return `/audio/${filename}`;
  } catch (err) {
    console.error('[TTS Neuronal Error]', err.message);
    // Reiniciar instancia si hubo error de conexión
    ttsInstance = null;
    return null;
  }
}

module.exports = {
  generateSpeechAudio
};
