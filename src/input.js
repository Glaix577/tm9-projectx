// input.js — Maneja el teclado

export class Input {
  constructor() {
    // qué teclas están presionadas ahora mismo
    this.pressed = { 0: false, 1: false, 2: false, 3: false };

    // callbacks que el juego registra
    this._onPress   = null;
    this._onRelease = null;

    // mapa tecla → columna
    this.KEY_MAP = {
      'a': 0, 'A': 0,
      's': 1, 'S': 1,
      'k': 2, 'K': 2,
      'l': 3, 'L': 3,
    };

    this._handleDown = this._handleDown.bind(this);
    this._handleUp   = this._handleUp.bind(this);
  }

  listen() {
    window.addEventListener('keydown', this._handleDown);
    window.addEventListener('keyup',   this._handleUp);
  }

  stop() {
    window.removeEventListener('keydown', this._handleDown);
    window.removeEventListener('keyup',   this._handleUp);
  }

  onPress(fn)   { this._onPress   = fn; }
  onRelease(fn) { this._onRelease = fn; }

  _handleDown(e) {
    const col = this.KEY_MAP[e.key];
    if (col === undefined || this.pressed[col]) return;
    this.pressed[col] = true;
    if (this._onPress) this._onPress(col);
  }

  _handleUp(e) {
    const col = this.KEY_MAP[e.key];
    if (col === undefined) return;
    this.pressed[col] = false;
    if (this._onRelease) this._onRelease(col);
  }
}
