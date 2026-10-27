// app.js - Cliente de Podcast "El Confesionario" para TikTok Live (100% Anti-Eco)
const socket = io();

// Elementos del DOM
const soundWavesEl = document.getElementById('soundWaves');
const storyCategoryEl = document.getElementById('storyCategory');
const storyCounterEl = document.getElementById('storyCounter');
const storyTitleEl = document.getElementById('storyTitle');
const storyTextEl = document.getElementById('storyText');
const debateQuestionEl = document.getElementById('debateQuestion');
const commentsFeedEl = document.getElementById('commentsFeed');
const secretAlertEl = document.getElementById('secretAlert');
const secretAlertTextEl = document.getElementById('secretAlertText');
const unmuteBtnEl = document.getElementById('unmuteBtn');
const soundToggleBtnEl = document.getElementById('soundToggleBtn');
const roseCountEl = document.getElementById('roseCount');
const roseGoalEl = document.getElementById('roseGoal');
const goalProgressBarEl = document.getElementById('goalProgressBar');

function updateGoalUI(goalData) {
  if (!goalData) return;
  const current = goalData.roseCount || 0;
  const goal = goalData.roseGoal || 50;
  if (roseCountEl) roseCountEl.textContent = current;
  if (roseGoalEl) roseGoalEl.textContent = goal;
  if (goalProgressBarEl) {
    const pct = Math.min(100, Math.round((current / goal) * 100));
    goalProgressBarEl.style.width = `${pct}%`;
  }
}

let currentAudio = null;
let audioUnlocked = false;
let isMutedLocally = false;
let lastPlayedAudioUrl = null;

// Si la URL tiene ?mute=1 o ?silent=1, silenciar esta pestaña automáticamente
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('mute') || urlParams.has('silent')) {
  isMutedLocally = true;
  updateSoundToggleUI();
}

// Canal entre pestañas para evitar que 2 pestañas abiertas reproduzcan a la vez (Anti-Eco)
const tabAudioChannel = window.BroadcastChannel ? new BroadcastChannel('confesionario_audio_sync') : null;
if (tabAudioChannel) {
  tabAudioChannel.onmessage = (e) => {
    if (e.data === 'another_tab_playing' && currentAudio) {
      console.warn('[Anti-Eco] Otra pestaña está reproduciendo audio. Silenciando esta pestaña para evitar eco.');
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
      currentAudio = null;
      soundWavesEl.classList.remove('active');
    }
  };
}

function updateSoundToggleUI() {
  if (!soundToggleBtnEl) return;
  if (isMutedLocally) {
    soundToggleBtnEl.innerHTML = '🔇 Silenciado';
    soundToggleBtnEl.classList.add('muted');
  } else {
    soundToggleBtnEl.innerHTML = '🔊 Sonido On';
    soundToggleBtnEl.classList.remove('muted');
  }
}

if (soundToggleBtnEl) {
  soundToggleBtnEl.addEventListener('click', () => {
    isMutedLocally = !isMutedLocally;
    if (isMutedLocally && currentAudio) {
      currentAudio.pause();
      soundWavesEl.classList.remove('active');
    } else if (!isMutedLocally && currentAudio) {
      currentAudio.play();
      soundWavesEl.classList.add('active');
    }
    updateSoundToggleUI();
  });
}

// ==========================================
// CONTROL DE AUDIO Y VOZ NEURONAL (CON PROTECCIÓN ANTI-ECO)
// ==========================================
function playPodcastVoice(audioUrl) {
  if (!audioUrl || isMutedLocally) return;

  // Evitar reproducir exactamente el mismo archivo dos veces en el mismo cliente
  if (lastPlayedAudioUrl === audioUrl && currentAudio && !currentAudio.paused) {
    console.log('[Anti-Eco] El audio ya se está reproduciendo actualmente.');
    return;
  }
  lastPlayedAudioUrl = audioUrl;

  try {
    // Si había un audio reproduciéndose, detenerlo radicalmente
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
      currentAudio = null;
    }

    // Avisar a cualquier otra pestaña abierta en esta PC que se silencie (elimina el eco entre pestañas)
    if (tabAudioChannel) {
      tabAudioChannel.postMessage('another_tab_playing');
    }

    currentAudio = new Audio(audioUrl);
    currentAudio.volume = 1.0;

    // Iniciar ondas de sonido reactivas
    soundWavesEl.classList.add('active');

    currentAudio.play().then(() => {
      audioUnlocked = true;
      if (unmuteBtnEl) unmuteBtnEl.classList.add('hidden');
    }).catch(err => {
      console.warn('[Autoplay de audio esperando interacción]:', err.message);
      if (unmuteBtnEl) unmuteBtnEl.classList.remove('hidden');
    });

    currentAudio.onended = () => {
      soundWavesEl.classList.remove('active');
    };

    currentAudio.onerror = () => {
      soundWavesEl.classList.remove('active');
    };
  } catch (e) {
    console.error('Error al reproducir voz de podcast:', e);
  }
}

// Activar audio con interacción del usuario
document.body.addEventListener('click', () => {
  if (!audioUnlocked && !isMutedLocally) {
    audioUnlocked = true;
    if (unmuteBtnEl) unmuteBtnEl.classList.add('hidden');
    if (currentAudio) currentAudio.play();
  }
}, { once: true });

if (unmuteBtnEl) {
  unmuteBtnEl.addEventListener('click', () => {
    audioUnlocked = true;
    isMutedLocally = false;
    updateSoundToggleUI();
    unmuteBtnEl.classList.add('hidden');
    if (currentAudio) currentAudio.play();
  });
}

// ==========================================
// RENDERIZADO DE COMENTARIOS EN VIVO
// ==========================================
function addCommentToFeed(commentData) {
  const placeholder = commentsFeedEl.querySelector('.comment-placeholder');
  if (placeholder) {
    placeholder.remove();
  }

  const commentItem = document.createElement('div');
  commentItem.className = 'comment-item';

  const avatar = commentData.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${commentData.user || 'anon'}`;

  commentItem.innerHTML = `
    <img src="${avatar}" alt="" class="comment-avatar" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=fallback'">
    <div class="comment-body">
      <span class="comment-user">@${escapeHtml(commentData.user)}</span>
      <span class="comment-text">${escapeHtml(commentData.text)}</span>
    </div>
  `;

  commentsFeedEl.appendChild(commentItem);

  while (commentsFeedEl.children.length > 4) {
    commentsFeedEl.removeChild(commentsFeedEl.firstChild);
  }
}

// ==========================================
// EFECTOS VISUALES Y ALERTAS
// ==========================================
function showSecretAlert(userName) {
  if (!secretAlertEl) return;
  secretAlertTextEl.textContent = `¡Nuevo secreto de @${userName} recibido! Se leerá en directo`;
  secretAlertEl.classList.remove('hidden');
  setTimeout(() => {
    secretAlertEl.classList.add('hidden');
  }, 4500);
}

function spawnFloatingEmoji(emoji) {
  const el = document.createElement('div');
  el.textContent = emoji;
  el.style.position = 'fixed';
  el.style.left = `${15 + Math.random() * 70}%`;
  el.style.bottom = '120px';
  el.style.fontSize = `${1.8 + Math.random() * 1.2}rem`;
  el.style.pointerEvents = 'none';
  el.style.zIndex = '999';
  el.style.transition = 'all 2.2s cubic-bezier(0.25, 1, 0.5, 1)';
  el.style.opacity = '1';
  el.style.transform = `translateY(0) scale(0.5) rotate(${Math.random() * 30 - 15}deg)`;

  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = `translateY(-${350 + Math.random() * 150}px) scale(1.4) rotate(${Math.random() * 60 - 30}deg)`;
    el.style.opacity = '0';
  });

  setTimeout(() => el.remove(), 2400);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// SOCKET.IO EVENTOS DEL PODCAST
// ==========================================
socket.on('new_podcast_story', story => {
  console.log('[Nuevo Episodio de Podcast]', story.title);

  storyCategoryEl.textContent = story.category || '🔥 MARATÓN HISTÓRICA';
  if (storyCounterEl) {
    const sId = story.realSecretId || story.id || 1;
    storyCounterEl.textContent = `📜 SECRETO #${sId} DE 19,934`;
  }
  storyTitleEl.textContent = story.title || 'Confesión Anónima';
  storyTextEl.textContent = story.storyText || story.text;
  debateQuestionEl.textContent = story.debateQuestion || '¿Tú qué opinas? Deja tu mensaje en el chat 👇';

  // Locución con voz sensual
  if (story.audioUrl && !isMutedLocally) {
    playPodcastVoice(story.audioUrl);
  }
});

socket.on('new_community_comment', comment => {
  addCommentToFeed(comment);
});

socket.on('user_secret_alert', data => {
  showSecretAlert(data.user);
  spawnFloatingEmoji('💌');
});

socket.on('gift_alert', data => {
  for (let i = 0; i < 8; i++) {
    setTimeout(() => spawnFloatingEmoji('🌹'), i * 80);
  }
  addCommentToFeed({
    user: data.user,
    avatar: data.avatar,
    text: `🎁 Envió ${data.giftName} (${data.diamonds} 💎)`
  });
});

socket.on('gift_goal_update', updateGoalUI);

socket.on('podcast_sync', state => {
  if (state.giftState) {
    updateGoalUI(state.giftState);
  }

  if (state.currentStory) {
    storyCategoryEl.textContent = state.currentStory.category;
    if (storyCounterEl) {
      storyCounterEl.textContent = state.currentStory.orderNumber ? `🤫 Confesión #${state.currentStory.orderNumber} de ${state.currentStory.totalStories || '?'}` : '🤫 Confesión Anónima';
    }
    storyTitleEl.textContent = state.currentStory.title;
    storyTextEl.textContent = state.currentStory.storyText || state.currentStory.text;
    debateQuestionEl.textContent = state.currentStory.debateQuestion;

    // Si entramos a la página y hay historia lista pero no está sonando, reproducir de inmediato
    if (state.currentStory.audioUrl && !currentAudio && !isMutedLocally) {
      playPodcastVoice(state.currentStory.audioUrl);
    }
  }

  if (state.recentComments && state.recentComments.length > 0) {
    state.recentComments.slice(-4).forEach(addCommentToFeed);
  }
});
