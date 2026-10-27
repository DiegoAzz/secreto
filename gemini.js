// gemini.js - Generador inteligente de dilemas variados con Google Gemini
const fs = require('fs');
const path = require('path');

let apiKey = process.env.GEMINI_API_KEY || '';
const recentQuestions = []; // Historial de preguntas recientes (máximo 40)
let lastTopicIndex = -1;

// 25 Ángulos y situaciones de pareja completamente distintas y picantes
const DIVERSE_SCENARIOS = [
  "La primera cita y la cuenta (¿Quién debe pagar?, hablar del ex en la primera cena, modales con el mesero)",
  "El amigo o compañera de trabajo (Almuerzos a solas, quedarse horas extra, chats que no te muestra)",
  "Dinero y gastos secretos (Ocultar compras costosas, prestar dinero a familiares sin avisar a la pareja)",
  "La suegra y la familia política (Intromisión en la relación, comparaciones odiosas con la mamá o papá)",
  "Contacto cero y el regreso del ex (Mensaje de 'soñé contigo' a la medianoche, felicitar en el cumpleaños, guardar regalos viejos)",
  "Lenguaje corporal y señales de atracción oculta (Mirar los labios, tocarse el cuello, pupilas dilatadas, risa nerviosa)",
  "Psicología de manipulación (El gaslighting 'estás loco/a', hacerse la víctima, aplicar la ley del hielo)",
  "Convivencia y manías en el hogar (Quién limpia el baño, desorden extremo, manías raras al dormir)",
  "Redes sociales y fotos (No querer subir fotos juntos, archivar historias, dar likes a perfiles sugerentes)",
  "Casi algo y amigos con derechos (Uno se enamoró en secreto, pedir exclusividad sin ser novios)",
  "Fiestas, salidas y amigos (Salir de noche y apagar el celular hasta la mañana siguiente, amigos que te caen mal)",
  "Presentaciones y vergüenza social (Llevar 8 meses saliendo y aún no te presenta a sus amigos ni familia)",
  "Mentiras piadosas vs traiciones (Decir que se quedó dormido cuando estaba de fiesta o jugando en línea)",
  "Fechas especiales y olvidos (Olvidar el aniversario o dar un regalo de segunda mano reciclado)",
  "Fantasías y pasión en la cama (Miedo a confesar gustos íntimos, rutina en la intimidad después de meses)",
  "Diferencia de madurez o de edad (Uno quiere salir de fiesta cada fin de semana y el otro prefiere quedarse en casa)",
  "Celos justificados vs inseguridades tóxicas (Revisar seguidores nuevos, molestarse porque alguien le sonría)",
  "Viajes y vacaciones en pareja (La gran prueba de fuego de convivir 7 días seguidos en un viaje)",
  "Discusiones y orgullo (Dormir enojados de espaldas, negarse a pedir perdón, sacar reclamos de hace 2 años)",
  "Planes de futuro opuestos (Uno quiere tener hijos o casarse pronto y el otro no cree en el matrimonio)",
  "El 'mejor amigo' del sexo opuesto (Dormir en la misma habitación 'como hermanos', confidencias íntimas)",
  "Cambios repentinos de actitud (De repente se arregla exageradamente para ir al supermercado o gimnasio)",
  "Ghosting y dejar en visto (Tardar 20 horas en responder un WhatsApp pero subir 8 historias a Instagram)",
  "Halagos y coqueteos descarados frente a ti (Decirle atractivo/a a un mesero o mesera en tu cara)",
  "Pruebas de amor absurdas (Pedir las contraseñas de todas las redes sociales para 'demostrar confianza')"
];

function setGeminiApiKey(key) {
  apiKey = (key || '').trim();
}

function getGeminiApiKey() {
  return apiKey;
}

// Seleccionar un escenario que garantice variedad extrema
function getNextDiverseTopic() {
  lastTopicIndex = (lastTopicIndex + 1) % DIVERSE_SCENARIOS.length;
  // Mezclar un poco si vuelve a empezar
  return DIVERSE_SCENARIOS[lastTopicIndex];
}

// Generar un nuevo dilema de pareja con Gemini
async function generateLoveQuestion() {
  if (!apiKey) {
    return null; // Si no hay API key, usa fallback
  }

  const chosenScenario = getNextDiverseTopic();
  const avoidList = recentQuestions.slice(-25).map((q, i) => `${i + 1}. "${q}"`).join('\n');

  const prompt = `
Eres "El Sensei del Amor", el psicólogo y experto en parejas más entretenido, picante y analítico de TikTok Live.
Tu audiencia son miles de espectadores que votan en el chat (A, B, C o D).

TEMA ESPECÍFICO OBLIGATORIO PARA ESTE DILEMA:
👉 ${chosenScenario}

REGLAS ESTRICTAS DE VARIEDAD Y NO REPETICIÓN:
1. PROHIBIDO terminantemente hablar de: "celular boca abajo", "borrar chats de WhatsApp", o temas clichés trillados.
2. PROHIBIDO repetir o parecerse a cualquiera de estas preguntas recientes:
${avoidList || '(Ninguna aún)'}
3. El dilema debe ser una situación REAL, picante, curiosa o psicológica que genere debate inmediato en el chat.
4. Las 4 opciones deben ser muy claras, directas y divertidas de elegir.

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido, sin bloques de código markdown, con esta estructura exacta:
{
  "category": "Nombre corto de la categoría (ej: 💔 Infidelidad, 🚩 Red Flag, 😏 Seducción, ⚖️ Dilema)",
  "question": "Pregunta o situación directa y llamativa (máximo 120 caracteres)",
  "options": [
    { "key": "A", "text": "Opción A (máximo 4 palabras)" },
    { "key": "B", "text": "Opción B (máximo 4 palabras)" },
    { "key": "C", "text": "Opción C (máximo 4 palabras)" },
    { "key": "D", "text": "Opción D (máximo 4 palabras)" }
  ],
  "correct": "A, B, C o D (la opción psicológicamente más acertada o divertida)",
  "aliases": ["a", "palabra_clave"],
  "hint": "Consejo psicológico o conclusión sabia de 1 sola frase corta"
}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.95, // Alta creatividad para nunca aburrir
          maxOutputTokens: 600
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Gemini API Error]', response.status, errText);
      return null;
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) return null;

    // Limpiar posibles bloques ```json ... ```
    let cleanJson = candidate.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '').trim();
    }

    const questionObj = JSON.parse(cleanJson);
    
    // Validar estructura mínima
    if (questionObj.question && Array.isArray(questionObj.options) && questionObj.correct) {
      questionObj.id = Date.now();
      
      // Guardar en historial para no repetir
      recentQuestions.push(questionObj.question);
      if (recentQuestions.length > 40) recentQuestions.shift();
      
      return questionObj;
    }
    return null;
  } catch (err) {
    console.error('[Gemini] Error al parsear o llamar a la API:', err.message);
    return null;
  }
}

module.exports = {
  setGeminiApiKey,
  getGeminiApiKey,
  generateLoveQuestion
};
