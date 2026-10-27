// tusecreto.js - Extractor con persistencia en disco y soporte de fallback
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'secrets_chronological_cache.json');
const PROGRESS_FILE = path.join(__dirname, 'marathon_progress.json');

// Cargar progreso persistente de la maratón
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      if (typeof data.currentIndex === 'number' && data.currentIndex >= 0) {
        console.log(`[Persistencia] 💾 Retomando Maratón desde Secreto #${data.currentIndex + 1}`);
        return data.currentIndex;
      }
    }
  } catch (e) {}
  return 0;
}

function saveProgress(idx) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
      currentIndex: idx,
      savedAt: new Date().toISOString()
    }, null, 2), 'utf-8');
  } catch (e) {}
}

let storiesList = [];
let currentIndex = loadProgress();

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

async function fetchFullStoryText(linkUrl) {
  if (!linkUrl) return null;
  try {
    const html = await fetchPage(linkUrl);
    if (!html) return null;
    const match = html.match(/<div class="[^"]*text-slate-800[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                  html.match(/<div class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (match) {
      return match[1].replace(/<[^>]+>/g, '').trim();
    }
  } catch (e) {}
  return null;
}

function parseArticles(html) {
  const items = [];
  const articles = [...html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)];

  for (const art of articles) {
    const content = art[1];
    const idM = content.match(/data-secret-id="(\d+)"/i) || content.match(/href="[^"]*-(\d+)\//i);
    const titleM = content.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const textM = content.match(/<div class="[^"]*break-words[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                  content.match(/<div class="[^"]*text-gray-800[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    if (textM && idM) {
      const id = parseInt(idM[1], 10);
      let title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : '';
      if (!title || title.length < 2 || title.toLowerCase() === '...' || title.toLowerCase().includes('comparte tu historia')) {
        title = `Secreto #${id}`;
      }

      let text = textM[1]
        .replace(/<span class="text-blue-500[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();

      const linkM = content.match(/href="(https:\/\/www\.tusecreto\.me\/[^"]+-\d+\/)"/i);

      if (text.length >= 35) {
        items.push({
          id,
          title,
          text,
          link: linkM ? linkM[1] : null,
          category: `📜 Secreto Histórico #${id}`
        });
      }
    }
  }
  return items;
}

async function scrapeTusConfesionesFallback() {
  console.log('[Fallback] Consultando tusconfesiones.com...');
  try {
    const html = await fetchPage('https://www.tusconfesiones.com/');
    if (!html) return [];
    const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length >= 50 && !t.includes('Comparte tu'));
    
    return paragraphs.map((text, i) => ({
      id: 50000 + i,
      title: 'Confesión de la Comunidad',
      text: text,
      category: '🔥 Secreto Inconfesable'
    }));
  } catch (e) {
    return [];
  }
}

async function updateSecretsDatabase() {
  console.log('[TuSecreto] Cargando base de la Maratón...');

  if (fs.existsSync(CACHE_FILE)) {
    try {
      storiesList = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {}
  }

  if (storiesList.length === 0) {
    const pages = [65, 64, 63, 62, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50];
    const allMap = new Map();

    for (const p of pages) {
      const html = await fetchPage(`https://www.tusecreto.me/?page=${p}`);
      if (!html) continue;
      const items = parseArticles(html);
      for (const item of items) {
        if (!allMap.has(item.id)) {
          allMap.set(item.id, item);
        }
      }
    }

    const sorted = Array.from(allMap.values()).sort((a, b) => a.id - b.id);
    if (sorted.length > 0) {
      storiesList = sorted;
      fs.writeFileSync(CACHE_FILE, JSON.stringify(storiesList, null, 2), 'utf-8');
    }
  }

  if (storiesList.length === 0) {
    const backup = await scrapeTusConfesionesFallback();
    if (backup.length > 0) storiesList = backup;
  }

  console.log(`[TuSecreto] 🔥 ¡Base activa con ${storiesList.length} historias (En curso: #${currentIndex + 1})!`);
}

async function getNextSecret() {
  if (storiesList.length === 0) {
    await updateSecretsDatabase();
  }

  if (storiesList.length === 0) return null;

  if (currentIndex >= storiesList.length) {
    console.log(`[TuSecreto] 🏁 Se leyeron todas las ${storiesList.length} historias. Reiniciando ciclo desde la #1...`);
    currentIndex = 0;
  }

  const chosen = storiesList[currentIndex];
  const orderNumber = currentIndex + 1;
  const totalCount = 19934;

  // Avanzar índice y guardar persistencia en disco de inmediato
  currentIndex++;
  saveProgress(currentIndex);

  let fullText = chosen.text;
  if (chosen.link && (!chosen.fullText || chosen.fullText.length < chosen.text.length)) {
    const fetched = await fetchFullStoryText(chosen.link);
    if (fetched && fetched.length >= chosen.text.length) {
      fullText = fetched;
      chosen.fullText = fetched;
      chosen.text = fetched;
    }
  }

  return {
    id: chosen.id,
    orderNumber: orderNumber,
    realSecretId: chosen.id,
    totalStories: totalCount,
    title: chosen.title || `Secreto Histórico #${chosen.id}`,
    category: `🔥 MARATÓN: SECRETO #${chosen.id}`,
    text: fullText || chosen.text,
    link: chosen.link
  };
}

module.exports = {
  updateSecretsDatabase,
  getNextSecret,
  getCurrentIndex: () => currentIndex,
  resetProgress: () => {
    currentIndex = 0;
    saveProgress(0);
  }
};
