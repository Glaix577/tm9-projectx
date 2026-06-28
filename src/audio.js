// audio.js — Sincroniza la música real con el game loop

export class AudioSync {
  /**
   * @param {string} src    - ruta al mp3
   * @param {number} offset - ms desde donde debe arrancar la canción
   *                          (debe coincidir con el inicio de grabación del chart)
   */
  constructor(src, offset = 0) {
    this.audio  = new Audio(src);
    this.offset = offset / 1000; // segundos
    this.audio.preload = 'auto';
  }

  // Arranca el audio un poco antes de la primera nota, para darle tiempo
  // a caer desde arriba del canvas en vez de aparecer ya sobre la línea de golpe.
  // leadTimeMs es cuánto antes (en ms) debe empezar a sonar la canción.
  async start(leadTimeMs = 2000) {
    const startSeconds = Math.max(0, this.offset - leadTimeMs / 1000);
    this.audio.currentTime = startSeconds;
    try {
      await this.audio.play();
    } catch (err) {
      // Algunos navegadores bloquean autoplay sin interacción previa del usuario.
      // Como el juego ya arranca con un keydown, esto normalmente no pasa,
      // pero lo dejamos registrado por si acaso.
      console.warn('No se pudo reproducir el audio automáticamente:', err);
    }
  }

  stop() {
    this.audio.pause();
  }

  // Tiempo transcurrido en ms desde el inicio REAL de la canción (tiempo absoluto).
  // Esto coincide con cómo se grabaron las notas en chart.js — el beatmap creator
  // guardó cada nota como audio.currentTime * 1000 en el momento del tap,
  // sin restar el offset. Por eso aquí tampoco se resta: ambos deben vivir
  // en la misma escala de tiempo absoluto para que las notas calcen.
  getTime() {
    return this.audio.currentTime * 1000;
  }
}
