// main.js — Punto de entrada, maneja las pantallas

import { Game } from './game.js';

const screens = {
  menu:    document.getElementById('screen-menu'),
  game:    document.getElementById('screen-game'),
  results: document.getElementById('screen-results'),
};

const game = new Game();

// ── Menú → Juego ──────────────────────────────────────────────────────────
window.addEventListener('keydown', () => {
  if (!screens.menu.classList.contains('active')) return;
  screens.menu.classList.remove('active');
  screens.game.classList.add('active');
  game.start();
}, { once: false });

// ── Resultados → Reintentar ───────────────────────────────────────────────
document.getElementById('btn-retry').addEventListener('click', () => {
  screens.results.classList.remove('active');
  screens.game.classList.add('active');
  game.start();
});
