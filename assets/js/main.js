/* =========================================================================
   Glavna skripta simulatora prijave na poticaje za električna vozila
   - Povezivanje odbrojavanja, profila, startnih svjetala i obrasca
   - Obrada ciljne linije, DNF provjere, osobnog rekorda i ljestvice
   ========================================================================= */

import { initCountdown } from "./countdown.js";
import { F1Lights } from "./lights.js";
import { EfzFormWizard } from "./efz-form.js";
import { triggerConfetti } from "./confetti.js";
import {
  loadProfile,
  saveProfile,
  clearProfile,
  loadLeaderboard,
  saveLeaderboard,
  clearLeaderboard,
  getBestTime
} from "./storage.js";

// Formatiranje vremena (hrvatski zarez za decimale)
function formatTime(ms) {
  if (typeof ms !== "number" || isNaN(ms) || ms < 0) return "--,--- s";
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return totalSeconds.toFixed(3).replace(".", ",") + " s";
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = (totalSeconds % 60).toFixed(3).padStart(6, "0").replace(".", ",");
  return `${mins}:${secs} min`;
}

function formatDate(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return isoStr;
  }
}

// Normalizacija brojeva za usporedbu cijena i subvencija
function normalizeNumber(str) {
  if (!str) return "";
  return str.replace(/\s+/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
}

// Glavna aplikacija
class EvSimulatorApp {
  constructor() {
    this.profile = loadProfile();
    this.leaderboard = loadLeaderboard();

    this.isRacing = false;
    this.lightsOutTime = 0;
    this.loadingDuration = 0;
    this.timerRaf = null;

    this.f1Lights = null;
    this.currentWizard = null;

    this._cacheDOM();
    this._initCountdown();
    this._initProfileForm();
    this._renderLeaderboard();
    this._bindEvents();
    this._initPreviewLights();
  }

  _cacheDOM() {
    this.body = document.body;
    this.lobbyEl = document.getElementById("lobby");
    this.raceEl = document.getElementById("race");

    // HUD & Timer
    this.simTimerEl = document.getElementById("sim-timer");
    this.abortBtn = document.getElementById("abort-race");

    // Start lights overlay
    this.startOverlay = document.getElementById("start-overlay");
    this.startStatus = document.getElementById("start-status");
    this.formLoading = document.getElementById("form-loading");
    this.raceLightsEl = document.getElementById("race-lights");
    this.previewLightsEl = document.getElementById("preview-lights");

    // Views
    this.viewCalls = document.getElementById("efz-view-calls");
    this.viewForm = document.getElementById("efz-view-form");
    this.viewSuccess = document.getElementById("efz-view-success");

    // eFZOEU shell
    this.efzRoot = document.getElementById("efz");
    this.efzModal = document.getElementById("efz-modal");
    this.efzToasts = document.getElementById("efz-toasts");

    // Results dialog & Confetti
    this.resultDialog = document.getElementById("result-dialog");
    this.resultInner = document.getElementById("result-inner");
    this.confettiCanvas = document.getElementById("confetti");

    // Buttons
    this.startRaceBtn = document.getElementById("start-race");
  }

  _initCountdown() {
    initCountdown({
      daysEl: document.querySelector(`[data-cd="d"]`),
      daysLabelEl: document.querySelector(`[data-cd-label="d"]`),
      hoursEl: document.querySelector(`[data-cd="h"]`),
      minsEl: document.querySelector(`[data-cd="m"]`),
      secsEl: document.querySelector(`[data-cd="s"]`),
      openMsgEl: document.getElementById("countdown-open"),
      clockEl: document.getElementById("zagreb-clock")
    });
  }

  /* -------------------------------------------------------- PROFIL */
  _initProfileForm() {
    const form = document.getElementById("profile-form");
    if (!form) return;

    // Popuni polja spremljenim vrijednostima
    const subTypeRadios = form.querySelectorAll(`input[name="pf_sub_type"]`);
    subTypeRadios.forEach((r) => {
      r.checked = r.value === (this.profile.subType || "own");
    });
    const oibInput = form.querySelector(`[data-key="oib"]`);
    if (oibInput) oibInput.value = this.profile.oib || "11805144057";

    form.querySelector(`[data-key="name"]`).value = this.profile.name || "";
    form.querySelector(`[data-key="phone"]`).value = this.profile.phone || "";
    form.querySelector(`[data-key="email"]`).value = this.profile.email || "";
    form.querySelector(`[data-key="category"]`).value = this.profile.category || "";
    form.querySelector(`[data-key="price"]`).value = this.profile.price || "";
    form.querySelector(`[data-key="subsidy"]`).value = this.profile.subsidy || "";

    const updateProfileFromInputs = () => {
      const checkedRadio = form.querySelector(`input[name="pf_sub_type"]:checked`);
      this.profile = {
        subType: checkedRadio ? checkedRadio.value : "own",
        oib: oibInput ? oibInput.value.trim() : "11805144057",
        name: form.querySelector(`[data-key="name"]`).value.trim(),
        phone: form.querySelector(`[data-key="phone"]`).value.trim(),
        email: form.querySelector(`[data-key="email"]`).value.trim(),
        category: form.querySelector(`[data-key="category"]`).value,
        price: form.querySelector(`[data-key="price"]`).value.trim(),
        subsidy: form.querySelector(`[data-key="subsidy"]`).value.trim()
      };
      saveProfile(this.profile);
      this._renderProfileSummary();
    };

    form.addEventListener("input", updateProfileFromInputs);
    form.addEventListener("change", updateProfileFromInputs);

    const btnClear = document.getElementById("pf-clear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        form.reset();
        const defaultRadio = form.querySelector(`input[name="pf_sub_type"][value="own"]`);
        if (defaultRadio) defaultRadio.checked = true;
        if (oibInput) oibInput.value = "11805144057";
        form.querySelector(`[data-key="category"]`).value = "";
        clearProfile();
        this.profile = loadProfile();
        this._renderProfileSummary();
      });
    }

    this._renderProfileSummary();
  }

  _renderProfileSummary() {
    const summaryEl = document.getElementById("pf-summary");
    if (!summaryEl) return;

    const checkedFields = [];
    if (this.profile.subType === "other") {
      checkedFields.push("Vrsta: Uz punomoć");
    } else {
      checkedFields.push("Vrsta: U svoje ime");
    }
    if (this.profile.oib) checkedFields.push(`OIB: ${this.profile.oib}`);
    if (this.profile.name) checkedFields.push("Ime i prezime");
    if (this.profile.phone) checkedFields.push("Telefon");
    if (this.profile.email) checkedFields.push("E-mail");
    if (this.profile.category) checkedFields.push(`Kategorija (${this.profile.category})`);
    if (this.profile.price) checkedFields.push("Cijena");
    if (this.profile.subsidy) checkedFields.push("Subvencija");

    summaryEl.innerHTML = `
      <span>U utrci se provjerava: </span>
      ${checkedFields.map((f) => `<span class="chip">${f}</span>`).join(" ")}
    `;
  }

  /* -------------------------------------------------------- LJESTVICA */
  _renderLeaderboard() {
    const statsEl = document.getElementById("lb-stats");
    const tableWrap = document.getElementById("lb-table");
    const navRunsCount = document.getElementById("nav-runs-count");
    if (!tableWrap) return;

    const runs = this.leaderboard;
    const bestTime = getBestTime(runs);
    const validRuns = runs.filter((r) => !r.dnf && r.timeMs > 0);
    const totalCount = runs.length;
    const dnfCount = runs.filter((r) => r.dnf).length;
    const successRate = totalCount > 0 ? Math.round(((totalCount - dnfCount) / totalCount) * 100) : 0;

    if (navRunsCount) {
      navRunsCount.textContent = validRuns.length;
    }

    const avgTime = validRuns.length > 0
      ? validRuns.reduce((acc, r) => acc + r.timeMs, 0) / validRuns.length
      : null;

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="lb-stat lb-stat--best">
          <dt>Osobni rekord (PB)</dt>
          <dd>${bestTime ? formatTime(bestTime) : "--,--- s"}</dd>
        </div>
        <div class="lb-stat">
          <dt>Ukupno pokušaja</dt>
          <dd>${totalCount}</dd>
        </div>
        <div class="lb-stat">
          <dt>Stopa uspjeha</dt>
          <dd>${totalCount > 0 ? successRate + "%" : "-- %"}</dd>
        </div>
        <div class="lb-stat">
          <dt>Prosječno vrijeme</dt>
          <dd>${avgTime ? formatTime(avgTime) : "--,--- s"}</dd>
        </div>
      `;
    }

    if (runs.length === 0) {
      tableWrap.innerHTML = `
        <div class="lb-empty">
          <p>Još nemate zabilježenih pokušaja.</p>
          <p class="muted">Kliknite na <strong>„Kreni na start“</strong> i vježbajte brzinu prijave!</p>
        </div>
      `;
      return;
    }

    // Prikaz ljestvice: sortirano po vremenu (najbrži na vrhu, DNF na dnu)
    const sortedRuns = [...runs].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      if (!a.dnf && !b.dnf) return a.timeMs - b.timeMs;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    tableWrap.innerHTML = `
      <table class="lb-table">
        <thead>
          <tr>
            <th class="lb-pos">#</th>
            <th class="lb-time">Vrijeme</th>
            <th class="lb-check">Status</th>
            <th class="lb-date">Datum i sat</th>
            <th class="lb-reason">Detalji / Razlog DNF-a</th>
          </tr>
        </thead>
        <tbody>
          ${sortedRuns.map((run, idx) => {
            const isPb = !run.dnf && run.timeMs === bestTime;
            const isDnf = Boolean(run.dnf);
            return `
              <tr class="${isPb ? 'is-best' : ''} ${isDnf ? 'is-dnf' : ''}">
                <td class="lb-pos">${isDnf ? "—" : idx + 1}</td>
                <td class="lb-time">${isDnf ? "DNF" : formatTime(run.timeMs)}</td>
                <td class="lb-check">
                  ${isDnf
                    ? `<span class="chip-status chip-dnf">DNF</span>`
                    : isPb
                      ? `<span class="chip-status chip-pb">★ REKORD</span>`
                      : `<span class="chip-status chip-ok">Uspješno</span>`
                  }
                </td>
                <td class="lb-date">${formatDate(run.timestamp)}</td>
                <td class="lb-reason">
                  ${isDnf
                    ? `<span class="dnf-word">${run.dnfReason || "Nepoznat uzrok prekida"}</span>`
                    : `<span>Uredno ispunjena prijava</span>
                       <span class="lb-splits">učitavanje: ${(run.splits?.loadingMs / 1000).toFixed(2).replace(".", ",")}s · ispunjavanje: ${formatTime(run.timeMs)}</span>`
                  }
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

    const btnClearLb = document.getElementById("lb-clear");
    if (btnClearLb) {
      btnClearLb.onclick = async () => {
        if (confirm("Jeste li sigurni da želite obrisati sve rezultate iz osobne ljestvice?")) {
          clearLeaderboard();
          this.leaderboard = [];
          this._renderLeaderboard();
        }
      };
    }
  }

  /* -------------------------------------------------------- PREVIEW LIGHTS */
  _initPreviewLights() {
    if (!this.previewLightsEl) return;
    this.previewLightsEl.innerHTML = "";
    const board = document.createElement("div");
    board.className = "back-board";
    this.previewLightsEl.appendChild(board);

    for (let i = 0; i < 5; i++) {
      const strip = document.createElement("div");
      strip.className = "light-strip";
      for (let j = 0; j < 4; j++) {
        const lamp = document.createElement("div");
        lamp.className = "lamp";
        strip.appendChild(lamp);
      }
      this.previewLightsEl.appendChild(strip);
    }
  }

  /* -------------------------------------------------------- UTRKA I START */
  _bindEvents() {
    this.startRaceBtn.addEventListener("click", () => this.startRace());

    // Prekid tipkom Esc ili pokretanje razmaknicom u lobbyju
    window.addEventListener("keydown", (e) => {
      if (e.key === " " && !this.isRacing) {
        // Samo ako nismo unutar tekstualnog polja profila
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
        if (activeTag !== "input" && activeTag !== "select" && activeTag !== "textarea") {
          e.preventDefault();
          this.startRace();
        }
      } else if (e.key === "Escape" && this.isRacing) {
        this.abortRace("Utrka je prekinuta pritiskom na tipku Escape.");
      }
    });

    this.abortBtn.addEventListener("click", () => {
      this.abortRace("Utrka je ručno prekinuta gumbom 'Prekini utrku'.");
    });

    // Tema u eFZOEU sustavu (svijetla / tamna)
    const themeBtn = document.getElementById("efz-theme");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const currentTheme = this.efzRoot.getAttribute("data-theme") || "light";
        const nextTheme = currentTheme === "light" ? "dark" : "light";
        this.efzRoot.setAttribute("data-theme", nextTheme);
        themeBtn.setAttribute("aria-checked", nextTheme === "dark" ? "true" : "false");
      });
    }

    // Pristupačnost
    const a11yContrast = document.querySelector(`[data-a11y="contrast"]`);
    if (a11yContrast) {
      a11yContrast.addEventListener("change", (e) => {
        this.efzRoot.classList.toggle("a11y-contrast", e.target.checked);
      });
    }

    const a11yDyslexia = document.querySelector(`[data-a11y="dyslexia"]`);
    if (a11yDyslexia) {
      a11yDyslexia.addEventListener("change", (e) => {
        this.efzRoot.classList.toggle("a11y-dyslexia", e.target.checked);
      });
    }

    document.querySelectorAll(`[data-a11y-font]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = parseFloat(btn.dataset.a11yFont);
        const cur = parseFloat(getComputedStyle(this.efzRoot).getPropertyValue("--e-font-scale")) || 1;
        const next = Math.max(0.85, Math.min(1.4, cur + delta * 0.1));
        this.efzRoot.style.setProperty("--e-font-scale", next.toFixed(2));
      });
    });

    const a11yReset = document.querySelector(`[data-a11y-reset]`);
    if (a11yReset) {
      a11yReset.addEventListener("click", () => {
        this.efzRoot.classList.remove("a11y-contrast", "a11y-dyslexia");
        if (a11yContrast) a11yContrast.checked = false;
        if (a11yDyslexia) a11yDyslexia.checked = false;
      });
    }

    // Pozicioniranje popovera točno ispod gumba na desnoj strani
    const bindPopoverPositioning = (popoverId, triggerId) => {
      const pop = document.getElementById(popoverId);
      const trigger = document.getElementById(triggerId);
      if (!pop || !trigger) return;

      const updatePos = () => {
        const rect = trigger.getBoundingClientRect();
        pop.style.top = `${rect.bottom + 6}px`;
        const rightOffset = Math.max(12, window.innerWidth - rect.right);
        pop.style.right = `${rightOffset}px`;
        pop.style.left = "auto";
      };

      pop.addEventListener("beforetoggle", (e) => {
        if (e.newState === "open") updatePos();
      });
      pop.addEventListener("toggle", (e) => {
        if (e.newState === "open") updatePos();
      });
    };

    bindPopoverPositioning("efz-a11y-pop", "efz-a11y-btn");
    bindPopoverPositioning("efz-user-pop", "efz-user-btn");

    // Klik na modul izbornika tijekom prijave -> DNF
    document.querySelectorAll(`[data-leave]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.isRacing) {
          const reason = btn.getAttribute("data-leave") || "Napustili ste prijavni obrazac.";
          this.abortRace(reason);
        }
      });
    });
  }

  startRace() {
    if (this.isRacing) return;
    this.isRacing = true;

    // Ažuriraj korisničko ime u eFZOEU zaglavlju prema unesenom profilu
    const userNameEl = document.getElementById("efz-user-name");
    const userPopNameEl = document.getElementById("efz-user-pop-name");
    const userPopOibEl = document.getElementById("efz-user-pop-oib");
    const nameToDisplay = this.profile.name || "IVAN HORVAT";
    const oibToDisplay = this.profile.oib || "11805144057";
    if (userNameEl) userNameEl.textContent = nameToDisplay;
    if (userPopNameEl) userPopNameEl.textContent = nameToDisplay;
    if (userPopOibEl) userPopOibEl.textContent = oibToDisplay;

    // Prikaz ekrana za utrku
    this.body.setAttribute("data-screen", "race");
    this.lobbyEl.hidden = true;
    this.raceEl.hidden = false;

    // Resetiraj prikaze u sustavu
    this.viewCalls.hidden = false;
    this.viewForm.hidden = true;
    this.viewSuccess.hidden = true;

    // Resetiraj HUD timer
    this.simTimerEl.textContent = "0,000 s";
    this.simTimerEl.classList.remove("is-running", "is-stopped");

    // Pokreni startna svjetla
    this.startOverlay.hidden = false;
    this.startStatus.textContent = "Pripremite se na start…";
    this.formLoading.hidden = false;

    if (!this.f1Lights) {
      this.f1Lights = new F1Lights(this.raceLightsEl, {
        onStartHold: () => {
          this.startStatus.textContent = "Priprema sustava…";
          this.formLoading.hidden = false;
        },
        onLightsOut: (lightsOutTime, loadingDuration) => {
          this._handleLightsOut(lightsOutTime, loadingDuration);
        },
        onJumpStart: (reason) => {
          this.abortRace(reason);
        }
      });
    }

    this.f1Lights.start();
  }

  _handleLightsOut(lightsOutTime, loadingDuration) {
    this.lightsOutTime = lightsOutTime;
    this.loadingDuration = loadingDuration;

    // Sakrij startni overlay
    this.startOverlay.hidden = true;
    this.formLoading.hidden = true;

    // Prikaži prijavnicu
    this.viewCalls.hidden = true;
    this.viewForm.hidden = false;

    // Inicijaliziraj čarobnjak prijavnice
    this.currentWizard = new EfzFormWizard(this.viewForm, {
      profile: { ...this.profile },
      onSubmit: (submission) => this._handleFinish(submission),
      onAbort: (reason) => this.abortRace(reason),
      showModal: (text, title, kind) => this.showSystemModal(text, title, kind),
      showToast: (msg, kind) => this.showToast(msg, kind)
    });

    // Pokreni štopericu
    this.simTimerEl.classList.add("is-running");
    const updateTimer = () => {
      if (!this.isRacing) return;
      const elapsed = performance.now() - this.lightsOutTime;
      this.simTimerEl.textContent = formatTime(elapsed);
      this.timerRaf = requestAnimationFrame(updateTimer);
    };
    this.timerRaf = requestAnimationFrame(updateTimer);
  }

  showSystemModal(text, title = "Obavijest", kind = "info") {
    return new Promise((resolve) => {
      if (!this.efzModal) return resolve(true);

      const titleEl = this.efzModal.querySelector(".efz-modal-title");
      const textEl = this.efzModal.querySelector(".efz-modal-text");
      const iconEl = this.efzModal.querySelector(".efz-modal-icon");
      const actionsEl = this.efzModal.querySelector(".efz-modal-actions");

      if (titleEl) titleEl.textContent = title;
      if (textEl) textEl.textContent = text;
      if (iconEl) iconEl.setAttribute("data-kind", kind);

      if (actionsEl) {
        if (kind === "error" || kind === "info") {
          actionsEl.innerHTML = `<button type="submit" class="efz-btn efz-btn--primary" value="ok">U redu</button>`;
        } else {
          actionsEl.innerHTML = `
            <button type="button" class="efz-btn" id="modal-btn-cancel">Ne, vrati me natrag</button>
            <button type="submit" class="efz-btn efz-btn--primary" value="confirm">Da, nastavi</button>
          `;
          const cancelBtn = actionsEl.querySelector("#modal-btn-cancel");
          if (cancelBtn) {
            cancelBtn.onclick = () => {
              this.efzModal.close("cancel");
            };
          }
        }
      }

      const onClose = () => {
        this.efzModal.removeEventListener("close", onClose);
        const res = this.efzModal.returnValue === "confirm" || this.efzModal.returnValue === "ok";
        resolve(res);
      };

      this.efzModal.addEventListener("close", onClose);
      this.efzModal.showModal();
    });
  }

  showToast(message, kind = "info") {
    if (!this.efzToasts) return;
    const toast = document.createElement("div");
    toast.className = "efz-toast";
    toast.innerHTML = `
      <span class="efz-modal-icon" data-kind="${kind}" aria-hidden="true"></span>
      <div>
        <strong>Obavijest</strong>
        <span>${message}</span>
      </div>
      <button type="button" aria-label="Zatvori">&times;</button>
    `;
    toast.querySelector("button").onclick = () => toast.remove();
    this.efzToasts.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  /* -------------------------------------------------------- CILJNA LINIJA */
  _handleFinish({ formData, files, inOwnName, oibValue }) {
    if (!this.isRacing) return;
    const finishTimestamp = performance.now();
    const elapsedMs = finishTimestamp - this.lightsOutTime;

    cancelAnimationFrame(this.timerRaf);
    this.isRacing = false;
    this.simTimerEl.classList.remove("is-running");
    this.simTimerEl.classList.add("is-stopped");
    this.simTimerEl.textContent = formatTime(elapsedMs);

    // Prikaži uspješno podneseno na eFZOEU ekranu
    this.viewForm.hidden = true;
    this.viewSuccess.hidden = false;

    // DNF provjera prema profilu korisnika
    const dnfReasons = [];

    // Provjera vrste podnošenja (u svoje ime vs uz punomoć)
    const expectedSubType = this.profile.subType || "own";
    const actualSubType = inOwnName ? "own" : "other";
    if (actualSubType !== expectedSubType) {
      if (expectedSubType === "own") {
        dnfReasons.push("Na početnoj stranici zadano je podnošenje u svoje ime, a u prijavnici je odabrano podnošenje uz punomoć.");
      } else {
        dnfReasons.push("Na početnoj stranici zadano je podnošenje uz punomoć, a u prijavnici je odabrano podnošenje u svoje ime.");
      }
    }

    // Provjera potvrđenog OIB-a
    if (this.profile.oib) {
      const cleanOibInput = (oibValue || "").trim();
      const cleanProfileOib = this.profile.oib.trim();
      if (cleanOibInput !== cleanProfileOib) {
        dnfReasons.push(`Potvrđeni OIB ("${cleanOibInput}") se ne podudara sa zadanim OIB-om u profilu ("${cleanProfileOib}").`);
      }
    }

    if (this.profile.name) {
      if (formData.name.trim().toLowerCase() !== this.profile.name.trim().toLowerCase()) {
        dnfReasons.push(`Ime i prezime ("${formData.name}") se ne podudara s profilom ("${this.profile.name}").`);
      }
    }

    if (this.profile.phone) {
      const cleanInput = formData.phone.replace(/\D/g, "");
      const cleanProfile = this.profile.phone.replace(/\D/g, "");
      if (cleanInput !== cleanProfile) {
        dnfReasons.push(`Kontakt broj ("${formData.phone}") se ne podudara s profilom ("${this.profile.phone}").`);
      }
    }

    if (this.profile.email) {
      if (formData.email.trim().toLowerCase() !== this.profile.email.trim().toLowerCase()) {
        dnfReasons.push(`E-mail adresa ("${formData.email}") se ne podudara s profilom ("${this.profile.email}").`);
      }
    }

    if (this.profile.category) {
      if (formData.category !== this.profile.category) {
        dnfReasons.push(`Kategorija vozila ("${formData.category}") se ne podudara s profilom ("${this.profile.category}").`);
      }
    }

    if (this.profile.price) {
      const numInput = normalizeNumber(formData.price);
      const numProfile = normalizeNumber(this.profile.price);
      if (numInput !== numProfile) {
        dnfReasons.push(`Cijena vozila ("${formData.price}") se ne podudara s profilom ("${this.profile.price}").`);
      }
    }

    if (this.profile.subsidy) {
      const numInput = normalizeNumber(formData.subsidy);
      const numProfile = normalizeNumber(this.profile.subsidy);
      if (numInput !== numProfile) {
        dnfReasons.push(`Tražena sredstva ("${formData.subsidy}") se ne podudaraju s profilom ("${this.profile.subsidy}").`);
      }
    }

    const isDnf = dnfReasons.length > 0;
    const finalDnfReason = isDnf ? dnfReasons.join(" ") : null;

    // Evaluacija rekorda
    const previousRuns = this.leaderboard;
    const previousValidRuns = previousRuns.filter((r) => !r.dnf && r.timeMs > 0);
    const previousBest = getBestTime(previousRuns);

    const isPersonalBest = !isDnf && (previousBest === null || elapsedMs < previousBest);
    // Uvjet iz zadatka: ako imaju barem 2 rezultata uključujući trenutni i trenutni je osobni rekord
    const totalResultsAfterThis = previousValidRuns.length + (isDnf ? 0 : 1);
    const isCelebratoryPB = !isDnf && totalResultsAfterThis >= 2 && isPersonalBest;

    const newRun = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      timeMs: elapsedMs,
      dnf: isDnf,
      dnfReason: finalDnfReason,
      splits: {
        loadingMs: this.loadingDuration,
        userTimeMs: elapsedMs
      },
      isPb: isPersonalBest
    };

    this.leaderboard.push(newRun);
    saveLeaderboard(this.leaderboard);
    this._renderLeaderboard();

    // Otvaranje dijaloga s rezultatima
    setTimeout(() => {
      this._openResultModal({
        run: newRun,
        isDnf,
        dnfReasons,
        isCelebratoryPB,
        isPersonalBest,
        previousBest
      });
    }, 450);
  }

  abortRace(reason) {
    if (!this.isRacing) return;
    cancelAnimationFrame(this.timerRaf);
    this.isRacing = false;

    if (this.f1Lights) {
      this.f1Lights.reset();
    }

    const elapsedMs = this.lightsOutTime > 0 ? performance.now() - this.lightsOutTime : 0;

    const newRun = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      timeMs: elapsedMs,
      dnf: true,
      dnfReason: reason || "Utrka prekinuta (DNF).",
      splits: {
        loadingMs: this.loadingDuration,
        userTimeMs: elapsedMs
      },
      isPb: false
    };

    this.leaderboard.push(newRun);
    saveLeaderboard(this.leaderboard);
    this._renderLeaderboard();

    this._openResultModal({
      run: newRun,
      isDnf: true,
      dnfReasons: [reason || "Prekid utrke."],
      isCelebratoryPB: false,
      isPersonalBest: false,
      previousBest: getBestTime(this.leaderboard)
    });
  }

  _openResultModal({ run, isDnf, dnfReasons, isCelebratoryPB, isPersonalBest, previousBest }) {
    if (!this.resultDialog || !this.resultInner) return;

    let modalClass = "result--ok";
    if (isDnf) modalClass = "result--dnf";
    else if (isCelebratoryPB) modalClass = "result--record";

    let heroHtml = "";

    if (isCelebratoryPB) {
      triggerConfetti(this.confettiCanvas, 5000);
      heroHtml = `
        <span class="trophy" aria-hidden="true">🏆</span>
        <span class="result-kicker">Novi osobni rekord!</span>
        <h2 class="result-title">Čestitamo! Srušili ste osobni rekord!</h2>
        <div class="result-time">${formatTime(run.timeMs)}</div>
        <p class="result-sub">Nadmašili ste prijašnji najbolji rezultat (${formatTime(previousBest)}). Sjajna brzina i preciznost!</p>
      `;
    } else if (isDnf) {
      heroHtml = `
        <span class="result-kicker">DNF · Nije završeno</span>
        <h2 class="result-title">Prijava nije prihvaćena (DNF)</h2>
        <div class="result-time">DNF</div>
        <div class="dnf-callout" role="alert">
          <span class="warn-ico" aria-hidden="true">⚠️</span>
          <div>
            <strong>Razlog diskvalifikacije (DNF):</strong>
            <ul>
              ${dnfReasons.map((r) => `<li>${r}</li>`).join("")}
            </ul>
            <p style="margin-top:8px;font-size:13px;opacity:0.85;">Pripazite: ako unesete podatke u profilu, u prijavnici ih morate unijeti točno i bez greške.</p>
          </div>
        </div>
      `;
    } else {
      heroHtml = `
        <span class="result-kicker">Prijava uspješno podnesena</span>
        <h2 class="result-title">Uspješan završetak!</h2>
        <div class="result-time">${formatTime(run.timeMs)}</div>
        <p class="result-sub">${isPersonalBest ? "Vaše prvo zabilježeno vrijeme! Odličan start." : `Vaš osobni rekord ostaje: <strong>${formatTime(previousBest)}</strong>.`}</p>
      `;
    }

    const splitsHtml = `
      <div class="result-splits">
        <div>
          <dt>Vrijeme reakcije i unosa</dt>
          <dd>${isDnf ? "DNF" : formatTime(run.timeMs)}</dd>
        </div>
        <div>
          <dt>Učitavanje sustava</dt>
          <dd>${(run.splits?.loadingMs / 1000).toFixed(3).replace(".", ",")} s</dd>
        </div>
        <div>
          <dt>Status prijave</dt>
          <dd>${isDnf ? "DNF" : "Podneseno"}</dd>
        </div>
        <div>
          <dt>Ukupno pokušaja</dt>
          <dd>${this.leaderboard.length}</dd>
        </div>
      </div>
    `;

    this.resultInner.className = `result-inner ${modalClass}`;
    this.resultInner.innerHTML = `
      <div class="result-hero">
        ${heroHtml}
      </div>

      ${splitsHtml}

      <div class="result-actions">
        <button type="button" class="btn btn-primary" id="btn-try-again">
          <span aria-hidden="true">🔄</span> Pokušaj ponovno
        </button>
        <button type="button" class="btn btn-ghost" id="btn-back-lobby">
          Povratak na početnu
        </button>
      </div>
    `;

    const btnTryAgain = this.resultInner.querySelector("#btn-try-again");
    const btnBackLobby = this.resultInner.querySelector("#btn-back-lobby");

    btnTryAgain.onclick = () => {
      this.resultDialog.close();
      this.startRace();
    };

    btnBackLobby.onclick = () => {
      this.resultDialog.close();
      this.exitToLobby();
    };

    this.resultDialog.showModal();
  }

  exitToLobby() {
    this.isRacing = false;
    cancelAnimationFrame(this.timerRaf);
    if (this.f1Lights) this.f1Lights.reset();

    this.body.setAttribute("data-screen", "lobby");
    this.raceEl.hidden = true;
    this.lobbyEl.hidden = false;
    this._renderLeaderboard();
  }
}

// Inicijalizacija pri učitavanju stranice
window.addEventListener("DOMContentLoaded", () => {
  new EvSimulatorApp();
});
