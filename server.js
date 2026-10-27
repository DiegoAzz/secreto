// server.js - Servidor de Podcast de Historias & Secretos Anónimos (Modo Podcast 100%)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { TikTokLiveConnection, SignConfig } = require('tiktok-live-connector');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const tusecreto = require('./tusecreto');
const podcastNarrator = require('./podcastNarrator');
const tts = require('./tts');
const { evaluateTikTokPolicy, sanitizeLiveComment } = require('./safetyFilter');

if (process.env.EULER_API_KEY) {
  SignConfig.apiKey = process.env.EULER_API_KEY;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/next', async (req, res) => {
  await nextPodcastStory();
  res.json({ ok: true, current: podcastState.currentStory?.title });
});

app.get('/api/state', (req, res) => {
  res.json(getPublicPodcastState());
});

// ==========================================
// ESTADO EXCLUSIVO DE PODCAST (SIN MECÁNICAS DE JUEGO)
// ==========================================
let podcastState = {
  currentStory: null,
  recentComments: [],     // Comentarios reales y consejos de los oyentes
  userSecretsQueue: [],   // Secretos que los espectadores mandan con !secreto
  tiktokConnected: false,
  tiktokUser: process.env.TIKTOK_USER || 'senseidelamor'
};

let giftState = {
  roseCount: 0,
  roseGoal: 50
};
const vipDonors = new Set();

let tiktokLive = null;
let podcastTimer = null;
let preloadedNextStory = null;

// Pre-cargar en background la siguiente historia
function getRecentCommenters() {
  return podcastState.recentComments.slice(-5).map(c => c.user).filter(Boolean);
}

async function preloadNextStory() {
  if (preloadedNextStory) return;
  try {
    let attempts = 0;
    while (!preloadedNextStory && attempts < 5) {
      attempts++;
      let secret = null;
      if (podcastState.userSecretsQueue.length > 0) {
        secret = podcastState.userSecretsQueue.shift();
        console.log(`[Podcast] Cargando confesión de oyente: @${secret.author || 'Anónimo'}`);
      } else {
        secret = await tusecreto.getNextSecret();
      }
      if (secret) {
        preloadedNextStory = await podcastNarrator.createPodcastStory(secret, getRecentCommenters());
      }
    }
    if (preloadedNextStory) {
      console.log(`[Podcast] Siguiente historia lista con audio: "${preloadedNextStory.title}"`);
    }
  } catch (e) {
    console.error('[Podcast] Error al pre-cargar:', e.message);
  }
}

// Pasar a la siguiente historia de podcast
async function nextPodcastStory() {
  let story = null;
  if (preloadedNextStory) {
    story = preloadedNextStory;
    preloadedNextStory = null;
  } else {
    let attempts = 0;
    while (!story && attempts < 5) {
      attempts++;
      let secret = null;
      if (podcastState.userSecretsQueue.length > 0) {
        secret = podcastState.userSecretsQueue.shift();
      } else {
        secret = await tusecreto.getNextSecret();
      }
      if (secret) {
        story = await podcastNarrator.createPodcastStory(secret, getRecentCommenters());
      }
    }
  }

  if (!story) {
    console.warn('[Podcast] No se pudo obtener una historia segura en este intento. Reintentando en 4s...');
    setTimeout(nextPodcastStory, 4000);
    return;
  }

  podcastState.currentStory = story;
  console.log(`[Podcast] 📖 Reproduciendo Historia #${story.orderNumber || 1} de ${story.totalStories || '?'}: "${story.title}"`);

  // Emitir la nueva historia a la pantalla del podcast
  io.emit('new_podcast_story', story);
  io.emit('podcast_sync', getPublicPodcastState());

  // Programar la siguiente historia en 60 segundos (tiempo para locutar y comentar relajadamente)
  if (podcastTimer) clearTimeout(podcastTimer);
  podcastTimer = setTimeout(nextPodcastStory, 60000);

  // Pre-cargar la próxima historia
  setTimeout(preloadNextStory, 2500);
}

function getPublicPodcastState() {
  return {
    currentStory: podcastState.currentStory,
    recentComments: podcastState.recentComments.slice(-6),
    tiktokConnected: podcastState.tiktokConnected,
    tiktokUser: podcastState.tiktokUser,
    queuedSecretsCount: podcastState.userSecretsQueue.length,
    giftState: giftState
  };
}

// ==========================================
// CHAT DE TIKTOK LIVE (FILTRANDO CARTAS/LETRAS DE TRIVIA)
// ==========================================
function handleChatComment(userData, commentText) {
  if (!commentText) return;
  const clean = commentText.trim();

  // 1. Si el oyente envía un secreto para el podcast con !secreto
  if (clean.toLowerCase().startsWith('!secreto') || clean.toLowerCase().startsWith('#secreto')) {
    const secretContent = clean.replace(/^(!secreto|#secreto)\s*/i, '').trim();
    if (secretContent.length >= 15) {
      // Filtrar contenido contra políticas de TikTok (menores, acoso, explícito)
      const policyCheck = evaluateTikTokPolicy(secretContent);
      if (!policyCheck.safe) {
        console.warn(`[TikTok Safety] 🛡️ Secreto de oyente @${userData.nickname} rechazado: ${policyCheck.reason}`);
        return;
      }

      const isVip = vipDonors.has(userData.uniqueId);
      const secretItem = {
        id: 'user_' + Date.now(),
        title: `Confesión de @${userData.nickname} ${isVip ? '⭐ VIP' : ''}`,
        category: isVip ? '👑 SECRETO VIP (Prioridad)' : '🤫 Secreto de un Oyente en Vivo',
        text: secretContent,
        author: userData.nickname,
        isVip: isVip
      };

      if (isVip) {
        // Entra con prioridad 1
        podcastState.userSecretsQueue.unshift(secretItem);
      } else {
        podcastState.userSecretsQueue.push(secretItem);
      }

      console.log(`[TikTok Secreto] ¡Nuevo secreto recibido de @${userData.nickname}! (VIP: ${isVip})`);
      io.emit('user_secret_alert', {
        user: userData.nickname,
        isVip: isVip,
        message: isVip ? '👑 ¡Secreto VIP recibido! Pasó al 1er lugar para leerse' : '¡Tu secreto fue recibido y será locutado en la maratón!'
      });
      return;
    }
  }

  // 2. FILTRAR LETRAS SUELTAS DE TRIVIA (a, b, c, d, 1, 2)
  if (/^[a-d1-4]$/i.test(clean) || clean.length < 3) {
    return;
  }

  // 3. Comentario real de oyente para el muro de reflexiones (con filtro de groserías/ofensas)
  const safeText = sanitizeLiveComment(clean);
  if (!safeText) {
    console.log(`[TikTok Safety] 🛡️ Comentario filtrado y ocultado de pantalla: "${clean}"`);
    return;
  }

  const commentObj = {
    id: Date.now() + Math.random().toString(),
    user: userData.nickname,
    uniqueId: userData.uniqueId,
    avatar: userData.profilePictureUrl,
    text: safeText,
    timestamp: Date.now()
  };

  podcastState.recentComments.push(commentObj);
  if (podcastState.recentComments.length > 20) {
    podcastState.recentComments.shift();
  }

  io.emit('new_community_comment', commentObj);
}

function handleGift(userData, giftData) {
  const giftName = giftData.giftName || 'Regalo';
  const diamonds = giftData.diamondCount || 1;

  console.log(`[TikTok Regalo] @${userData.nickname} envió ${giftName} (${diamonds} diamantes)`);

  giftState.roseCount += Math.max(1, diamonds || 1);
  vipDonors.add(userData.uniqueId);

  io.emit('gift_alert', {
    user: userData.nickname,
    avatar: userData.profilePictureUrl,
    giftName: giftName,
    diamonds: diamonds
  });

  io.emit('gift_goal_update', giftState);
}

// ==========================================
// CONEXIÓN A TIKTOK LIVE
// ==========================================
async function connectTikTok(username) {
  if (!username) return;
  const cleanUser = username.replace(/^@/, '').trim();
  podcastState.tiktokUser = cleanUser;

  if (tiktokLive) {
    try { tiktokLive.disconnect(); } catch (e) {}
    tiktokLive = null;
  }

  console.log(`[TikTok] Conectando a @${cleanUser}...`);

  try {
    tiktokLive = new TikTokLiveConnection(cleanUser, {
      processInitialData: false,
      enableExtendedGiftInfo: false,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 2000,
      clientParams: {
        app_language: 'es-ES',
        device_platform: 'web'
      }
    });

    const state = await tiktokLive.connect();
    podcastState.tiktokConnected = true;
    console.log(`[TikTok] ✅ Conectado exitosamente al Live de @${cleanUser} (RoomId: ${state.roomId})`);
    io.emit('tiktok_status', { connected: true, user: cleanUser, roomId: state.roomId });

    tiktokLive.on('chat', data => {
      const commentText = data.content || data.comment;
      if (!commentText) return;

      const userData = {
        uniqueId: data.user?.uniqueId || 'anon',
        nickname: data.user?.nickname || data.user?.uniqueId || 'Oyente',
        profilePictureUrl: data.user?.avatarThumb?.urlList?.[0] || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.user?.uniqueId || 'anon'}`
      };

      handleChatComment(userData, commentText);
    });

    tiktokLive.on('gift', data => {
      const userData = {
        uniqueId: data.user?.uniqueId || 'donor_' + Date.now(),
        nickname: data.user?.nickname || 'Donador VIP',
        profilePictureUrl: data.user?.avatarThumb?.urlList?.[0] || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.user?.uniqueId || 'donor'}`
      };
      handleGift(userData, data);
    });

    tiktokLive.on('streamEnd', () => {
      console.log('[TikTok] 🏁 El directo ha finalizado.');
      podcastState.tiktokConnected = false;
      io.emit('tiktok_status', { connected: false, message: 'Live finalizado' });
    });

    tiktokLive.on('disconnected', () => {
      podcastState.tiktokConnected = false;
      io.emit('tiktok_status', { connected: false, user: cleanUser, message: 'Desconectado' });
    });

  } catch (err) {
    podcastState.tiktokConnected = false;
    console.error(`[TikTok] Error al conectar a @${cleanUser}:`, err.message);
    io.emit('tiktok_status', { connected: false, user: cleanUser, error: err.message });

    setTimeout(() => {
      if (!podcastState.tiktokConnected) {
        connectTikTok(cleanUser);
      }
    }, 8000);
  }
}

// ==========================================
// SOCKET.IO EVENTOS
// ==========================================
io.on('connection', socket => {
  socket.emit('podcast_sync', getPublicPodcastState());

  socket.on('admin:next_story', () => {
    console.log('[Admin] Pasando a la siguiente historia...');
    nextPodcastStory();
  });

  socket.on('admin:send_custom_story', async data => {
    if (!data || !data.text) return;

    // Validación estricta contra Políticas de TikTok
    const policyResult = evaluateTikTokPolicy(data.text, data.title || '');
    if (!policyResult.safe) {
      console.warn(`[TikTok Safety] 🚫 Rechazada historia propia de admin: ${policyResult.reason}`);
      socket.emit('admin:story_rejected', {
        title: data.title,
        reason: policyResult.reason
      });
      return;
    }

    const customSecret = {
      id: 'custom_' + Date.now(),
      realSecretId: '⭐',
      title: data.title || 'Confesión Exclusiva',
      category: data.category || '🌟 Confesión Exclusiva',
      text: data.text,
      isCustom: true
    };

    console.log(`[Admin] ✍️ Historia propia recibida: "${customSecret.title}" (Inmediata: ${data.immediate})`);

    if (data.immediate) {
      const story = await podcastNarrator.createPodcastStory(customSecret, getRecentCommenters());
      if (!story) {
        socket.emit('admin:story_rejected', {
          title: data.title,
          reason: 'No superó los filtros de moderación para TikTok LIVE'
        });
        return;
      }
      podcastState.currentStory = story;
      io.emit('new_podcast_story', story);
      io.emit('podcast_sync', getPublicPodcastState());
      if (podcastTimer) clearTimeout(podcastTimer);
      podcastTimer = setTimeout(nextPodcastStory, 60000);
    } else {
      podcastState.userSecretsQueue.unshift(customSecret);
      socket.emit('admin:story_queued', { title: customSecret.title });
    }
  });

  socket.on('admin:connect_tiktok', data => connectTikTok(data.username));

  socket.on('admin:sim_comment', data => {
    handleChatComment({
      uniqueId: data.username || 'oyente_demo',
      nickname: data.nickname || data.username || 'Oyente Nocturno',
      profilePictureUrl: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username || 'demo'}`
    }, data.comment);
  });

  socket.on('admin:sim_gift', data => {
    handleGift({
      uniqueId: data.username || 'vip_user',
      nickname: data.nickname || 'Oyente Fiel 🌹',
      profilePictureUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username || 'vip'}`
    }, {
      giftName: data.giftName || 'Rosa 🌹',
      diamondCount: data.diamonds || 1
    });
  });
});

// Iniciar base de historias y arrancar transmisión
tusecreto.updateSecretsDatabase().then(async () => {
  console.log('[Servidor] Banco de historias listo. Iniciando Podcast nocturno...');
  await nextPodcastStory();
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎙️  EL CONFESIONARIO - PODCAST EXCLUSIVO NOCTURNO`);
  console.log(`📺 Pantalla OBS / Stream:   http://localhost:${PORT}`);
  console.log(`🎛️  Panel de Control / Sim: http://localhost:${PORT}/admin.html`);
  console.log(`=======================================================`);

  const autoUser = process.env.TIKTOK_USER || 'senseidelamor';
  setTimeout(() => {
    connectTikTok(autoUser);
  }, 2500);
});
