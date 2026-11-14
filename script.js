/* =========================================================
   script.js — Tree parser + command generators + copy
   behaviour + cursor glow tracking.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Cursor glow follow ---------- */
  const cursorGlow = document.querySelector(".cursor-glow");
  const body = document.body;

  if (cursorGlow && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let glowX = window.innerWidth / 2;
    let glowY = window.innerHeight / 2;
    let targetX = glowX;
    let targetY = glowY;

    window.addEventListener("pointermove", (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      body.classList.add("has-pointer");
    }, { passive: true });

    window.addEventListener("pointerleave", () => {
      body.classList.remove("has-pointer");
    });

    // Smooth lerp for buttery movement
    function animateGlow() {
      glowX += (targetX - glowX) * 0.14;
      glowY += (targetY - glowY) * 0.14;
      cursorGlow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
      requestAnimationFrame(animateGlow);
    }
    animateGlow();
  }

  /* ---------- DOM references ---------- */
  const generateBtn = document.getElementById("generateBtn");
  const treeInput = document.getElementById("treeInput");
  const psCodeEl = document.getElementById("psCode");
  const bashCodeEl = document.getElementById("bashCode");

  if (!generateBtn || !treeInput || !psCodeEl || !bashCodeEl) return;

  /* ---------- Copy buttons ---------- */
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.dataset.target;
      const target = document.getElementById(targetId);
      if (!target) return;

      const text = target.textContent;
      const labelEl = btn.querySelector(".copy-label") || btn;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for non-secure contexts
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }

        btn.classList.add("copied");
        const original = labelEl.textContent;
        labelEl.textContent = "Copied!";
        setTimeout(() => {
          btn.classList.remove("copied");
          labelEl.textContent = original;
        }, 1500);
      } catch (err) {
        console.warn("Copy failed:", err);
      }
    });
  });

  /* ---------- Tree parser ----------
     Strategy:
     - Walk each line.
     - Compute depth from the visual prefix length (each tree level ≈ 4 chars).
     - Maintain a stack of directory names.
     - Classify each entry as dir or file using a combination of trailing slash
       and presence of a file extension.
  ------------------------------------- */

  function parseTree(raw) {
    const lines = raw.split(/\r?\n/);
    const dirSet = new Set();
    const fileSet = new Set();
    const stack = []; // directory names at each level

    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;

      // Capture the prefix (whitespace + box-drawing chars) for depth calc.
      const prefixMatch = rawLine.match(/^[\s│├└─|+\\`\-]*/);
      const prefix = prefixMatch ? prefixMatch[0] : "";

      // Strip all tree-drawing glyphs and separators from the name portion.
      const nameRaw = rawLine
        .slice(prefix.length)
        .replace(/^[─\-─\s|+`\\]+/, "")
        .trim();

      if (!nameRaw) continue;

      // Depth: each indent level is ~4 visual columns.
      // We count unicode boxes AND spaces. Tabs count as 4 spaces.
      let visualLen = 0;
      for (const ch of prefix) {
        if (ch === "\t") visualLen += 4;
        else visualLen += 1;
      }
      const depth = Math.max(0, Math.round(visualLen / 4));

      // ----- Classify entry -----
      const explicitDir = /[\/\\]$/.test(nameRaw);
      const name = nameRaw.replace(/[\/\\]+$/, "").trim();
      if (!name) continue;

      let isDir;
      if (explicitDir) {
        isDir = true;
      } else if (name.startsWith(".") && !name.includes("/")) {
        // hidden file (.env, .gitignore) — treat as file, unless it's clearly a folder
        isDir = false;
      } else if (/\.[A-Za-z0-9]+$/.test(name)) {
        // has a file extension -> file
        isDir = false;
      } else {
        // no extension, no trailing slash -> assume directory
        isDir = true;
      }

      // ----- Adjust stack to depth -----
      if (depth < stack.length) {
        stack.length = depth;
      } else if (depth > stack.length) {
        // Malformed jump: pad with nothing so indices line up, but don't
        // invent folder names — just truncate/pad with empty strings.
        while (stack.length < depth) stack.push("");
      }

      // Parent path = stack entries without trailing empties
      const parentParts = stack.filter((p) => p !== "");
      const fullPath = [...parentParts, name].join("/");

      if (isDir) {
        dirSet.add(fullPath);
        stack.push(name);
      } else {
        fileSet.add(fullPath);
      }
    }

    // Remove empty strings / dedupe parents
    const dirs = Array.from(dirSet).filter(Boolean).sort(sortByDepth);
    const files = Array.from(fileSet).filter(Boolean).sort(sortByDepth);

    return { dirs, files };
  }

  function sortByDepth(a, b) {
    const da = a.split("/").length;
    const db = b.split("/").length;
    if (da !== db) return da - db;
    return a.localeCompare(b);
  }

  /* ---------- Command generators ---------- */

  function generatePowerShell(dirs, files) {
    if (!dirs.length && !files.length) {
      return "# No entries detected. Paste a tree structure above.";
    }

    const out = [];
    out.push("# PowerShell setup script");
    out.push("# Run from the desired parent folder");
    out.push("");

    if (dirs.length) {
      out.push("$dirs = @(");
      out.push(
        dirs
          .map((d) => `    "${d.replace(/\//g, "\\").replace(/"/g, '`"')}"`)
          .join(",\n")
      );
      out.push(")");
      out.push("");
      out.push(
        "foreach ($d in $dirs) {"
      );
      out.push(
        '    if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }'
      );
      out.push("}");
      out.push("");
    }

    if (files.length) {
      out.push("$files = @(");
      out.push(
        files
          .map((f) => `    "${f.replace(/\//g, "\\").replace(/"/g, '`"')}"`)
          .join(",\n")
      );
      out.push(")");
      out.push("");
      out.push(
        "foreach ($f in $files) {"
      );
      out.push(
        '    if (-not (Test-Path -LiteralPath $f)) { New-Item -ItemType File -Force -Path $f | Out-Null }'
      );
      out.push("}");
    }

    return out.join("\n");
  }

  function generateBash(dirs, files) {
    if (!dirs.length && !files.length) {
      return "# No entries detected. Paste a tree structure above.";
    }

    const out = [];
    out.push("#!/usr/bin/env bash");
    out.push("# Bash setup script");
    out.push("# Run from the desired parent folder");
    out.push("");
    out.push("set -e");
    out.push("");

    if (dirs.length) {
      out.push("# Create directories");
      // Chunk long paths into multiple mkdir calls for safety
      const chunks = chunkArray(dirs, 40);
      for (const chunk of chunks) {
        out.push(
          "mkdir -p " +
            chunk.map((d) => `"${escapeBash(d)}"`).join(" \\\n         ")
        );
      }
      out.push("");
    }

    if (files.length) {
      out.push("# Create empty files");
      const chunks = chunkArray(files, 40);
      for (const chunk of chunks) {
        out.push(
          "touch " +
            chunk.map((f) => `"${escapeBash(f)}"`).join(" \\\n      ")
        );
      }
    }

    return out.join("\n");
  }

  function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function escapeBash(s) {
    return s.replace(/(["\\$`])/g, "\\$1");
  }

  /* ---------- Main action ---------- */

  function generate() {
    const raw = treeInput.value;
    const { dirs, files } = parseTree(raw);

    psCodeEl.textContent = generatePowerShell(dirs, files);
    bashCodeEl.textContent = generateBash(dirs, files);
  }

  generateBtn.addEventListener("click", generate);

  // Ctrl/Cmd + Enter shortcut
  treeInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  });

  // Prefill with a helpful demo tree
  const SAMPLE = `my-portfolio/
├── index.html
├── css/
│   ├── style.css
│   └── animations.css
├── js/
│   └── app.js
├── assets/
│   ├── images/
│   │   └── profile.jpg
│   └── favicon.ico
└── README.md`;

  treeInput.value = SAMPLE;

  // Auto-generate on load so the UI isn't empty
  generate();
})();