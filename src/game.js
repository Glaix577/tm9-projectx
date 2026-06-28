// game.js — Canvas, game loop, notas, scoring

import { CHART }      from './chart.js';
import { Input }      from './input.js';
import { AudioSync }  from './audio.js';

// ── Constantes visuales ──────────────────────────────────────────────────────
const COLS         = 4;
const COL_W        = 90;       // ancho de cada columna px
const NOTE_R       = 22;       // radio del círculo de nota (antes 16 — más grande, más visible)
const NOTE_SPEED   = 750;      // px por segundo — más alto = caen más rápido (antes 400)
const HIT_Y_RATIO  = 0.82;     // dónde está la línea de golpe (82% del alto)
const HIT_WINDOW   = 180;      // ms tolerancia total para hit
const PERFECT_WIN  = 60;       // ms para PERFECT

// El chart guarda cada nota con su timestamp absoluto en la canción
// (ej: 185590ms = el momento exacto en la canción, no relativo a nada).
// El audio arranca un poco antes de ahí para darle tiempo a caer a la primera nota.
const SONG_START_OFFSET = 185590; // ms — debe ser <= el time de la primera nota del chart

const COL_COLORS = ['#ff4fd8', '#4fd8ff', '#4dff91', '#ffd24f'];
const KEYS_LABEL = ['A', 'S', 'K', 'L'];

// Columna → pose del sprite (A=izquierda, S=abajo, K=arriba, L=derecha)
const COL_POSE = ['left', 'down', 'up', 'right'];

// ── Clase principal ──────────────────────────────────────────────────────────
export class Game {
  constructor() {
    this.canvas  = document.getElementById('gameCanvas');
    this.ctx     = this.canvas.getContext('2d');
    this.input   = new Input();
    this.audio   = new AudioSync('./assets/music/inevitable.mp3', SONG_START_OFFSET);

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.input.onPress(col => this._onKeyPress(col));

    // ── Sprites del personaje ────────────────────────────────────────────────
    this.sprites = {};
    this.spritePose = 'idle';
    this.spriteTimer = 0; // frames restantes mostrando una pose reactiva
    this._loadSprites();

    // ── Fondo ─────────────────────────────────────────────────────────────────
    this.bgImage = new Image();
    this.bgImage.src = './assets/ui/background.jpg';
  }

  _loadSprites() {
    const poses = ['idle', 'up', 'down', 'left', 'right'];
    for (const p of poses) {
      const img = new Image();
      img.src = `./assets/sprites/player/${p}.png`;
      this.sprites[p] = img;
    }
  }

  // ── Iniciar partida ────────────────────────────────────────────────────────
  async start() {
    this.score     = 0;
    this.combo     = 0;
    this.maxCombo  = 0;
    this.startTime = null;
    this.running   = true;
    this.ended     = false;

    // Clonar notas del beatmap con estado
    this.notes = CHART.notes.map(n => ({
      ...n,
      hit:    false,
      missed: false,
    }));

    // Estado visual de columnas (flash al presionar)
    this.colFlash = [0, 0, 0, 0];   // countdown de frames

    this.input.listen();
    await this.audio.start();   // arranca el mp3 desde SONG_START_OFFSET
    requestAnimationFrame(ts => this._loop(ts));
  }

  stop() {
    this.running = false;
    this.input.stop();
    this.audio.stop();
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  _loop(timestamp) {
    if (!this.running) return;

    // Usamos el tiempo real del audio (en ms) como fuente de verdad del timing.
    // Esto evita que el juego se desincronice de la música con el paso del tiempo.
    const elapsed = this.audio.getTime();

    this._update(elapsed);
    this._draw(elapsed);

    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Lógica ────────────────────────────────────────────────────────────────
  _update(elapsed) {
    const hitY = this.canvas.height * HIT_Y_RATIO;

    for (const note of this.notes) {
      if (note.hit || note.missed) continue;

      // Posición Y actual de la nota
      const y = this._noteY(note.time, elapsed);

      // ¿Pasó la ventana sin ser golpeada?
      if (elapsed > note.time + HIT_WINDOW / 2) {
        note.missed = true;
        this.combo = 0;
        this._showJudgment('miss');
        this._updateHUD();
      }
    }

    // Decrementar flash de columnas
    this.colFlash = this.colFlash.map(f => Math.max(0, f - 1));

    // Volver a idle cuando se acaba el tiempo de la pose reactiva
    if (this.spriteTimer > 0) {
      this.spriteTimer--;
      if (this.spriteTimer === 0) this.spritePose = 'idle';
    }

    // ¿Terminó el beatmap?
    if (!this.ended && this.notes.every(n => n.hit || n.missed)) {
      this.ended = true;
      setTimeout(() => this._finish(), 800);
    }
  }

  // ── Tecla presionada ──────────────────────────────────────────────────────
  _onKeyPress(col) {
    if (!this.running) return;

    const elapsed = this.audio.getTime();
    this.colFlash[col] = 8;   // frames de flash

    // El sprite reacciona a la tecla sin importar si conecta o no —
    // se siente más vivo si responde a cada input del jugador.
    this.spritePose  = COL_POSE[col];
    this.spriteTimer = 14;   // frames que dura la pose antes de volver a idle

    // Buscar la nota más cercana en esa columna
    let best = null;
    let bestDiff = Infinity;

    for (const note of this.notes) {
      if (note.col !== col || note.hit || note.missed) continue;
      const diff = Math.abs(elapsed - note.time);
      if (diff < bestDiff) { bestDiff = diff; best = note; }
    }

    if (best && bestDiff <= HIT_WINDOW / 2) {
      best.hit = true;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      if (bestDiff <= PERFECT_WIN / 2) {
        this.score += 300 + this.combo * 2;
        this._showJudgment('perfect');
      } else {
        this.score += 100 + this.combo;
        this._showJudgment('good');
      }
      this._updateHUD();
    }
  }

  // ── Posición Y de una nota ─────────────────────────────────────────────────
  _noteY(noteTime, elapsed) {
    const hitY   = this.canvas.height * HIT_Y_RATIO;
    const delta  = (noteTime - elapsed) / 1000;   // segundos hasta el hit
    return hitY - delta * NOTE_SPEED;
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  _draw(elapsed) {
    const { ctx, canvas } = this;
    const hitY  = canvas.height * HIT_Y_RATIO;
    const left  = (canvas.width - COLS * COL_W) / 2;

    // Fondo — imagen si ya cargó, color sólido mientras tanto
    if (this.bgImage && this.bgImage.complete) {
      ctx.drawImage(this.bgImage, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(13,13,26,0.55)'; // oscurece un poco para que las notas resalten
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Personaje — al lado izquierdo de las columnas
    this._drawSprite(ctx, canvas);

    // Columnas
    for (let c = 0; c < COLS; c++) {
      const x = left + c * COL_W;
      const color = COL_COLORS[c];

      // Fondo columna
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x, 0, COL_W, canvas.height);

      // Flash al presionar
      if (this.colFlash[c] > 0) {
        ctx.fillStyle = `${color}22`;
        ctx.fillRect(x, 0, COL_W, canvas.height);
      }

      // Línea divisora
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + COL_W - 1, 0, 1, canvas.height);

      // Zona de golpe (receptor)
      this._drawReceptor(ctx, x, hitY, color, this.input.pressed[c]);

      // Etiqueta de tecla
      ctx.fillStyle = this.input.pressed[c] ? color : 'rgba(255,255,255,0.2)';
      ctx.font = 'bold 14px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(KEYS_LABEL[c], x + COL_W / 2, hitY + 52);
    }

    // Notas
    for (const note of this.notes) {
      if (note.hit) continue;
      const y = this._noteY(note.time, elapsed);
      if (y < -NOTE_R * 2 || y > canvas.height + NOTE_R * 2) continue;

      const x = left + note.col * COL_W;
      this._drawNote(ctx, x, y, COL_COLORS[note.col], note.missed);
    }
  }

  _drawSprite(ctx, canvas) {
    const img = this.sprites[this.spritePose];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const h = canvas.height * 0.42;
    const w = h * (img.naturalWidth / img.naturalHeight);
    const left = (canvas.width - COLS * COL_W) / 2;
    const x = Math.max(20, left - w - 30);
    const y = canvas.height * HIT_Y_RATIO - h * 0.78;

    ctx.drawImage(img, x, y, w, h);
  }

  _drawReceptor(ctx, x, y, color, pressed) {
    const r = COL_W * 0.38;
    ctx.save();
    ctx.translate(x + COL_W / 2, y);

    // Sombra/glow
    ctx.shadowColor = color;
    ctx.shadowBlur  = pressed ? 20 : 6;

    // Círculo exterior
    ctx.strokeStyle = pressed ? color : `${color}88`;
    ctx.lineWidth   = pressed ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Relleno suave
    ctx.fillStyle = pressed ? `${color}44` : `${color}11`;
    ctx.fill();

    ctx.restore();
  }

  _drawNote(ctx, x, y, color, missed) {
    ctx.save();
    ctx.shadowColor = missed ? '#ff4f4f' : color;
    ctx.shadowBlur  = missed ? 4 : 14;

    const cx = x + COL_W / 2;

    // Círculo principal
    ctx.fillStyle = missed ? '#ff4f4f44' : color;
    ctx.beginPath();
    ctx.arc(cx, y, NOTE_R, 0, Math.PI * 2);
    ctx.fill();

    // Borde
    ctx.shadowBlur = 0;
    ctx.strokeStyle = missed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, y, NOTE_R, 0, Math.PI * 2);
    ctx.stroke();

    // Brillo superior (le da volumen al círculo)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(cx - NOTE_R * 0.3, y - NOTE_R * 0.3, NOTE_R * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  _updateHUD() {
    document.getElementById('score').textContent = this.score;
    document.getElementById('combo').textContent = this.combo;
  }

  // ── Judgment text ─────────────────────────────────────────────────────────
  _showJudgment(type) {
    const el = document.getElementById('judgment');
    el.className = `show ${type}`;
    el.textContent = type === 'perfect' ? '✦ PERFECT' : type === 'good' ? 'GOOD' : 'MISS';
    clearTimeout(this._judgTimer);
    this._judgTimer = setTimeout(() => el.className = '', 400);
  }

  // ── Fin ───────────────────────────────────────────────────────────────────
  _finish() {
    this.stop();

    const total  = this.notes.length;
    const missed = this.notes.filter(n => n.missed).length;
    const won    = missed <= total * 0.3;   // gana si falló 30% o menos

    document.getElementById('final-score').textContent = this.score;
    document.getElementById('final-combo').textContent = this.maxCombo;

    const resultImg = document.getElementById('result-sprite');
    resultImg.src = won
      ? './assets/sprites/results/ganaste.png'
      : './assets/sprites/results/perdiste.png';

    document.getElementById('results-title').textContent = won ? '¡GANASTE!' : 'PERDISTE';

    document.getElementById('screen-game').classList.remove('active');
    document.getElementById('screen-results').classList.add('active');
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}
