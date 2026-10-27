// safetyFilter.js - Filtro Estricto de Políticas de Comunidad y TikTok LIVE
// Basado en las Normas Oficiales de TikTok sobre Seguridad de Menores, Acoso y Contenido Explícito

function normalizeForSafety(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u');
}

// 1. Patrones de Menores de Edad (Tolerancia Cero TikTok)
const MINOR_SAFETY_PATTERNS = [
  /\b(pedofili[ae]|pedofil[oa]s?|pederast[ae]s?|grooming)\b/i,
  /\bmenor(es)?\s+(de\s+)?edad\b/i,
  /\b(alumn[oa]s?|estudiante)\s+(de\s+)?(primaria|secundaria|colegio|escuela|kinder)\b/i,
  /\bcolegial[ae]s?\b/i,
  /\b(niñ[oa]s?|infante|chavit[oa]s?|bebit[oa]s?|criatur(a|as))\b.*?\b(sex[oa]|desnud[oa]|bes[oa]|acost[ao]|toc[ao]|atraccion|cuerpo|dormir|cama|intimidad)\b/i,
  /\b(sex[oa]|desnud[oa]|bes[oa]|acost[ao]|toc[ao]|atraccion|dormir|cama|intimidad)\b.*?\b(niñ[oa]s?|infante|chavit[oa]s?|bebit[oa]s?|criatur(a|as))\b/i,
  // Detección de edades de menores (10 a 17 años) en contextos sexuales o de pareja
  /\b(yo\s+tenia|ella\s+tenia|el\s+tenia|teniendo|de\s+tan\s+solo|apenas\s+tenia)\s+(1[0-7]|[7-9])\s*a[ñn]os\b/i,
  /\b(1[0-7]|[7-9])\s*a[ñn]os\b.*?\b(novi[oa]|pareja|sex[oa]|cama|bes[oa]|acost(e|o|amos)|intimidad)\b/i,
  /\b(novi[oa]|pareja|sex[oa]|cama|bes[oa]|acost(e|o|amos)|intimidad)\b.*?\b(1[0-7]|[7-9])\s*a[ñn]os\b/i
];

// 2. Patrones de Violencia Sexual, Acoso y Falta de Consentimiento (Tolerancia Cero TikTok)
const SEXUAL_ASSAULT_PATTERNS = [
  /\b(viol(ar|o|aron|acion|ador[ae]s?)|abus(o|aron|ador[ae]s?)\s+sexual)\b/i,
  /\b(forz(ar|o|aron|e)|force|oblig(ar|o|aron|ue)|me\s+obligo|la\s+obligue|lo\s+obligue)\s+(a\s+tener\s+sexo|a\s+acostarse|a\s+hacerlo|a\s+estar\s+conmigo|a\s+tocarl[ao]|intimament[e])\b/i,
  /\bsin\s+(su|mi)\s+consentimiento\b/i,
  /\b(tocamiento(s)?\s+indebido(s)?|manose(ar|o)\s+sin\s+permiso)\b/i,
  // Sumisión química y dopaje
  /\b(le\s+ech[e]|me\s+ech(o|aron)|le\s+puse|me\s+puso|le\s+meti)\s+algo\s+(al\s+|en\s+el\s+|a\s+su\s+|en\s+su\s+)?(trago|bebida|vaso|copa|cerveza)\b/i,
  /\b(burundanga|dop(ar|o|aron|e)|sed(ar|o|aron)\s+para|aprovech(ar|e|o)\s+que\s+estaba\s+inconsciente)\b/i,
  // Sextorsión y pornovenganza
  /\b(sextorsion|pornovenganza|venganza\s+porno)\b/i,
  /\b(amenaz(ar|o|e|aron)|amenac(e|aron))\s+con\s+(publicar|subir|difundir|pasar|compartir|enviar)\s+(sus|mis)\s+fotos\s+(desnud[oa]s?|intimas)\b/i,
  /\b(difund(io|ir)|filtr(ar|o|e|aron))\s+fotos\s+intimas\s+sin\s+(su|mi)\s+(permiso|consentimiento)\b/i
];

// 3. Patrones de Suicidio y Autolesión (Tolerancia Cero TikTok)
const SELF_HARM_PATTERNS = [
  /\b(suicid(io|arme|arse|o|aron)|quitarme\s+la\s+vida|terminar\s+con\s+mi\s+vida)\b/i,
  /\b(cortarme\s+las\s+venas|ahorcarme|tirarme\s+de\s+un\s+puente|desear\s+estar\s+muert[oa])\b/i
];

// 4. Patrones de Violencia Extrema y Armas (Tolerancia Cero TikTok)
const VIOLENCE_PATTERNS = [
  /\b(asesin(ar|o|aron|ato)|matar\s+a\s+(mi|su|un)|mand(ar|o|e)\s+a\s+matar)\b/i,
  /\b(sicari[oa]s?|apuñal(ar|o|aron)|balear(on)?|dispar(ar|o)\s+en\s+la\s+cabeza)\b/i
];

// 5. Patrones de Drogas Duras / Narcotráfico
const DRUGS_PATTERNS = [
  /\b(cocaina|metanfetamina|tusi|perico|vender\s+droga|narcotrafico)\b/i
];

// 6. Patrones de Lenguaje Genital Crudo y Pornografía Explícita (Prohibido en LIVE por ASR y OCR)
const EXPLICIT_PORN_PATTERNS = [
  /\b(pene|vagina|verga|polla|chocho|concha|tetas|semen|eyacul(ar|o|acion)|leche\s+en\s+la\s+cara)\b/i,
  /\b(chuparmela|chuparsela|mamada|culear|follar\s+duramente|metersela\s+toda)\b/i
];

/**
 * Evalúa si una historia es 100% segura para emitirse en TikTok LIVE
 * @param {string} text - Contenido del secreto
 * @param {string} title - Título del secreto
 * @returns {{ safe: boolean, reason?: string, category?: string }}
 */
function evaluateTikTokPolicy(text, title = '') {
  if (!text || typeof text !== 'string') {
    return { safe: false, reason: 'Texto vacío o inválido' };
  }

  const rawCombined = `${title} ${text}`;
  const fullContent = normalizeForSafety(rawCombined);

  // 1. Verificación de Menores (CSAE / Grooming / Involucramiento de menores)
  for (const pattern of MINOR_SAFETY_PATTERNS) {
    if (pattern.test(fullContent)) {
      return {
        safe: false,
        category: 'MINOR_SAFETY',
        reason: 'Infracción de Seguridad de Menores (Protección a la infancia)'
      };
    }
  }

  // 2. Verificación de Acoso Sexual, Abuso y Consentimiento
  for (const pattern of SEXUAL_ASSAULT_PATTERNS) {
    if (pattern.test(fullContent)) {
      return {
        safe: false,
        category: 'SEXUAL_ASSAULT',
        reason: 'Infracción de Acoso, Abuso o Falta de Consentimiento'
      };
    }
  }

  // 3. Verificación de Suicidio / Autolesiones
  for (const pattern of SELF_HARM_PATTERNS) {
    if (pattern.test(fullContent)) {
      return {
        safe: false,
        category: 'SELF_HARM',
        reason: 'Infracción de Suicidio o Autolesión'
      };
    }
  }

  // 4. Verificación de Violencia Crítica
  for (const pattern of VIOLENCE_PATTERNS) {
    if (pattern.test(fullContent)) {
      return {
        safe: false,
        category: 'VIOLENCE',
        reason: 'Infracción de Violencia Extrema o Amenazas'
      };
    }
  }

  // 5. Verificación de Drogas Ilícitas
  for (const pattern of DRUGS_PATTERNS) {
    if (pattern.test(fullContent)) {
      return {
        safe: false,
        category: 'ILLICIT_DRUGS',
        reason: 'Infracción de Sustancias Ilícitas'
      };
    }
  }

  // 6. Verificación de Pornografía / Términos Genitales Explícitos
  for (const pattern of EXPLICIT_PORN_PATTERNS) {
    if (pattern.test(fullContent)) {
      return {
        safe: false,
        category: 'EXPLICIT_SEXUAL',
        reason: 'Contenido Sexualmente Explícito Crudo (Pornografía/Genitales)'
      };
    }
  }

  return { safe: true };
}

/**
 * Filtro ligero para sanear comentarios en vivo del chat antes de mostrarlos en pantalla
 * @param {string} commentText 
 * @returns {string|null} - Devuelve el texto filtrado o null si debe ocultarse
 */
function sanitizeLiveComment(commentText) {
  if (!commentText || typeof commentText !== 'string') return null;

  const normalized = normalizeForSafety(commentText);

  // Si contiene pedofilia, suicidio, amenazas directas o groserías extremas, no mostrar en pantalla
  const blockedCommentPatterns = [
    /\b(pedofil[oa]|violad[oa]r|suicid(io|arme)|matar|muerete)\b/i,
    /\b(cp|csam|menor\s+desnud[oa])\b/i,
    /\b(verga|hijueputa|malparid[oa]|gonorrea|perra|zorra)\b/i
  ];

  for (const p of blockedCommentPatterns) {
    if (p.test(normalized)) {
      return null; // Ocultar totalmente del muro
    }
  }

  return commentText.trim();
}

module.exports = {
  evaluateTikTokPolicy,
  sanitizeLiveComment
};
