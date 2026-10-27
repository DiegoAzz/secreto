// tusecreto_scraper.js - Extractor de secretos anónimos reales
const fs = require('fs');

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) return '';
    return await res.text();
  } catch (e) {
    return '';
  }
}

function extractSecretsFromHtml(html, defaultCategory = '🤫 Secreto Anónimo') {
  const secrets = [];
  
  // Buscar bloques de secretos
  // <h3 class="..."><a href="...">Titulo</a></h3> o <h3 ...>Titulo</h3>
  // <div class="text-gray-800 text-base mb-4 break-words prose prose-slate leading-relaxed">Texto...</div>
  const regex = /<div class="py-6 px-5 flex flex-col flex-grow">([\s\S]*?)<\/div>\s*<\/div>/gi;
  let blockMatch;

  while ((blockMatch = regex.exec(html)) !== null) {
    const block = blockMatch[1];

    // Extraer título
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Confesión Anónima';

    // Extraer texto
    const textMatch = block.match(/<div class="[^"]*text-gray-800[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (!textMatch) continue;

    let text = textMatch[1]
      .replace(/<span class="text-blue-500[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '') // Quitar "Leer más"
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#039;/g, "'")
      .trim();

    // Extraer link si hay
    const linkMatch = block.match(/href="([^"]+)"/i);
    const link = linkMatch ? linkMatch[1] : null;

    // Extraer ID
    const idMatch = block.match(/data-secret-id="(\d+)"/i) || (link ? link.match(/-(\d+)\//) : null);
    const id = idMatch ? idMatch[1] : Date.now() + Math.random().toString();

    // Filtrar textos muy cortos (< 40 caracteres) o basura
    if (text.length >= 45) {
      secrets.push({
        id: id,
        title: title || 'Confesión de un oyente',
        text: text,
        category: defaultCategory,
        link: link
      });
    }
  }

  return secrets;
}

async function getAllSecrets() {
  const sources = [
    { url: 'https://www.tusecreto.me/amor/', cat: '💔 Amor & Pareja' },
    { url: 'https://www.tusecreto.me/?filter=trending', cat: '🔥 Secreto Trending' },
    { url: 'https://www.tusecreto.me/tag/desamor/', cat: '🌧️ Desamor' },
    { url: 'https://www.tusecreto.me/tag/amor-prohibido/', cat: '💋 Amor Prohibido' },
    { url: 'https://www.tusecreto.me/foro-libre/', cat: '🤫 Confesión Íntima' },
    { url: 'https://www.tusecreto.me/tag/confesion/', cat: '🎭 Secreto Inconfesable' }
  ];

  const all = [];
  const seenIds = new Set();

  for (const s of sources) {
    const html = await fetchPage(s.url);
    if (!html) continue;
    const list = extractSecretsFromHtml(html, s.cat);
    for (const item of list) {
      if (!seenIds.has(item.id) && !seenIds.has(item.text.slice(0, 30))) {
        seenIds.add(item.id);
        seenIds.add(item.text.slice(0, 30));
        all.push(item);
      }
    }
  }

  return all;
}

module.exports = {
  getAllSecrets,
  fetchPage
};

if (require.main === module) {
  getAllSecrets().then(list => {
    console.log(`¡Total de historias reales extraídas: ${list.length}!`);
    list.slice(0, 5).forEach((s, i) => {
      console.log(`\n--- [${i + 1}] (${s.category}) "${s.title}" ---`);
      console.log(s.text);
    });
  });
}
