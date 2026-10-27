/* =========================================================================
   Prijavnica eFZOEU (Kartica 1: Prijavitelj, Kartica 2: Dokumentacija, Kartica 3: Investicija)
   Sve po uzoru na službenu PDF uputu (Javni poziv EnU-2/26)
   - Strogo onemogućavanje auto-filla preglednika
   - Validacije po pravilima iz uputa
   ========================================================================= */

export const SAMPLE_DOCS = {
  form: {
    name: "Prijavni_obrazac_EnU-2_26.xlsx",
    size: 48250,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
  residence: {
    name: "Uvjerenje_o_prebivalistu.pdf",
    size: 145200,
    type: "application/pdf"
  },
  statement: {
    name: "Izjava_prijavitelja_Obrazac_2.pdf",
    size: 84300,
    type: "application/pdf"
  },
  offer: {
    name: "Ponuda_prodajnog_mjesta_vozilo.pdf",
    size: 218400,
    type: "application/pdf"
  },
  powerOfAtty: {
    name: "Specijalna_punomoc_ovjerena.pdf",
    size: 96500,
    type: "application/pdf"
  }
};

export class EfzFormWizard {
  /**
   * @param {HTMLElement} container
   * @param {Object} options
   * @param {(data: Object) => void} options.onSubmit Podnošenje prijave (ciljna linija)
   * @param {(reason: string) => void} options.onAbort Prekid/odustajanje (DNF)
   * @param {(msg: string, title?: string, kind?: string) => Promise<boolean>} options.showModal Otvaranje sustavskog dijaloga
   * @param {(msg: string, kind?: string) => void} options.showToast Prikaz obavijesti
   */
  constructor(container, options) {
    this.container = container;
    this.options = options;

    this.currentStep = 1;
    this.oibConfirmed = false; // Korisnik mora kliknuti Potvrdi
    this.inOwnName = null;     // Korisnik mora sam odabrati radio gumb
    this.oibValue = "";

    // Uneseni podaci
    this.formData = {
      name: "",
      phone: "",
      email: "",
      category: "", // Nema zadane kategorije, korisnik mora odabrati
      price: "",
      subsidy: ""
    };

    // Učitani dokumenti
    this.uploadedFiles = {
      form: null,        // Prijavni obrazac (.xls/.xlsx)
      residence: null,   // Uvjerenje o prebivalištu
      statement: null,   // Izjava prijavitelja
      offer: null,       // Ponuda za kupnju
      powerOfAtty: null  // Punomoć (ako nije u svoje ime)
    };

    this.submissionEnabledToastShown = false;

    this._render();
  }

  _render() {
    this.container.innerHTML = `
      <div class="efz-page-head">
        <div class="efz-breadcrumb"><span>Objavljeni pozivi</span> / <span>Započni prijavu</span></div>
        <div class="efz-title-row">
          <h2 class="efz-page-title">Započni prijavu</h2>
          <div class="efz-actions">
            <button type="button" class="efz-btn" id="efz-btn-cancel">Odustani</button>
            <button type="button" class="efz-btn" id="efz-btn-save-later">Spremi za kasnije</button>
            <button type="button" class="efz-btn efz-btn--primary" id="efz-btn-submit" disabled>Podnesi prijavu</button>
          </div>
        </div>
      </div>

      <div class="efz-content">
        <div class="efz-wizard">
          <ol class="efz-steps">
            <li>
              <button type="button" class="efz-step" data-step="1" ${this.currentStep === 1 ? 'aria-current="step"' : ''}>
                <span class="efz-step-num">1</span>
                <span>Prijavitelj</span>
              </button>
            </li>
            <li>
              <button type="button" class="efz-step" data-step="2" ${this.currentStep === 2 ? 'aria-current="step"' : ''}>
                <span class="efz-step-num">2</span>
                <span>Dokumentacija</span>
              </button>
            </li>
            <li>
              <button type="button" class="efz-step" data-step="3" ${this.currentStep === 3 ? 'aria-current="step"' : ''}>
                <span class="efz-step-num">3</span>
                <span>Investicija</span>
              </button>
            </li>
          </ol>

          <div class="efz-panel" id="efz-panel-body">
            <!-- Dinamički render koraka -->
          </div>
        </div>
      </div>
    `;

    this._bindHeaderActions();
    this._renderStepBody();
    this._checkSubmissionReadiness();
  }

  _bindHeaderActions() {
    // Navigacija kroz korake putem gornjih tabova
    this.container.querySelectorAll(".efz-step").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetStep = parseInt(btn.dataset.step, 10);
        this.goToStep(targetStep);
      });
    });

    // Odustani
    const btnCancel = this.container.querySelector("#efz-btn-cancel");
    btnCancel.addEventListener("click", async () => {
      const confirmed = await this.options.showModal(
        "Sve nespremljene promjene će biti izgubljene.",
        "Jeste li sigurni da želite odustati?",
        "warn",
        { confirm: "Da, odustani" } // Uputa, Slika 18
      );
      if (confirmed) {
        this.options.onAbort("Odustali ste od izrade prijave (klik na 'Odustani').");
      }
    });

    // Spremi za kasnije
    const btnSave = this.container.querySelector("#efz-btn-save-later");
    btnSave.addEventListener("click", () => {
      this.options.onAbort("Prekinuli ste utrku odabirom 'Spremi za kasnije'.");
    });

    // Podnesi prijavu
    const btnSubmit = this.container.querySelector("#efz-btn-submit");
    btnSubmit.addEventListener("click", async () => {
      if (btnSubmit.disabled) return;

      const confirmed = await this.options.showModal(
        "Nakon podnošenja, izmjene prijave više nisu moguće.",
        "Jeste li sigurni da želite podnijeti prijavu?",
        "warn",
        { confirm: "Da, podnesi prijavu" } // Uputa, Slika 44
      );

      if (confirmed) {
        this.options.onSubmit({
          formData: { ...this.formData },
          files: { ...this.uploadedFiles },
          inOwnName: this.inOwnName,
          oibValue: this.oibValue
        });
      }
    });
  }

  async goToStep(step) {
    if (step === this.currentStep) return;

    // Uvjet iz upute (Slika 25): OIB mora biti potvrđen prije promjene koraka!
    if (!this.oibConfirmed) {
      await this.options.showModal(
        "Molimo potvrdite OIB prije promjene koraka.",
        "Obavezna potvrda OIB-a",
        "info"
      );
      return;
    }

    // Validacija koraka 1 prije prelaska
    if (this.currentStep === 1 && step > 1) {
      if (!this._validateStep1()) {
        return;
      }
    }

    this.currentStep = step;

    // Ažuriraj oznaku koraka
    this.container.querySelectorAll(".efz-step").forEach((btn) => {
      const s = parseInt(btn.dataset.step, 10);
      if (s === this.currentStep) {
        btn.setAttribute("aria-current", "step");
      } else {
        btn.removeAttribute("aria-current");
      }
    });

    this._renderStepBody();
    this._checkSubmissionReadiness();
  }

  _renderStepBody() {
    const panel = this.container.querySelector("#efz-panel-body");
    if (!panel) return;

    if (this.currentStep === 1) {
      this._renderStep1(panel);
    } else if (this.currentStep === 2) {
      this._renderStep2(panel);
    } else if (this.currentStep === 3) {
      this._renderStep3(panel);
    }
  }

  /* ---------------------------------------------------------------- KORAK 1 */
  _renderStep1(panel) {
    // Generiramo nasumične sufikse za polja da spriječimo Chrome/Safari autofill
    const rId = Math.random().toString(36).substring(2, 7);

    panel.innerHTML = `
      <h3 class="efz-section-title">
        <span class="efz-section-ico">
          <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
        </span>
        Prijavitelj
      </h3>

      <fieldset class="efz-fieldset" id="sec-subject-type">
        <legend class="req">Označite u čije ime podnosite prijavu:</legend>
        <label class="efz-radio">
          <input type="radio" name="subject_type" id="sub-own" value="own" ${this.inOwnName === true ? "checked" : ""} ${this.oibConfirmed ? "disabled" : ""}>
          <span>Podnosim prijavu u svoje ime.</span>
        </label>
        <label class="efz-radio">
          <input type="radio" name="subject_type" id="sub-other" value="other" ${this.inOwnName === false ? "checked" : ""} ${this.oibConfirmed ? "disabled" : ""}>
          <span>Ne podnosim prijavu u svoje ime.</span>
        </label>
        <div class="efz-err" id="err-subject-type"></div>
      </fieldset>

      <div class="efz-field" id="sec-oib-field" ${this.inOwnName !== null ? "" : 'style="display:none;"'}>
        <label class="efz-label req" for="f-oib-${rId}">OIB</label>
        <div class="efz-oib-row">
          <input
            type="text"
            id="f-oib-${rId}"
            class="efz-input"
            maxlength="11"
            value="${this.oibValue}"
            ${(this.inOwnName === true || this.oibConfirmed) ? "readonly" : ""}
            ${this.oibConfirmed ? "disabled" : ""}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            data-form-key="oib"
            placeholder="Unesite podatak 'OIB'"
          >
          <button type="button" class="efz-btn efz-btn--primary" id="btn-confirm-oib" ${this.oibConfirmed ? "disabled" : ""}>Potvrdi</button>
        </div>
        <div class="efz-err" id="err-oib"></div>
      </div>

      <div class="efz-applicant" id="sec-applicant-data" ${this.oibConfirmed ? "" : 'style="display:none;"'}>
        <h4 class="efz-col-title">Osnovni podatci</h4>
        <h4 class="efz-col-title efz-col-title--contact">Kontakt podatci</h4>

        <div class="efz-basic">
          <div class="efz-field">
            <span class="efz-label req">Naziv/Ime i prezime</span>
            <input type="text" class="efz-input" value="${(this.options && this.options.profile && this.options.profile.name) || this.formData.name || 'IVAN HORVAT'}" readonly tabindex="-1">
          </div>
          <div class="efz-field">
            <span class="efz-label req">Ulica i kućni broj prebivališta</span>
            <input type="text" class="efz-input" value="ILICA 1" readonly tabindex="-1">
          </div>
          <div class="efz-field">
            <span class="efz-label req">Mjesto/Naselje prebivališta</span>
            <input type="text" class="efz-input" value="ZAGREB" readonly tabindex="-1">
          </div>
          <div class="efz-field">
            <span class="efz-label req">Poštanski broj prebivališta</span>
            <input type="text" class="efz-input" value="10000" readonly tabindex="-1">
          </div>
          <div class="efz-field">
            <span class="efz-label req">Općina/Grad prebivališta</span>
            <input type="text" class="efz-input" value="ZAGREB" readonly tabindex="-1">
          </div>
        </div>

        <div class="efz-contact">
          <div class="efz-field">
            <label class="efz-label req" for="f-name-${rId}">Ime i prezime</label>
            <input
              type="text"
              id="f-name-${rId}"
              class="efz-input"
              placeholder="Unesite podatak 'Ime i prezime'"
              value="${this.formData.name}"
              autocomplete="new-password"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              data-form-key="name"
            >
            <div class="efz-err" id="err-name"></div>
          </div>

          <div class="efz-field">
            <label class="efz-label req" for="f-phone-${rId}">Kontakt broj</label>
            <input
              type="text"
              id="f-phone-${rId}"
              class="efz-input"
              placeholder="Unesite podatak 'Kontakt broj'"
              value="${this.formData.phone}"
              inputmode="numeric"
              autocomplete="new-password"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              data-form-key="phone"
            >
            <div class="efz-err" id="err-phone"></div>
          </div>

          <div class="efz-field">
            <label class="efz-label req" for="f-email-${rId}">E-mail</label>
            <input
              type="text"
              id="f-email-${rId}"
              class="efz-input"
              placeholder="Unesite podatak 'E-mail'"
              value="${this.formData.email}"
              inputmode="email"
              autocomplete="new-password"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              data-form-key="email"
            >
            <div class="efz-err" id="err-email"></div>
          </div>
        </div>
      </div>

      <fieldset class="efz-fieldset efz-category" id="sec-category" ${this.oibConfirmed ? "" : 'style="display:none;"'}>
        <legend class="req">Kategorija vozila</legend>
        ${[
          ["L1", "L1 - moped na dva kotača"],
          ["L2", "L2 - moped na tri kotača"],
          ["L3", "L3 - motocikl"],
          ["L4", "L4 - motocikl s bočnom prikolicom"],
          ["L5", "L5 - motorni tricikl"],
          ["L6", "L6 - laki četverocikl"],
          ["L7", "L7 - teški četverocikl"],
          ["M1", "M1 - osobni automobil"]
        ].map(([val, label]) => `
          <label class="efz-radio">
            <input type="radio" name="veh_cat" value="${val}" ${this.formData.category === val ? "checked" : ""}>
            <span>${label}</span>
          </label>
        `).join("")}
        <div class="efz-err" id="err-category"></div>
      </fieldset>

      <p class="efz-req-note"><span class="star">*</span> Polja označena zvjezdicom su obavezna za sve prijavitelje.</p>

      <div class="efz-panel-foot">
        <button type="button" class="efz-btn efz-btn--primary" id="btn-next-step1">Nastavi</button>
      </div>
    `;

    // Događaji za promjenu vrste subjekta
    const subOwn = panel.querySelector("#sub-own");
    const subOther = panel.querySelector("#sub-other");
    const oibInput = panel.querySelector(`[data-form-key="oib"]`);
    const btnConfirmOib = panel.querySelector("#btn-confirm-oib");

    if (subOwn) {
      subOwn.addEventListener("change", () => {
        if (this.oibConfirmed) return; // Nema promjene nakon potvrde
        this.inOwnName = true;
        // Ako je korisnik zadao OIB na početnoj stranici, preuzmi taj OIB (inače podrazumijevani 11805144057)
        const profileOib = (this.options && this.options.profile && this.options.profile.oib) ? this.options.profile.oib.trim() : "";
        this.oibValue = profileOib || "11805144057";
        this.oibConfirmed = false; // Mora kliknuti Potvrdi
        const errSub = panel.querySelector("#err-subject-type");
        if (errSub) errSub.textContent = "";
        this._renderStepBody();
      });
    }

    if (subOther) {
      subOther.addEventListener("change", () => {
        if (this.oibConfirmed) return; // Nema promjene nakon potvrde
        this.inOwnName = false;
        this.oibValue = "";
        this.oibConfirmed = false;
        const errSub = panel.querySelector("#err-subject-type");
        if (errSub) errSub.textContent = "";
        this._renderStepBody();
      });
    }

    if (oibInput) {
      oibInput.addEventListener("input", (e) => {
        this.oibValue = e.target.value.trim();
        if (this.oibValue.length === 11 && /^\d+$/.test(this.oibValue)) {
          oibInput.classList.remove("is-invalid");
          const errEl = panel.querySelector("#err-oib");
          if (errEl) errEl.textContent = "";
        }
      });
    }

    if (btnConfirmOib) {
      btnConfirmOib.addEventListener("click", () => {
        if (this.oibConfirmed) return;
        const val = oibInput ? oibInput.value.trim() : "";
        const errEl = panel.querySelector("#err-oib");
        if (!val || val.length !== 11 || !/^\d+$/.test(val)) {
          if (errEl) errEl.textContent = "Polje 'OIB' mora sadržavati točno 11 znamenki.";
          if (oibInput) oibInput.classList.add("is-invalid");
          return;
        }

        // Čim korisnik klikne Potvrdi na OIB, provjeri je li ispravno označen radio gumb vrste podnošenja:
        if (this.options && this.options.profile) {
          const expectedSubType = this.options.profile.subType || "own";
          const actualSubType = this.inOwnName === true ? "own" : (this.inOwnName === false ? "other" : null);

          if (actualSubType !== expectedSubType) {
            const reason = expectedSubType === "own"
              ? "Pogrešan odabir podnošenja prijave: na početnoj stranici zadano je podnošenje u svoje ime, a u prijavnici ste označili da ne podnosite u svoje ime (uz punomoć)."
              : "Pogrešan odabir podnošenja prijave: na početnoj stranici zadano je podnošenje uz punomoć, a u prijavnici ste označili podnošenje u svoje ime.";
            this.options.onAbort(reason);
            return;
          }

          if (this.options.profile.oib) {
            const expectedOib = this.options.profile.oib.trim();
            if (val !== expectedOib) {
              this.options.onAbort(`Potvrđeni OIB ("${val}") se ne podudara sa zadanim OIB-om u profilu ("${expectedOib}").`);
              return;
            }
          }
        }

        if (errEl) errEl.textContent = "";
        if (oibInput) oibInput.classList.remove("is-invalid");
        this.oibValue = val;
        this.oibConfirmed = true; // ZAKLJUČANO: nema više povratka
        this._renderStepBody();
      });
    }

    // Input handlers
    const nameInput = panel.querySelector(`[data-form-key="name"]`);
    const phoneInput = panel.querySelector(`[data-form-key="phone"]`);
    const emailInput = panel.querySelector(`[data-form-key="email"]`);

    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        this.formData.name = e.target.value;
        if (this.formData.name.trim()) {
          nameInput.classList.remove("is-invalid");
          const errEl = panel.querySelector("#err-name");
          if (errEl) errEl.textContent = "";
        }
        this._checkSubmissionReadiness();
      });
    }

    if (phoneInput) {
      phoneInput.addEventListener("input", (e) => {
        this.formData.phone = e.target.value;
        if (this.formData.phone.trim()) {
          phoneInput.classList.remove("is-invalid");
          const errEl = panel.querySelector("#err-phone");
          if (errEl) errEl.textContent = "";
        }
        this._checkSubmissionReadiness();
      });
    }

    if (emailInput) {
      emailInput.addEventListener("input", (e) => {
        this.formData.email = e.target.value;
        if (this.formData.email.trim()) {
          emailInput.classList.remove("is-invalid");
          const errEl = panel.querySelector("#err-email");
          if (errEl) errEl.textContent = "";
        }
        this._checkSubmissionReadiness();
      });
    }

    panel.querySelectorAll(`input[name="veh_cat"]`).forEach((r) => {
      r.addEventListener("change", (e) => {
        this.formData.category = e.target.value;
        const errEl = panel.querySelector("#err-category");
        if (errEl) errEl.textContent = "";
        this._checkSubmissionReadiness();
      });
    });

    // Gumb "Nastavi"
    const btnNext = panel.querySelector("#btn-next-step1");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        if (this._validateStep1()) {
          this.goToStep(2);
        }
      });
    }
  }

  _validateStep1() {
    let valid = true;
    const panel = this.container.querySelector("#efz-panel-body");
    if (!panel) return true;

    if (this.inOwnName === null) {
      const errSub = panel.querySelector("#err-subject-type");
      if (errSub) errSub.textContent = "Obavezno označite u čije ime podnosite prijavu.";
      return false;
    }

    if (!this.oibConfirmed) {
      this.options.showModal(
        "Molimo potvrdite OIB prije promjene koraka.",
        "Obavezna potvrda OIB-a",
        "info"
      );
      return false;
    }

    const nameInput = panel.querySelector(`[data-form-key="name"]`);
    const phoneInput = panel.querySelector(`[data-form-key="phone"]`);
    const emailInput = panel.querySelector(`[data-form-key="email"]`);

    const errName = panel.querySelector("#err-name");
    const errPhone = panel.querySelector("#err-phone");
    const errEmail = panel.querySelector("#err-email");
    const errCat = panel.querySelector("#err-category");

    if (!this.formData.name || !this.formData.name.trim()) {
      valid = false;
      if (nameInput) nameInput.classList.add("is-invalid");
      if (errName) errName.textContent = "Polje 'Ime i prezime' je obvezno.";
    } else {
      if (nameInput) nameInput.classList.remove("is-invalid");
      if (errName) errName.textContent = "";
    }

    if (!this.formData.phone || !this.formData.phone.trim()) {
      valid = false;
      if (phoneInput) phoneInput.classList.add("is-invalid");
      if (errPhone) errPhone.textContent = "Polje 'Kontakt broj' je obvezno.\nMoguće je unijeti samo brojeve bez razmaka.";
    } else if (!/^\d+$/.test(this.formData.phone.trim())) {
      valid = false;
      if (phoneInput) phoneInput.classList.add("is-invalid");
      if (errPhone) errPhone.textContent = "Moguće je unijeti samo brojeve bez razmaka.";
    } else {
      if (phoneInput) phoneInput.classList.remove("is-invalid");
      if (errPhone) errPhone.textContent = "";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.formData.email || !this.formData.email.trim()) {
      valid = false;
      if (emailInput) emailInput.classList.add("is-invalid");
      if (errEmail) errEmail.textContent = "Polje 'E-mail' je obvezno.";
    } else if (!emailRegex.test(this.formData.email.trim())) {
      valid = false;
      if (emailInput) emailInput.classList.add("is-invalid");
      if (errEmail) errEmail.textContent = "Uneseni format e-mail adrese nije ispravan.";
    } else {
      if (emailInput) emailInput.classList.remove("is-invalid");
      if (errEmail) errEmail.textContent = "";
    }

    if (!this.formData.category) {
      valid = false;
      if (errCat) errCat.textContent = "Obavezno odaberite kategoriju vozila.";
    } else {
      if (errCat) errCat.textContent = "";
    }

    return valid;
  }

  /* ---------------------------------------------------------------- KORAK 2 */
  _renderStep2(panel) {
    const docs = [
      {
        key: "form",
        label: "Prijavni obrazac (Prilog 1. Poziva)",
        tip: "Za Prijavni obrazac obavezni je format .xls/.xlsx",
        accept: ".xls,.xlsx",
        isExcel: true
      },
      {
        key: "residence",
        label: "Uvjerenje o prebivalištu prijavitelja",
        tip: "Napomena: ne starije od 30 dana od dana podnošenja prijave na Poziv (obavezni format: PDF).",
        accept: ".pdf",
        isExcel: false
      },
      {
        key: "statement",
        label: "Izjava prijavitelja pod materijalnom i kaznenom odgovornošću, potpisana od strane prijavitelja (Prilog 2. Poziva)",
        tip: "Potpisana izjava prijavitelja (obavezni format: PDF).",
        accept: ".pdf",
        isExcel: false
      },
      {
        key: "offer",
        label: "Informativna ponuda za kupnju vozila",
        tip: "Informativna ponuda izdana od strane ovlaštenog prodajnog mjesta (obavezni format: PDF).",
        accept: ".pdf",
        isExcel: false
      }
    ];

    if (!this.inOwnName) {
      docs.push({
        key: "powerOfAtty",
        label: "Specijalna punomoć (primjer obveznog sadržaja je u Prilogu 3. Poziva)",
        tip: "Napomena: potrebno je učitati specijalnu punomoć ovjerenu od strane javnog bilježnika ili izdanu odvjetniku.",
        accept: ".pdf",
        isExcel: false
      });
    }

    panel.innerHTML = `
      <h3 class="efz-section-title">
        <span class="efz-section-ico">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 2v6h6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
        </span>
        Dokumentacija
      </h3>

      <div class="efz-docs-header-bar">
        <p class="efz-docs-intro req">Obvezna dokumentacija za sve prijavitelje</p>
        <div class="efz-docs-quick-tools">
          <button type="button" class="efz-quick-btn" id="btn-quick-upload-all" title="Učitaj sve ispravne ogledne dokumente odjednom (za brzi trening)">
            ⚡ Učitaj sve ogledne dokumente (brzi trening)
          </button>
        </div>
      </div>

      <table class="efz-docs">
        <tbody>
          ${docs.map((doc) => {
            const file = this.uploadedFiles[doc.key];
            return `
              <tr data-doc-row="${doc.key}">
                <td class="efz-doc-label">
                  <span class="req">${doc.label}</span>
                </td>
                <td class="efz-doc-info">
                  <span class="efz-tip">
                    <button type="button" class="efz-tip-btn" aria-label="Informacija o dokumentu">i</button>
                    <span class="efz-tip-text">${doc.tip}</span>
                  </span>
                </td>
                <td class="efz-doc-upload">
                  <input
                    type="file"
                    id="file-input-${doc.key}"
                    accept="${doc.accept}"
                    style="display:none;"
                    data-doc-input="${doc.key}"
                  >
                  <div class="efz-doc-btn-group">
                    <button type="button" class="efz-upload-btn" data-doc-btn="${doc.key}">
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                        <path d="M8 2a.5.5 0 0 1 .5.5v7.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V2.5A.5.5 0 0 1 8 2z"/>
                        <path d="M3 13.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/>
                      </svg>
                      <span>Učitaj dokument</span>
                    </button>
                    <button type="button" class="efz-sample-btn" data-doc-sample="${doc.key}" title="Učitaj oglednu ispravnu datoteku za ovaj redak">
                      ⚡ Ogledna
                    </button>
                  </div>

                  <ul class="efz-files" id="file-list-${doc.key}">
                    ${file ? this._renderFileItem(doc.key, file) : ""}
                  </ul>
                  <span class="efz-doc-err" id="doc-err-${doc.key}"></span>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>

      <div class="efz-tests-bar">
        <span class="efz-tests-title">🧪 Testovi grešaka (PDF pravila):</span>
        <button type="button" class="efz-test-pill" data-tc="empty" title="Prazna datoteka od 0 bajtova (Slika 36)">0 B prazna</button>
        <button type="button" class="efz-test-pill" data-tc="diacritics" title="Nedozvoljeni dijakritici i razmaci (Slika 37)">č/ć i razmaci</button>
        <button type="button" class="efz-test-pill" data-tc="wrong_ext" title="Za Prijavni obrazac mora biti .xls/.xlsx (Slika 34)">Krivi format (.pdf u obrazac)</button>
        <button type="button" class="efz-test-pill" data-tc="non_pdf" title="Za ostale dokumente mora biti .pdf (npr. .png ili .docx)">Krivi format (nije .pdf)</button>
        <button type="button" class="efz-test-pill" data-tc="duplicate" title="Datoteka s istim imenom već postoji (Slika 35)">Duplikat naziva</button>
        <button type="button" class="efz-test-pill" data-tc="oversized" title="Ukupna veličina prelazi 100 MB (Slika 39)">Prevelika (>100MB)</button>
      </div>

      <div class="efz-docs-notes">
        <p class="warn-line">Prije podnošenja prijave provjerite usklađenost s Javnim pozivom!</p>
        <p><span class="star">*</span> Polja označena zvjezdicom su obvezna za sve prijavitelje.</p>
        <p>Ukupna veličina svih dokumenata ne smije prijeći 100 MB.</p>
        <p class="muted">NAPOMENA: Promjene nad dokumentima (učitavanje, brisanje, dodavanje) se spremaju automatski bez potrebe za dodatnim spremanjem.</p>
      </div>

      <div class="efz-panel-foot">
        <button type="button" class="efz-btn" id="btn-prev-step2">Povratak</button>
        <button type="button" class="efz-btn efz-btn--primary" id="btn-next-step2">Nastavi</button>
      </div>
    `;

    // Quick upload all
    const btnQuickAll = panel.querySelector("#btn-quick-upload-all");
    if (btnQuickAll) {
      btnQuickAll.addEventListener("click", async () => {
        btnQuickAll.disabled = true;
        for (const doc of docs) {
          if (SAMPLE_DOCS[doc.key]) {
            await this._handleFileUpload(doc, SAMPLE_DOCS[doc.key]);
          }
        }
        btnQuickAll.disabled = false;
      });
    }

    // Upload handlers
    docs.forEach((doc) => {
      const btn = panel.querySelector(`[data-doc-btn="${doc.key}"]`);
      const sampleBtn = panel.querySelector(`[data-doc-sample="${doc.key}"]`);
      const fileInput = panel.querySelector(`[data-doc-input="${doc.key}"]`);

      btn.addEventListener("click", () => fileInput.click());

      if (sampleBtn) {
        sampleBtn.addEventListener("click", async () => {
          if (SAMPLE_DOCS[doc.key]) {
            await this._handleFileUpload(doc, SAMPLE_DOCS[doc.key]);
          }
        });
      }

      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        await this._handleFileUpload(doc, file);
        fileInput.value = ""; // Omogući ponovno biranje iste datoteke ako zatreba
      });

      // Drag & drop
      btn.addEventListener("dragover", (e) => {
        e.preventDefault();
        btn.classList.add("is-dragover");
      });
      btn.addEventListener("dragleave", () => {
        btn.classList.remove("is-dragover");
      });
      btn.addEventListener("drop", async (e) => {
        e.preventDefault();
        btn.classList.remove("is-dragover");
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
          await this._handleFileUpload(doc, file);
        }
      });
    });

    // Test cases for system errors
    panel.querySelectorAll("[data-tc]").forEach((tcBtn) => {
      tcBtn.addEventListener("click", async () => {
        const tc = tcBtn.dataset.tc;
        if (tc === "empty") {
          await this._handleFileUpload(docs[0], {
            name: "Prijavni_obrazac.xlsx",
            size: 0,
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          });
        } else if (tc === "diacritics") {
          await this._handleFileUpload(docs[1] || docs[0], {
            name: "Uvjerenje o prebivalištu (novo)!.pdf",
            size: 45000,
            type: "application/pdf"
          });
        } else if (tc === "wrong_ext") {
          await this._handleFileUpload(docs[0], {
            name: "Prijavni_obrazac_krivi_format.pdf",
            size: 45000,
            type: "application/pdf"
          });
        } else if (tc === "non_pdf") {
          await this._handleFileUpload(docs[1] || docs[0], {
            name: "Uvjerenje_o_prebivalistu_slika.png",
            size: 45000,
            type: "image/png"
          });
        } else if (tc === "duplicate") {
          const firstKey = docs[0].key;
          const secondDoc = docs[1];
          if (secondDoc) {
            await this._handleFileUpload(docs[0], SAMPLE_DOCS[firstKey]);
            await this._handleFileUpload(secondDoc, {
              name: SAMPLE_DOCS[firstKey].name,
              size: 50000,
              type: "application/pdf"
            });
          }
        } else if (tc === "oversized") {
          await this._handleFileUpload(docs[0], {
            name: "Preveliki_dokument_scan.xlsx",
            size: 105 * 1024 * 1024,
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          });
        }
      });
    });

    // Delete handlers
    panel.addEventListener("click", (e) => {
      const delBtn = e.target.closest("[data-doc-del]");
      if (delBtn) {
        const key = delBtn.dataset.docDel;
        this.uploadedFiles[key] = null;
        const list = panel.querySelector(`#file-list-${key}`);
        if (list) list.innerHTML = "";
        this._checkSubmissionReadiness();
      }
    });

    panel.querySelector("#btn-prev-step2").addEventListener("click", () => this.goToStep(1));
    panel.querySelector("#btn-next-step2").addEventListener("click", () => {
      if (this._validateStep2()) {
        this.goToStep(3);
      }
    });
  }

  _renderFileItem(key, file) {
    return `
      <li>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
          <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z"/>
        </svg>
        <span class="name" title="${file.name}">${file.name}</span>
        <button type="button" class="efz-del" data-doc-del="${key}" aria-label="Obriši dokument">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </li>
    `;
  }

  async _handleFileUpload(doc, file) {
    // 1. Prazna datoteka (Slika 36)
    if (file.size === 0) {
      await this.options.showModal(
        "Datoteka je prazna.",
        "Greška prilikom učitavanja datoteke",
        "error"
      );
      return;
    }

    // 2. Format datoteka: Prijavni obrazac mora biti .xls/.xlsx, svi ostali dokumenti moraju biti .pdf
    const lowerName = file.name.toLowerCase();
    if (doc.isExcel) {
      if (!lowerName.endsWith(".xls") && !lowerName.endsWith(".xlsx")) {
        await this.options.showModal(
          "Za Prijavni obrazac obavezni je format .xls/.xlsx.",
          "Dogodila se greška",
          "error"
        );
        return;
      }
    } else {
      if (!lowerName.endsWith(".pdf")) {
        await this.options.showModal(
          "Dokument mora biti u PDF formatu (.pdf).",
          "Neispravan format datoteke",
          "error"
        );
        return;
      }
    }

    // 3. Dozvoljeni znakovi u nazivu datoteke (PDF p. 16):
    // "U nazivima datoteka dozvoljeni su: slova bez dijakritičkih znakova, brojevi, točka, minus i donja crta.
    // U nazivima dokumenata u pdf-u treba pripaziti da između riječi ima najviše jedan razmak."
    // Npr. neispravno: č, ć, ž, š, đ, *, /, !, dva uzastopna razmaka
    const hasMultipleSpaces = /\s{2,}/.test(file.name);
    const hasDiacriticsOrIllegal = /[^a-zA-Z0-9.\-_ ]/.test(file.name);

    if (hasMultipleSpaces || hasDiacriticsOrIllegal) {
      await this.options.showModal(
        "U nazivima datoteka dozvoljeni su samo slova bez dijakritičkih znakova (bez č, ć, ž, š, đ), brojevi, točka, minus i donja crta. Između riječi smije biti najviše jedan razmak.\n\nPrimjer neispravnog: Uvjerenje/o*prebivalištu!\nPrimjer ispravnog: Uvjerenje_o_prebivalistu.pdf",
        "Neispravan naziv datoteke",
        "error"
      );
      return;
    }

    // 4. Provjera duplikata imena među već učitanim datotekama (Slika 35)
    for (const [k, existing] of Object.entries(this.uploadedFiles)) {
      if (k !== doc.key && existing && existing.name.toLowerCase() === file.name.toLowerCase()) {
        await this.options.showModal(
          "Datoteka s istim imenom već postoji. Molimo preimenujte datoteku i pokušajte ponovno.",
          "Dogodila se greška",
          "error"
        );
        return;
      }
    }

    // 5. Provjera ukupne veličine <= 100 MB (Slika 39)
    let totalSize = file.size;
    for (const [k, existing] of Object.entries(this.uploadedFiles)) {
      if (k !== doc.key && existing) {
        totalSize += existing.size;
      }
    }
    if (totalSize > 100 * 1024 * 1024) {
      await this.options.showModal(
        "Ukupna veličina datoteka prelazi 100 MB.",
        "Dogodila se greška",
        "error"
      );
      return;
    }

    // Simulirana kratka animacija učitavanja (180ms)
    const list = this.container.querySelector(`#file-list-${doc.key}`);
    if (list) {
      list.innerHTML = `
        <li class="is-uploading">
          <span class="name">Učitavanje: ${file.name}...</span>
          <div class="efz-file-progress"><i></i></div>
        </li>
      `;
      const bar = list.querySelector(".efz-file-progress i");
      if (bar) {
        bar.style.transition = "width 0.18s ease-out";
        requestAnimationFrame(() => {
          bar.style.width = "100%";
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    this.uploadedFiles[doc.key] = {
      name: file.name,
      size: file.size,
      type: file.type
    };

    if (list) {
      list.innerHTML = this._renderFileItem(doc.key, this.uploadedFiles[doc.key]);
    }

    const docErr = this.container.querySelector(`#doc-err-${doc.key}`);
    if (docErr) docErr.textContent = "";

    this._checkSubmissionReadiness();
  }

  _validateStep2() {
    let valid = true;
    const requiredDocs = ["form", "residence", "statement", "offer"];
    if (!this.inOwnName) requiredDocs.push("powerOfAtty");

    requiredDocs.forEach((k) => {
      const errEl = this.container.querySelector(`#doc-err-${k}`);
      if (!this.uploadedFiles[k]) {
        valid = false;
        if (errEl) errEl.textContent = "Obavezno učitajte ovaj dokument.";
      } else {
        if (errEl) errEl.textContent = "";
      }
    });

    return valid;
  }

  /* ---------------------------------------------------------------- KORAK 3 */
  _renderStep3(panel) {
    const rId = Math.random().toString(36).substring(2, 7);

    panel.innerHTML = `
      <h3 class="efz-section-title">
        <span class="efz-section-ico">
          <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14.5 9h-4a2 2 0 100 4h3a2 2 0 110 4h-4.5M12 7v2M12 17v2" stroke="currentColor" stroke-width="1.6"/></svg>
        </span>
        Investicija
      </h3>

      <div class="efz-field">
        <label class="efz-label req" for="f-price-${rId}">
          Cijena vozila s PDV-om
          <span class="efz-tip">
            <button type="button" class="efz-tip-btn" aria-label="Informacija">i</button>
            <span class="efz-tip-text">Prepisati iz prijavnog obrasca koji se učitava u kartici Dokumentacija</span>
          </span>
        </label>
        <input
          type="text"
          id="f-price-${rId}"
          class="efz-input efz-money"
          placeholder="0,00 EUR"
          value="${this.formData.price}"
          inputmode="decimal"
          autocomplete="new-password"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-form-key="price"
        >
        <div class="efz-err" id="err-price"></div>
      </div>

      <div class="efz-field">
        <label class="efz-label req" for="f-subsidy-${rId}">
          Tražena bespovratna sredstva
          <span class="efz-tip">
            <button type="button" class="efz-tip-btn" aria-label="Informacija">i</button>
            <span class="efz-tip-text">Prepisati iz prijavnog obrasca koji se učitava u kartici Dokumentacija</span>
          </span>
        </label>
        <input
          type="text"
          id="f-subsidy-${rId}"
          class="efz-input efz-money"
          placeholder="0,00 EUR"
          value="${this.formData.subsidy}"
          inputmode="decimal"
          autocomplete="new-password"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-form-key="subsidy"
        >
        <div class="efz-err" id="err-subsidy"></div>
      </div>

      <p class="efz-req-note"><span class="star">*</span> Polja označena zvjezdicom su obavezna za sve prijavitelje.</p>

      <div class="efz-panel-foot">
        <button type="button" class="efz-btn" id="btn-prev-step3">Povratak</button>
      </div>
    `;

    const priceInput = panel.querySelector(`[data-form-key="price"]`);
    const subsidyInput = panel.querySelector(`[data-form-key="subsidy"]`);

    priceInput.addEventListener("input", (e) => {
      this.formData.price = e.target.value;
      if (this.formData.price.trim()) {
        priceInput.classList.remove("is-invalid");
        panel.querySelector("#err-price").textContent = "";
      }
      this._checkSubmissionReadiness();
    });

    subsidyInput.addEventListener("input", (e) => {
      this.formData.subsidy = e.target.value;
      if (this.formData.subsidy.trim()) {
        subsidyInput.classList.remove("is-invalid");
        panel.querySelector("#err-subsidy").textContent = "";
      }
      this._checkSubmissionReadiness();
    });

    panel.querySelector("#btn-prev-step3").addEventListener("click", () => this.goToStep(2));
  }

  _isFormComplete() {
    // Korak 1
    if (!this.formData.name || !this.formData.name.trim()) return false;
    if (!this.formData.phone || !/^\d+$/.test(this.formData.phone.trim())) return false;
    if (!this.formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email.trim())) return false;
    if (!this.formData.category) return false;

    // Korak 2
    if (!this.uploadedFiles.form) return false;
    if (!this.uploadedFiles.residence) return false;
    if (!this.uploadedFiles.statement) return false;
    if (!this.uploadedFiles.offer) return false;
    if (!this.inOwnName && !this.uploadedFiles.powerOfAtty) return false;

    // Korak 3
    if (!this.formData.price || !this.formData.price.trim()) return false;
    if (!this.formData.subsidy || !this.formData.subsidy.trim()) return false;

    return true;
  }

  _checkSubmissionReadiness() {
    const isReady = this._isFormComplete();
    const btnSubmit = this.container.querySelector("#efz-btn-submit");

    if (btnSubmit) {
      btnSubmit.disabled = !isReady;
    }

    if (isReady && !this.submissionEnabledToastShown) {
      this.submissionEnabledToastShown = true;
      this.options.showToast("Podnošenje prijave omogućeno.", "info");
    }
  }
}
