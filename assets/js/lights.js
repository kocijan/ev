/* =========================================================================
   Refaktorirana startna svjetla Formule 1 (FIA standard)
   Pali se 5 crvenih svjetala u razmaku od 1s.
   Nakon 5. svjetla slijedi nasumična pauza 0.2–3.0 s (simulacija učitavanja).
   U trenutku gašenja svih svjetala starta utrka.
   ========================================================================= */

export class F1Lights {
  /**
   * @param {HTMLElement} container
   * @param {Object} options
   * @param {() => void} [options.onStartHold] Poziva se kad se upali 5. svjetlo (početak učitavanja prijavnice)
   * @param {(lightsOutTime: number, loadingDuration: number) => void} [options.onLightsOut] Poziva se kad se svjetla ugase
   * @param {(reason: string) => void} [options.onJumpStart] Poziva se ako korisnik pokuša krenuti prije gašenja
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.strips = [];
    this.stage = "idle"; // "idle" | "running" | "holding" | "out"
    this.rafId = null;
    this.timeoutId = null;
    this.startTime = 0;
    this.holdStartTime = 0;
    this.lightsOutTime = 0;
    this.loadingDuration = 0;

    this._buildDOM();
  }

  _buildDOM() {
    this.container.innerHTML = "";
    const board = document.createElement("div");
    board.className = "back-board";
    this.container.appendChild(board);

    this.strips = [];
    for (let i = 0; i < 5; i++) {
      const strip = document.createElement("div");
      strip.className = "light-strip";
      for (let j = 0; j < 4; j++) {
        const lamp = document.createElement("div");
        lamp.className = "lamp";
        strip.appendChild(lamp);
      }
      this.container.appendChild(strip);
      this.strips.push(strip);
    }
  }

  reset() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.rafId = null;
    this.timeoutId = null;
    this.stage = "idle";
    this.startTime = 0;
    this.holdStartTime = 0;
    this.lightsOutTime = 0;
    this.loadingDuration = 0;

    for (const s of this.strips) {
      s.classList.remove("is-on");
    }
  }

  /**
   * Pokreće F1 sekvencu
   */
  start() {
    this.reset();
    this.stage = "running";
    this.startTime = performance.now();

    let litCount = 0;

    const frame = (now) => {
      if (this.stage !== "running") return;

      const elapsed = now - this.startTime;
      const targetLit = Math.min(5, Math.floor(elapsed / 1000) + 1);

      if (targetLit > litCount) {
        for (let i = litCount; i < targetLit; i++) {
          this.strips[i].classList.add("is-on");
        }
        litCount = targetLit;
      }

      if (targetLit < 5) {
        this.rafId = requestAnimationFrame(frame);
      } else {
        // Svih 5 je upaljeno! Ulazimo u holding fazu (FIA: 0.2s - 3.0s nasumično)
        this.stage = "holding";
        this.holdStartTime = performance.now();

        if (typeof this.options.onStartHold === "function") {
          this.options.onStartHold();
        }

        // Nasumični interval 0.2 - 3.0 sekundi (200ms - 3000ms)
        const randomDelayMs = 200 + Math.random() * 2800;
        this.loadingDuration = randomDelayMs;

        this.timeoutId = setTimeout(() => {
          this._turnOff();
        }, randomDelayMs);
      }
    };

    this.rafId = requestAnimationFrame(frame);
  }

  _turnOff() {
    this.stage = "out";
    for (const s of this.strips) {
      s.classList.remove("is-on");
    }
    this.lightsOutTime = performance.now();

    if (typeof this.options.onLightsOut === "function") {
      this.options.onLightsOut(this.lightsOutTime, this.loadingDuration);
    }
  }

  /**
   * Provjera ranog starta
   */
  triggerEarly() {
    if (this.stage === "running" || this.stage === "holding") {
      this.reset();
      if (typeof this.options.onJumpStart === "function") {
        this.options.onJumpStart("Rani start (Jump start)! Krenuli ste prije nego što su se svjetla ugasila.");
      }
      return true;
    }
    return false;
  }
}
