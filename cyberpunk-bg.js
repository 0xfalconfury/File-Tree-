/* =========================================================
   cyberpunk-bg.js — Neon skyline + grid + horizon glow
   Adapted from the "cyberpunk city" pen. Renders behind UI.
   ========================================================= */

(function () {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    // Still show a static gradient fallback
    canvas.style.display = "block";
    return;
  }

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- Config ---------- */
  const config = {
    skyColor: "#0a0410",
    neonPink: "#ff2d95",
    neonPurple: "#a855f7",
    neonCyan: "#22d3ee",
    neonYellow: "#fbbf24",
    gridColor: "#ff2d95",
    horizonColor: "#ff2d95",
    starColor: "#ffffff",
    speed: 1.4,
    buildingDensity: 0.075, // per 100px of width
    farBuildingAlpha: 0.35,
    nearBuildingAlpha: 0.85,
  };

  /* ---------- State ---------- */
  let buildings = [];
  let stars = [];
  let gridOffset = 0;
  let horizonY = 0;
  let rafId = null;
  let lastTime = 0;
  let elapsed = 0;

  /* ---------- Starfield (upper sky) ---------- */
  function createStars() {
    stars = [];
    const count = Math.floor((width * height) / 14000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * (horizonY * 0.85),
        r: Math.random() * 1.4 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.001 + Math.random() * 0.002,
        hue: Math.random() < 0.15 ? 45 : 220, // occasional gold star
      });
    }
  }

  /* ---------- Buildings (2 rows: far + near) ---------- */
  function createBuildings() {
    buildings = [];
    const farCount = Math.max(8, Math.floor(width / 45));
    const nearCount = Math.max(6, Math.floor(width / 70));

    // Far row — dimmer, taller, behind
    for (let i = 0; i < farCount; i++) {
      const w = 24 + Math.random() * 30;
      const h = 40 + Math.random() * (horizonY * 0.55);
      buildings.push({
        x: (i / farCount) * width + (Math.random() - 0.5) * 20,
        w,
        h,
        row: "far",
        alpha: config.farBuildingAlpha * (0.6 + Math.random() * 0.4),
        hue: Math.random() < 0.3 ? "purple" : "pink",
        windows: generateWindows(w, h, 0.35),
        glow: Math.random() < 0.5,
      });
    }

    // Near row — brighter, shorter, in front
    for (let i = 0; i < nearCount; i++) {
      const w = 40 + Math.random() * 55;
      const h = 60 + Math.random() * (horizonY * 0.75);
      buildings.push({
        x: (i / nearCount) * width + (Math.random() - 0.5) * 30,
        w,
        h,
        row: "near",
        alpha: config.nearBuildingAlpha * (0.7 + Math.random() * 0.3),
        hue: Math.random() < 0.4 ? "purple" : "pink",
        windows: generateWindows(w, h, 0.55),
        glow: Math.random() < 0.6,
        antenna: Math.random() < 0.3,
      });
    }
  }

  function generateWindows(w, h, density) {
    const cols = Math.max(2, Math.floor(w / 9));
    const rows = Math.max(3, Math.floor(h / 12));
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < density) {
          out.push({
            x: 3 + c * (w / cols),
            y: 6 + r * (h / rows),
            w: Math.max(2, w / cols - 3),
            h: Math.max(2, h / rows - 4),
            flicker: Math.random() < 0.15,
            phase: Math.random() * Math.PI * 2,
            hue: Math.random() < 0.2 ? 45 : Math.random() < 0.5 ? 300 : 190,
          });
        }
      }
    }
    return out;
  }

  /* ---------- Layout ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    horizonY = height * 0.62; // where buildings meet the grid
    createStars();
    createBuildings();
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 180);
  });

  /* ---------- Drawing ---------- */
  function drawSky(t) {
    // Deep gradient sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, "#05020c");
    sky.addColorStop(0.5, "#0d0620");
    sky.addColorStop(0.85, "#1a0630");
    sky.addColorStop(1, "#2a0848");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizonY);

    // Stars
    for (const s of stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * s.twinkleSpeed + s.twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${s.hue}, 90%, 88%, ${(tw * 0.85).toFixed(3)})`;
      ctx.fill();
    }

    // Horizon glow — pink→purple
    const glow = ctx.createRadialGradient(
      width / 2, horizonY, 0,
      width / 2, horizonY, width * 0.65
    );
    glow.addColorStop(0, "rgba(255, 45, 149, 0.55)");
    glow.addColorStop(0.35, "rgba(168, 85, 247, 0.22)");
    glow.addColorStop(1, "rgba(168, 85, 247, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizonY - height * 0.3, width, height * 0.35);
  }

  function drawBuildings(t) {
    // Draw far row first (dim)
    const sorted = buildings.slice().sort((a, b) => {
      if (a.row === b.row) return a.h - b.h;
      return a.row === "far" ? -1 : 1;
    });

    for (const b of sorted) {
      const baseColor =
        b.hue === "purple" ? "168, 85, 247" : "255, 45, 149";
      const topY = horizonY - b.h;

      // Building silhouette (dark with hue tint)
      ctx.fillStyle = `rgba(10, 4, 20, ${b.alpha * 0.9})`;
      ctx.fillRect(b.x, topY, b.w, b.h);

      // Neon edge on top + sides
      ctx.strokeStyle = `rgba(${baseColor}, ${b.alpha * 0.8})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 0.5, topY + 0.5, b.w - 1, b.h - 1);

      // Windows
      for (const win of b.windows) {
        let wAlpha = b.alpha * 0.9;
        if (win.flicker) {
          wAlpha *= 0.4 + 0.6 * Math.abs(Math.sin(t * 0.003 + win.phase));
        }
        ctx.fillStyle = `hsla(${win.hue}, 100%, 70%, ${wAlpha.toFixed(3)})`;
        ctx.fillRect(b.x + win.x, topY + win.y, win.w, win.h);
      }

      // Antenna
      if (b.antenna) {
        ctx.strokeStyle = `rgba(${baseColor}, ${b.alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2, topY);
        ctx.lineTo(b.x + b.w / 2, topY - 18);
        ctx.stroke();

        // Blinking red light on top
        const blink = 0.5 + 0.5 * Math.sin(t * 0.005);
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, topY - 18, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 60, 60, ${blink.toFixed(3)})`;
        ctx.fill();
      }

      // Extra glow for near buildings
      if (b.row === "near" && b.glow) {
        const glowGrad = ctx.createRadialGradient(
          b.x + b.w / 2, topY + b.h * 0.4, 0,
          b.x + b.w / 2, topY + b.h * 0.4, b.w * 0.9
        );
        glowGrad.addColorStop(0, `rgba(${baseColor}, 0.08)`);
        glowGrad.addColorStop(1, `rgba(${baseColor}, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.fillRect(b.x - b.w, topY, b.w * 3, b.h * 1.5);
      }
    }
  }

  function drawGrid(t) {
    // Dark floor gradient
    const floor = ctx.createLinearGradient(0, horizonY, 0, height);
    floor.addColorStop(0, "#1a0630");
    floor.addColorStop(1, "#05020c");
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    const cx = width / 2;
    const vanishX = cx;

    // Vertical grid lines (perspective converging to horizon center)
    const gridSpacing = 80;
    const offset = (gridOffset * 40) % gridSpacing;

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(255, 45, 149, 0.55)";

    // Left side vertical lines
    for (let i = -20; i <= 20; i++) {
      const baseX = cx + i * gridSpacing - offset;
      const xAtHorizon = cx + (baseX - cx) * 0.05;
      ctx.beginPath();
      ctx.moveTo(xAtHorizon, horizonY);
      ctx.lineTo(baseX, height);
      ctx.stroke();
    }

    // Horizontal grid lines (perspective — closer together near horizon)
    ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
    const hLines = 14;
    for (let i = 0; i <= hLines; i++) {
      const p = i / hLines;
      // Ease so lines bunch up near horizon
      const eased = Math.pow(p, 2.2);
      const y = horizonY + eased * (height - horizonY) + (gridOffset * 8) % ((height - horizonY) / hLines);
      if (y > height) continue;
      const alpha = 0.15 + p * 0.5;
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Bright horizon line
    ctx.strokeStyle = "rgba(255, 45, 149, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();

    // Horizon bloom
    const bloom = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 30);
    bloom.addColorStop(0, "rgba(255, 45, 149, 0)");
    bloom.addColorStop(0.5, "rgba(255, 45, 149, 0.45)");
    bloom.addColorStop(1, "rgba(255, 45, 149, 0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, horizonY - 30, width, 60);
  }

  /* ---------- Loop ---------- */
  function render(now) {
    const dt = Math.min(50, now - lastTime);
    lastTime = now;
    elapsed += dt;
    const t = elapsed;

    // Scroll grid
    gridOffset += (config.speed * dt) / 100;

    ctx.clearRect(0, 0, width, height);
    drawSky(t);
    drawBuildings(t);
    drawGrid(t);

    rafId = requestAnimationFrame(render);
  }

  /* ---------- Visibility ---------- */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(render);
    }
  });

  /* ---------- Boot ---------- */
  resize();
  lastTime = performance.now();
  rafId = requestAnimationFrame(render);
})();