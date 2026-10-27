# 🎙️ El Confesionario - Podcast de Secretos Anónimos (TikTok Live)

Sistema de transmisión interactiva en vivo para **TikTok Live** con formato de Podcast Nocturno, narración con voz sensual neuronal de estudio (Microsoft Edge Neural TTS), lectura de chat en tiempo real y maratón cronológica desde el **Secreto #1 de TuSecreto.me**.

## 🚀 Despliegue en Coolify / Docker

1. **Repositorio Git**: `https://github.com/DiegoAzz/secreto.git`
2. **Dominio configurado**: `https://secreto.appzplay.online`
3. **Variables de entorno en Coolify**:
   - `PORT`: `3000`
   - `TIKTOK_USER`: `senseidelamor`
   - `GEMINI_API_KEY`: tu API Key de Google Gemini

## 🛠️ Características Principales

- **Maratón Histórica**: Lectura cronológica y persistente desde el Secreto #1 de la historia hasta el presente.
- **Voz Sensual Neuronal**: Locución en español ultra-natural (`es-CO-SalomeNeural`) sin ningún rastro robótico.
- **Interacción en Vivo**:
  - Detección de chat de TikTok Live en tiempo real.
  - Los oyentes pueden enviar su confesión con `!secreto [texto]`.
  - Beneficio VIP: Quienes envían 1 Rosa 🌹 pasan automáticamente al 1er lugar de la fila para ser locutados de inmediato.
- **Barra de Meta de Donaciones**: Muestra el progreso de Rosas en pantalla para incentivar regalos.
- **Anti-Eco**: Detección y bloqueo automático de duplicación de audio entre pestañas.

## 📦 Ejecución Local

```bash
npm install
npm start
```
Abrir: `http://localhost:3000` (Pantalla de Stream) o `http://localhost:3000/admin.html` (Panel de Control).
