// podcastNarrator.js - Adaptador de historias a guion de Podcast sensual con Gemini y TTS
const { generateSpeechAudio } = require('./tts');
const { evaluateTikTokPolicy } = require('./safetyFilter');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Obtener la hora exacta de Colombia / Latinoamérica (independiente de si el servidor corre en UTC)
function getLocalHour() {
  try {
    const tz = process.env.TIMEZONE || 'America/Bogota';
    const formatter = new Intl.DateTimeFormat('es-CO', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch (e) {
    return new Date().getHours();
  }
}

// Calcula el saludo adecuado según la hora real del día
function getGreetingInfo() {
  const hour = getLocalHour();
  if (hour >= 5 && hour < 12) {
    return {
      saludo: 'Buenos días',
      momento: 'esta mañana',
      regla: 'El programa se emite POR LA MAÑANA (hora local: entre 5 AM y 12 PM). Tu saludo OBLIGATORIO es "Buenos días" o "en esta mañana". ESTÁ ESTRICTAMENTE PROHIBIDO decir "Buenas noches", "esta noche" o "nocturno".'
    };
  } else if (hour >= 12 && hour < 19) {
    return {
      saludo: 'Buenas tardes',
      momento: 'esta tarde',
      regla: 'El programa se emite POR LA TARDE (hora local: entre 12 PM y 7 PM). Tu saludo OBLIGATORIO es "Buenas tardes" o "en esta tarde". ESTÁ ESTRICTAMENTE PROHIBIDO decir "Buenas noches", "esta noche" o "nocturno".'
    };
  } else {
    return {
      saludo: 'Buenas noches',
      momento: 'esta noche',
      regla: 'El programa se emite DE NOCHE (hora local: a partir de las 7 PM). Saluda con "Buenas noches" o "en esta noche".'
    };
  }
}

// Transforma una confesión anónima en un guion de podcast sensual, adictivo y magnético
async function createPodcastStory(rawSecret, recentCommenters = []) {
  if (!rawSecret) return null;
  const storyText = rawSecret.text || rawSecret.previewText;
  const secretId = rawSecret.realSecretId || rawSecret.id || 1;
  const storyTitle = rawSecret.title && !rawSecret.title.startsWith('Secreto #') ? rawSecret.title : `Confesión #${secretId}`;
  const category = rawSecret.category || `🔥 SECRETO HISTÓRICO #${secretId}`;
  const timeInfo = getGreetingInfo();

  // Verificación estricta de Políticas de TikTok antes de procesar
  const preCheck = evaluateTikTokPolicy(storyText, storyTitle);
  if (!preCheck.safe) {
    console.warn(`[PodcastNarrator] 🛡️ Secreto #${secretId} descartado por Políticas de TikTok: ${preCheck.reason}`);
    return null;
  }

  let scriptNarration = '';
  let cleanDisplayText = storyText;
  let debateQuestion = '¿Qué hubieras hecho tú en su lugar? Los leo en el chat 👇';

  const listenersMention = (recentCommenters && recentCommenters.length > 0)
    ? `OYENTES COMENTANDO EN VIVO AHORA: ${recentCommenters.slice(0, 3).map(u => '@' + u).join(', ')}. Haz un saludo o guiño sutil a uno de ellos ("un abrazo a @${recentCommenters[0]} que está aquí en vivo...") para demostrar interacción 100% en tiempo real.`
    : '';

  if (GEMINI_API_KEY) {
    const prompt = `
Eres la narradora y psicóloga de "El Confesionario", un podcast de confesiones íntimas, sensual y profundamente adictivo en TikTok Live.
Estamos en la GRAN MARATÓN: Leyendo los secretos de TuSecreto.me desde el SECRETO NÚMERO 1 hasta el presente.

ESTE ES EL SECRETO NÚMERO: #${secretId}
HORA ACTUAL Y SALUDO OBLIGATORIO: ${timeInfo.regla}
${listenersMention}

NORMAS DE SEGURIDAD ESTRICTAS DE TIKTOK LIVE (CUMPLIMIENTO OBLIGATORIO):
1. CERO TOLERANCIA a historias que involucren menores de 18 años, pedofilia, colegios/alumnos menores o grooming. Si detectas esto, responde ÚNICAMENTE: {"isSafe": false}
2. CERO TOLERANCIA a violencia sexual, abuso, violación, tocamientos forzados, sumisión química (drogar bebidas) o chantaje íntimo (sextorsión). Si detectas esto, responde ÚNICAMENTE: {"isSafe": false}
3. CERO TOLERANCIA a suicidio o autolesiones. Si detectas esto, responde ÚNICAMENTE: {"isSafe": false}
4. CONTENIDO ORIGINAL E INTERACTIVO: Este programa es un podcast transmitido EN VIVO. Demuestra interacción genuina con la audiencia.
5. ADAPTACIÓN PARA TRANSMISIÓN: Abordamos el amor, la traición, el desamor, los celos o la pasión íntima con lenguaje seductor, elegante, sugerente y maduro. ESTÁ PROHIBIDO usar palabras anatómicas explícitas de genitales o pornografía cruda para no activar los filtros automáticos de audio y OCR de TikTok.

Tu objetivo es hacer que los espectadores de TikTok Live se queden hipnotizados escuchando.
Escribe:
1. "narration": Un guion para ser leído con tu voz sensual, pausada, intrigante y seductora.
   - Comienza mencionando el número del secreto y el saludo adecuado al horario ("${timeInfo.saludo}, bienvenidos a la gran maratón... Secreto número ${secretId}...").
   - Cuenta la confesión en primera persona con emoción palpable, suspenso y ritmo envolvente. Corrige cualquier falta ortográfica o abreviatura para que la dicción sea perfecta.
   - Termina con una pregunta psicológica irresistible que obligue al chat a comentar de inmediato.
2. "cleanText": El texto de la confesión bien redactado y cautivador para la pantalla del celular (máximo 250 caracteres, sin palabras vulgares).
3. "debateQuestion": Una pregunta provocadora y directa para el chat (máximo 85 caracteres).

CONFESIÓN ORIGINAL #${secretId}:
"${storyText}"

Responde ÚNICAMENTE con un JSON válido sin formato markdown ni código:
{
  "isSafe": true,
  "narration": "Guion completo listo para locutar en voz alta (entre 45 y 75 palabras)",
  "cleanText": "Texto limpio y emocionante para la pantalla",
  "debateQuestion": "Pregunta de debate psicológico para el chat"
}
`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 600
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          let clean = candidate.trim();
          if (clean.startsWith('```')) {
            clean = clean.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '').trim();
          }
          const parsed = JSON.parse(clean);
          if (parsed.isSafe === false) {
            console.warn(`[PodcastNarrator] 🛡️ Gemini determinó que la historia #${secretId} infringe políticas de TikTok.`);
            return null;
          }
          if (parsed.narration) scriptNarration = parsed.narration;
          if (parsed.cleanText) cleanDisplayText = parsed.cleanText;
          if (parsed.debateQuestion) debateQuestion = parsed.debateQuestion;
        }
      }
    } catch (e) {
      console.error('[PodcastNarrator] Error con Gemini:', e.message);
    }
  }

  // Fallback si no responde la API
  if (!scriptNarration) {
    scriptNarration = `${timeInfo.saludo}... Continuamos con la gran maratón. Secreto número ${secretId}. "${storyText}". Y ahora les pregunto a ustedes en el chat... ¿Qué opinan? ¿Qué hubieran hecho en su lugar? Los leo en directo.`;
  }

  // Sanitización estricta por código (Garantía al 100% de que no diga "buenas noches" en la tarde)
  if (timeInfo.saludo === 'Buenas tardes') {
    scriptNarration = scriptNarration
      .replace(/buenas noches/gi, 'buenas tardes')
      .replace(/esta noche/gi, 'esta tarde')
      .replace(/criaturas de la noche/gi, 'oyentes del confesionario')
      .replace(/podcast nocturno/gi, 'podcast en directo');
  } else if (timeInfo.saludo === 'Buenos días') {
    scriptNarration = scriptNarration
      .replace(/buenas noches/gi, 'buenos días')
      .replace(/buenas tardes/gi, 'buenos días')
      .replace(/esta noche/gi, 'esta mañana')
      .replace(/esta tarde/gi, 'esta mañana')
      .replace(/criaturas de la noche/gi, 'oyentes del confesionario')
      .replace(/podcast nocturno/gi, 'podcast en directo');
  }

  // Verificación final del guion antes de mandarlo a Edge TTS
  const postCheck = evaluateTikTokPolicy(scriptNarration);
  if (!postCheck.safe) {
    console.warn(`[PodcastNarrator] 🛡️ Guion final descartado por contener términos no permitidos: ${postCheck.reason}`);
    return null;
  }

  console.log(`[Podcast] (${timeInfo.saludo}) Locutando Secreto #${secretId}: "${storyTitle}"...`);
  const audioUrl = await generateSpeechAudio(scriptNarration);

  return {
    id: rawSecret.id,
    orderNumber: rawSecret.orderNumber,
    realSecretId: secretId,
    totalStories: rawSecret.totalStories || 19934,
    title: storyTitle,
    category: category,
    storyText: cleanDisplayText,
    narration: scriptNarration,
    debateQuestion: debateQuestion,
    audioUrl: audioUrl
  };
}

module.exports = {
  createPodcastStory,
  getGreetingInfo,
  getLocalHour
};
