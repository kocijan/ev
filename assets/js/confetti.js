/* =========================================================================
   Lagana i brza animacija konfeta na HTML5 canvasu
   ========================================================================= */

export function triggerConfetti(canvasEl, durationMs = 4000) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");
  if (!ctx) return;

  const width = (canvasEl.width = window.innerWidth);
  const height = (canvasEl.height = window.innerHeight);

  const colors = [
    "#00f2a1", "#00c8ff", "#ffd13b", "#ff334b",
    "#a155ff", "#ffffff", "#4096ff", "#52c41a"
  ];

  const pieceCount = 180;
  const pieces = [];

  for (let i = 0; i < pieceCount; i++) {
    pieces.push({
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height * 0.45 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() * -16) - 4,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      shape: Math.random() > 0.4 ? "rect" : "circle",
      alpha: 1
    });
  }

  const startTime = performance.now();
  let animId;

  function render(now) {
    const elapsed = now - startTime;
    const progress = elapsed / durationMs;

    ctx.clearRect(0, 0, width, height);

    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38; // gravitacija
      p.vx *= 0.985;
      p.rotation += p.rotationSpeed;

      if (progress > 0.7) {
        p.alpha = Math.max(0, 1 - (progress - 0.7) / 0.3);
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;

      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (elapsed < durationMs) {
      animId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, width, height);
      cancelAnimationFrame(animId);
    }
  }

  animId = requestAnimationFrame(render);
}
