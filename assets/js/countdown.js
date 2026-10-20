/* =========================================================================
   Odbrojavanje do službenog otvaranja poziva
   28. listopada 2026. u 09:00 Zagreb (CET, UTC+1)
   ========================================================================= */

export const TARGET_DATE = new Date("2026-10-28T09:00:00+01:00");

function pluralizeDays(d) {
  const mod10 = d % 10;
  const mod100 = d % 100;
  if (mod10 === 1 && mod100 !== 11) return "dan";
  return "dana";
}

export function initCountdown({
  daysEl,
  hoursEl,
  minsEl,
  secsEl,
  daysLabelEl,
  openMsgEl,
  clockEl
}) {
  function tick() {
    const now = new Date();
    const diff = TARGET_DATE.getTime() - now.getTime();

    if (clockEl) {
      try {
        clockEl.textContent = now.toLocaleTimeString("hr-HR", {
          timeZone: "Europe/Zagreb",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
      } catch {
        clockEl.textContent = now.toLocaleTimeString("hr-HR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
      }
    }

    if (diff <= 0) {
      if (daysEl) daysEl.textContent = "0";
      if (hoursEl) hoursEl.textContent = "00";
      if (minsEl) minsEl.textContent = "00";
      if (secsEl) secsEl.textContent = "00";
      if (openMsgEl) openMsgEl.hidden = false;
      return;
    }

    if (openMsgEl) openMsgEl.hidden = true;

    const totalSecs = Math.floor(diff / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    if (daysEl) daysEl.textContent = String(days);
    if (daysLabelEl) daysLabelEl.textContent = pluralizeDays(days);
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, "0");
    if (minsEl) minsEl.textContent = String(minutes).padStart(2, "0");
    if (secsEl) secsEl.textContent = String(seconds).padStart(2, "0");
  }

  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}
