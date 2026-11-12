// SpendBuddy 🦀 — a tiny cheeky financial companion that lives on your Overview.
// Drawn in SVG in the theme colours: clean outlines, eyes on stalks, a smirk, and a ₹ coin it won't let go of.
// It blinks, follows your cursor, sways, waves on hover, snaps its claws and chats when clicked,
// shows a mood based on your money, and celebrates (or side-eyes) what you add.
// app.js uses it through window.SpendBuddy.create(...).
(function () {
  // Colours come from the theme (see the SPENDBUDDY section in styles.css), so the crab matches the app.
  const themeColour = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  let BODY, SHADE, HIGHLIGHT, INK, CHEEK, COIN, COIN_INK;
  function loadColours() {
    BODY = themeColour('--crab-body', '#D6B77A');
    SHADE = themeColour('--crab-shade', '#B08F52');
    HIGHLIGHT = themeColour('--crab-highlight', '#EBD6A8');
    INK = themeColour('--crab-ink', '#174C3C');
    CHEEK = themeColour('--crab-cheek', 'rgba(168,195,160,.55)');
    COIN = themeColour('--crab-coin', '#174C3C');
    COIN_INK = themeColour('--crab-coin-ink', '#D6B77A');
  }
  const MOODS = ['happy', 'excited', 'worried', 'sleepy'];
  const instances = new Set();

  // A line drawn twice (dark then orange) gives the clean outlined look
  const limb = (d, width = 4.5) =>
    `<path d="${d}" stroke="${INK}" stroke-width="${width + 3}" fill="none" stroke-linecap="round" />` +
    `<path d="${d}" stroke="${BODY}" stroke-width="${width}" fill="none" stroke-linecap="round" />`;

  // One side's legs, arm and claw. The other side is a mirror copy.
  function side() {
    let legs = '';
    for (let i = 0; i < 3; i++) legs += limb(`M38 ${84 + i * 6} Q26 ${85 + i * 6} ${18 - i * 2} ${95 + i * 7}`, 4);
    return `
      <g class="crab-legs">${legs}</g>
      ${limb('M40 70 Q26 66 24 54', 5)}
      <g class="crab-claw">
        <g transform="rotate(-28 22 46)">
          <!-- a round pincer with a notch at the top: one fixed half and one half that snaps -->
          <path d="M22 46 L26.45 33.78 A13 13 0 0 1 22 59 Z" fill="${BODY}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" />
          <path class="claw-top" d="M22 46 L22 59 A13 13 0 0 1 17.55 33.78 Z" fill="${BODY}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" />
          <ellipse cx="15.5" cy="42" rx="2.4" ry="4" fill="${HIGHLIGHT}" transform="rotate(20 15.5 42)" />
        </g>
      </g>`;
  }

  function draw() {
    loadColours();
    return `<svg viewBox="0 0 140 120" aria-hidden="true" focusable="false">
      <ellipse cx="70" cy="113" rx="44" ry="5" fill="#000" opacity=".16" />
      <g class="crab">
        <g class="crab-side-left">${side()}</g>
        <g class="crab-side-right" transform="translate(140 0) scale(-1 1)">${side()}</g>

        <!-- the coin it's hoarding -->
        <g class="crab-coin">
          <circle cx="126" cy="28" r="7.5" fill="${COIN}" stroke="${COIN_INK}" stroke-width="2.5" />
          <text x="126" y="31.5" text-anchor="middle" font-size="9.5" font-weight="800" fill="${COIN_INK}" font-family="sans-serif">₹</text>
        </g>

        <!-- body -->
        <ellipse cx="70" cy="78" rx="40" ry="27" fill="${BODY}" stroke="${INK}" stroke-width="3" />
        <ellipse cx="70" cy="88" rx="32" ry="13" fill="${SHADE}" opacity=".45" />
        <ellipse cx="53" cy="65" rx="11" ry="4.5" fill="${HIGHLIGHT}" transform="rotate(-18 53 65)" />
        <g fill="${SHADE}"><circle cx="43" cy="82" r="1.5" /><circle cx="47.5" cy="85.5" r="1.5" /><circle cx="41" cy="87" r="1.5" />
          <circle cx="97" cy="82" r="1.5" /><circle cx="92.5" cy="85.5" r="1.5" /><circle cx="99" cy="87" r="1.5" /></g>
        <ellipse cx="50" cy="79" rx="6" ry="3.5" fill="${CHEEK}" />
        <ellipse cx="90" cy="79" rx="6" ry="3.5" fill="${CHEEK}" />

        <!-- eyes on stalks -->
        ${limb('M61 57 L57 40', 4.5)}${limb('M79 57 L83 40', 4.5)}
        <g class="crab-eyes">
          <circle cx="56" cy="32" r="10" fill="#fff" stroke="${INK}" stroke-width="3" />
          <circle cx="84" cy="32" r="10" fill="#fff" stroke="${INK}" stroke-width="3" />
          <g class="buddy-pupils">
            <circle cx="57" cy="33" r="4.6" fill="${INK}" /><circle cx="85" cy="33" r="4.6" fill="${INK}" />
            <circle cx="58.6" cy="31.2" r="1.6" fill="#fff" /><circle cx="86.6" cy="31.2" r="1.6" fill="#fff" />
          </g>
        </g>

        <!-- faces: one per mood (eyebrows + mouth) -->
        <g data-mood="happy" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round">
          <path d="M46 18 Q54 12 63 16" /><path d="M77 21 Q85 19 93 22" />
          <path d="M59 87 Q70 96 81 85" /><path d="M81 85 L84.5 83" />
        </g>
        <g data-mood="excited">
          <g stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"><path d="M46 16 Q54 10 63 14" /><path d="M77 14 Q86 10 94 16" /></g>
          <path d="M58 84 Q70 85 82 84 Q80 99 70 99 Q60 99 58 84 Z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" />
          <path d="M63 94 Q70 89.5 77 94 Q74 98 70 98 Q66 98 63 94 Z" fill="${HIGHLIGHT}" />
        </g>
        <g data-mood="worried" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round">
          <path d="M47 21 L62 16" /><path d="M78 16 L93 21" />
          <path d="M60 92 Q65 86 70 90.5 Q75 86 80 92" />
        </g>
        <g data-mood="sleepy">
          <path d="M45.5 32 A10.5 10.5 0 0 1 66.5 32 Z" fill="${BODY}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" />
          <path d="M73.5 32 A10.5 10.5 0 0 1 94.5 32 Z" fill="${BODY}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" />
          <ellipse cx="70" cy="90" rx="3.2" ry="3.8" fill="${INK}" />
          <text x="100" y="16" font-size="14" font-weight="800" fill="${INK}" font-family="sans-serif">z</text>
          <text x="110" y="7" font-size="10" font-weight="800" fill="${INK}" font-family="sans-serif">z</text>
        </g>
      </g>
    </svg>`;
  }

  // ---------- SpendBuddy on the page ----------
  function create(container) {
    const root = document.createElement('div');
    root.className = 'buddy mood-happy';
    root.innerHTML = `<div class="buddy-bubble" role="status" aria-live="polite"></div>
      <button type="button" class="buddy-button" aria-label="SpendBuddy, your cheeky money crab. Click to chat.">${draw()}</button>`;
    container.appendChild(root);
    const button = root.querySelector('.buddy-button');
    const bubble = root.querySelector('.buddy-bubble');
    let bubbleTimer;
    let lines = () => [];
    let lastLine = '';

    function replay(className, ms) {
      root.classList.remove(className);
      void root.offsetWidth; // restart the animation
      root.classList.add(className);
      setTimeout(() => root.classList.remove(className), ms);
    }

    const buddy = {
      root,
      redraw() { button.innerHTML = draw(); },
      setMood(mood) {
        MOODS.forEach(name => root.classList.remove(`mood-${name}`));
        root.classList.add(`mood-${MOODS.includes(mood) ? mood : 'happy'}`);
      },
      say(text, ms = 4500) {
        bubble.textContent = text;
        root.classList.add('talking');
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => root.classList.remove('talking'), ms);
      },
      snap() { replay('snap', 700); },
      celebrate() { replay('celebrate', 1700); },
      sideEye() { replay('side-eye', 1600); },
      setLines(provider) { lines = provider; }
    };

    button.addEventListener('click', () => {
      buddy.snap();
      const options = lines().filter(line => line && line !== lastLine);
      if (!options.length) return;
      lastLine = options[Math.floor(Math.random() * options.length)];
      buddy.say(lastLine);
    });

    instances.add(buddy);
    return buddy;
  }

  // Eyes follow your cursor
  let pointerX = 0;
  let pointerY = 0;
  let framePending = false;
  document.addEventListener('pointermove', event => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!framePending) { framePending = true; requestAnimationFrame(lookAtPointer); }
  });
  function lookAtPointer() {
    framePending = false;
    instances.forEach(buddy => {
      if (buddy.root.classList.contains('side-eye')) return; // busy giving you a look
      const pupils = buddy.root.querySelector('.buddy-pupils');
      const box = buddy.root.getBoundingClientRect();
      if (!box.width) return; // not on screen
      const dx = pointerX - (box.left + box.width / 2);
      const dy = pointerY - (box.top + box.height * 0.3);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / 220);
      pupils.style.transform = `translate(${(dx / distance * 3.6 * reach).toFixed(2)}px, ${(dy / distance * 3.6 * reach).toFixed(2)}px)`;
    });
  }

  // Blink every few seconds
  (function blinkLoop() {
    setTimeout(() => {
      instances.forEach(buddy => {
        buddy.root.classList.add('blink');
        setTimeout(() => buddy.root.classList.remove('blink'), 150);
      });
      blinkLoop();
    }, 2500 + Math.random() * 3500);
  })();

  // Every so often it does a sneaky little side-scuttle
  (function mischiefLoop() {
    setTimeout(() => {
      instances.forEach(buddy => {
        if (buddy.root.offsetParent === null || buddy.root.classList.contains('talking')) return;
        buddy.root.classList.add('scuttle');
        setTimeout(() => buddy.root.classList.remove('scuttle'), 1300);
      });
      mischiefLoop();
    }, 20000 + Math.random() * 20000);
  })();

  // Redraw in the new colours when you switch light/dark mode
  new MutationObserver(() => instances.forEach(buddy => buddy.redraw()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.SpendBuddy = { create };
})();
