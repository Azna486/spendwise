// Fin 🌙 — SpendBuddy, a little glowing jellyfish that floats around the whole app (and says hi on the login page).
// It wanders, peeks at your cards, follows your cursor, dodges it for fun, does loop-the-loops,
// leaves a trail of stardust, and reacts to your money (celebrates, side-eyes, worries, sleeps).
// You can boop it (click) to make it talk, or drag it anywhere and toss it.
// app.js uses it through window.SpendBuddy.create(...), the same way it used the old crab.
(function () {
  const MOODS = ['happy', 'excited', 'worried', 'sleepy', 'shy'];
  const SIZE = () => (matchMedia('(max-width: 760px)').matches ? 60 : 78); // jellyfish width in px
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const SETTING_KEY = 'spendwise-buddy'; // 'roam' | 'corner' | 'hidden'

  // The drawing. Colours come from CSS variables (see the SPENDBUDDY section in styles.css),
  // so it matches light and dark mode without redrawing.
  function draw() {
    return `<svg viewBox="0 0 100 124" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="jelly-bell-fill" cx="42%" cy="30%" r="70%">
          <stop offset="0" class="jelly-stop-core" />
          <stop offset=".5" class="jelly-stop-light" />
          <stop offset="1" class="jelly-stop-deep" />
        </radialGradient>
        <linearGradient id="jelly-ribbon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="jelly-stop-light" />
          <stop offset="1" class="jelly-stop-fade" />
        </linearGradient>
      </defs>
      <ellipse class="jelly-aura" cx="50" cy="42" rx="44" ry="36" />
      <g class="jelly-tentacles">
        <path class="jelly-ribbon r1" d="M28 60 C22 74 34 82 26 98 C22 106 26 112 24 118" />
        <path class="jelly-ribbon r2" d="M41 63 C37 78 47 86 41 102 C39 108 42 112 41 116" />
        <path class="jelly-ribbon r3" d="M59 63 C63 78 53 86 59 102 C61 108 58 112 59 116" />
        <path class="jelly-ribbon r4" d="M72 60 C78 74 66 82 74 98 C78 106 74 112 76 118" />
        <path class="jelly-thread t1" d="M34 62 C31 80 39 92 33 110" />
        <path class="jelly-thread t2" d="M50 64 C47 82 53 94 50 112" />
        <path class="jelly-thread t3" d="M66 62 C69 80 61 92 67 110" />
      </g>
      <g class="jelly-bell">
        <path class="jelly-dome" d="M12 58 C12 30 29 12 50 12 C71 12 88 30 88 58
          C83 62 78 57 72 61 C66 65 61 59 55 63 C51 60 49 60 45 63 C39 59 34 65 28 61 C22 57 17 62 12 58 Z" />
        <path class="jelly-frill" d="M16 56 C22 60 26 55 32 59 C38 62 42 57 50 60 C58 57 62 62 68 59 C74 55 78 60 84 56" />
        <ellipse class="jelly-shine" cx="34" cy="26" rx="9" ry="5" transform="rotate(-24 34 26)" />
        <circle class="jelly-shine" cx="24" cy="38" r="2.2" />
        <!-- a tiny constellation on its bell -->
        <path class="jelly-constellation" d="M60 22 L69 29 L66 38" />
        <path class="jelly-star" d="M60 18.6 L61 21 L63.4 22 L61 23 L60 25.4 L59 23 L56.6 22 L59 21 Z" />
        <circle class="jelly-star" cx="69" cy="29" r="1.6" />
        <circle class="jelly-star" cx="66" cy="38" r="1.3" />
        <!-- faces: one per mood (CSS shows the right one) -->
        <g class="jelly-face" data-mood="happy">
          <g class="jelly-eyes"><circle cx="40" cy="42" r="3" /><circle cx="58" cy="42" r="3" /></g>
          <g class="jelly-pupils"><circle cx="41" cy="41" r="1" /><circle cx="59" cy="41" r="1" /></g>
          <path class="jelly-mouth" d="M46 48.5 Q49 51.5 52 48.5" />
        </g>
        <g class="jelly-face" data-mood="excited">
          <path class="jelly-mouth" d="M36 43 Q40 37.5 44 43 M54 43 Q58 37.5 62 43" />
          <path class="jelly-open-mouth" d="M45 48 Q49 55 53 48 Z" />
        </g>
        <g class="jelly-face" data-mood="worried">
          <g class="jelly-eyes"><circle cx="40" cy="43" r="3" /><circle cx="58" cy="43" r="3" /></g>
          <g class="jelly-pupils"><circle cx="41" cy="42" r="1" /><circle cx="59" cy="42" r="1" /></g>
          <path class="jelly-mouth" d="M44 51 Q46.5 49 49 51 Q51.5 53 54 51" />
          <path class="jelly-drop" d="M70 36 Q73 41 70 43 Q67 41 70 36 Z" />
        </g>
        <g class="jelly-face" data-mood="shy">
          <path class="jelly-mouth" d="M37 39.5 L42 42.5 L37 45.5 M61 39.5 L56 42.5 L61 45.5" />
          <path class="jelly-mouth" d="M46.5 49 Q49 51.5 51.5 49" />
          <path class="jelly-cover" d="M30 44 C30 38 36 36 41 40 C44 43 42 47 38 47 C34 47 30 47 30 44 Z" />
          <path class="jelly-cover" d="M70 44 C70 38 64 36 59 40 C56 43 58 47 62 47 C66 47 70 47 70 44 Z" />
        </g>
        <g class="jelly-face" data-mood="sleepy">
          <path class="jelly-mouth" d="M36 43 Q40 46 44 43 M54 43 Q58 46 62 43" />
          <circle class="jelly-open-mouth" cx="49" cy="50" r="1.6" />
          <text class="jelly-z" x="72" y="20">z</text><text class="jelly-z small" x="80" y="11">z</text>
        </g>
      </g>
    </svg>`;
  }

  let instance = null;

  function create() {
    if (instance) return instance; // there's only one jellyfish
    const root = document.createElement('div');
    root.className = 'jelly-buddy mood-happy';
    root.innerHTML = `
      <div class="jelly-body">
        <button type="button" class="jelly-button" aria-label="Fin, your jellyfish buddy. Click to chat, drag to move.">${draw()}</button>
      </div>
      <div class="jelly-bubble" role="status" aria-live="polite"></div>`;
    document.body.append(root);
    const body = root.querySelector('.jelly-body');
    const button = root.querySelector('.jelly-button');
    const bubble = root.querySelector('.jelly-bubble');

    let lines = () => [];
    let lastLine = '';
    let bubbleTimer;
    let setting = 'roam';
    try { setting = localStorage.getItem(SETTING_KEY) || 'roam'; } catch (e) {}

    // ---------- position & movement ----------
    const state = {
      x: innerWidth - SIZE() - 40, y: innerHeight - SIZE() * 1.3 - 40, vx: 0, vy: 0,
      target: null, mode: 'rest', until: 0, speed: 1.2, dragging: false, lastDodge: 0, lastPeekTalk: 0
    };
    const pointer = { x: -999, y: -999, seen: 0 };
    const width = () => SIZE();
    const height = () => SIZE() * 1.24;
    const bounds = () => ({ minX: 8, minY: 8, maxX: innerWidth - width() - 8, maxY: innerHeight - height() - 8 });

    function corner() {
      const b = bounds();
      // sit just above the FIN chat button (bottom-right) when it's on the page
      const chatButton = document.querySelector('.fin-launcher');
      return { x: b.maxX - 12, y: chatButton ? b.maxY - 84 : b.maxY - 12 };
    }

    function replay(className, ms) {
      root.classList.remove(className);
      void root.offsetWidth; // restart the CSS animation
      root.classList.add(className);
      setTimeout(() => root.classList.remove(className), ms);
    }

    function sparkle(count = 1, spread = 0) {
      if (reduceMotion() || setting === 'hidden') return;
      for (let i = 0; i < count; i++) {
        const dust = document.createElement('i');
        dust.className = 'jelly-dust';
        dust.style.left = `${state.x + width() / 2 + rand(-spread, spread) + rand(-8, 8)}px`;
        dust.style.top = `${state.y + height() * 0.55 + rand(-spread, spread)}px`;
        dust.style.setProperty('--drift', `${rand(-18, 18)}px`);
        dust.style.animationDelay = `${i * 40}ms`;
        document.body.append(dust);
        setTimeout(() => dust.remove(), 1700 + i * 40);
      }
    }

    // Interesting things on screen to swim over and peek at
    function somethingToVisit() {
      const candidates = [...document.querySelectorAll('.summary-card, .panel, .event-card, .budget-card, .pot, .spotlight, .page-heading h1, .nav-link.active')]
        .map(element => element.getBoundingClientRect())
        .filter(box => box.width > 40 && box.bottom > 60 && box.top < innerHeight - 60 && box.right > 0 && box.left < innerWidth);
      if (!candidates.length) return null;
      const box = candidates[Math.floor(Math.random() * candidates.length)];
      // perch just above the top-right corner, as if peeking over the edge
      return { x: box.right - width() * 0.9 - rand(0, 40), y: box.top - height() * 0.55 };
    }

    const peekLines = ['Just floating by 🌙', 'Ooh, numbers ✨', 'Comfy spot. Mind if I stay?', 'Peekaboo 👀', 'Wheee 💫', '*gentle bloop*'];

    // ---------- keep out of an area (e.g. the login form, so it never floats over what you type) ----------
    let keepOutElement = null;
    const PAD = 14;
    function keepOutBox() {
      if (!keepOutElement || !keepOutElement.isConnected) return null;
      const r = keepOutElement.getBoundingClientRect();
      return { left: r.left - PAD, top: r.top - PAD, right: r.right + PAD, bottom: r.bottom + PAD };
    }
    const overlapsBox = (x, y, box) => x < box.right && x + width() > box.left && y < box.bottom && y + height() > box.top;
    // nearest spot for its top-left corner that's clear of the area (and still on screen)
    function clearSpot(x, y) {
      const box = keepOutBox();
      if (!box || !overlapsBox(x, y, box)) return { x, y };
      const b = bounds();
      const options = [
        { x: box.left - width(), y }, { x: box.right, y },     // left / right of it
        { x, y: box.top - height() }, { x, y: box.bottom }    // above / below it
      ].filter(p => p.x >= b.minX - 1 && p.x <= b.maxX + 1 && p.y >= b.minY - 1 && p.y <= b.maxY + 1);
      if (!options.length) { // no room anywhere (tiny screen): hide away in the bottom corner
        return { x: b.maxX, y: b.maxY };
      }
      options.sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y));
      return options[0];
    }

    function chooseMode() {
      const now = performance.now();
      const mood = MOODS.find(name => root.classList.contains(`mood-${name}`));
      if (setting === 'corner') { state.mode = 'home'; state.target = corner(); state.speed = 9; state.until = now + 4000; return; }
      if (mood === 'sleepy') { // late at night: slow drifting near the bottom
        state.mode = Math.random() < 0.6 ? 'rest' : 'wander';
        state.target = { x: rand(bounds().minX, bounds().maxX), y: rand(bounds().maxY * 0.7, bounds().maxY) };
        state.speed = 0.5; state.until = now + rand(5000, 9000);
        return;
      }
      const roll = Math.random();
      if (roll < 0.36) { state.mode = 'wander'; state.target = { x: rand(bounds().minX, bounds().maxX), y: rand(bounds().minY + 60, bounds().maxY) }; state.speed = rand(0.9, 1.6); state.until = now + 9000; }
      else if (roll < 0.62) { const spot = somethingToVisit(); state.mode = spot ? 'visit' : 'wander'; state.target = spot || { x: rand(bounds().minX, bounds().maxX), y: rand(bounds().minY, bounds().maxY) }; state.speed = 1.3; state.until = now + 9000; }
      else if (roll < 0.76 && now - pointer.seen < 4000) { state.mode = 'follow'; state.speed = 1.8; state.until = now + rand(4000, 7000); }
      else if (roll < 0.84 && !(keepOutBox() && overlapsBox(state.x, state.y, keepOutBox()))) { state.mode = 'loop'; state.until = now + 1300; replay('looping', 1300); sparkle(5, 14); }
      else { state.mode = 'rest'; state.target = null; state.until = now + rand(2500, 5000); }
    }

    function step(now) {
      requestAnimationFrame(step);
      if (document.hidden || setting === 'hidden' || state.dragging) return;
      const b = bounds();
      if (reduceMotion()) { // no swimming around: stay in the corner
        const c = corner(); state.x = c.x; state.y = c.y; place(0); return;
      }
      if (now > state.until) chooseMode();
      if (state.mode === 'follow') state.target = { x: pointer.x - width() / 2 + 70, y: pointer.y - height() / 2 - 30 };

      // Playful dodge: sometimes, when the cursor sneaks up, it darts away
      const cx = state.x + width() / 2; const cy = state.y + height() / 2;
      const dx = cx - pointer.x; const dy = cy - pointer.y; const near = Math.hypot(dx, dy);
      if (near < 70 && state.mode !== 'follow' && setting === 'roam' && now - state.lastDodge > 5000 && !root.classList.contains('hovered')) {
        state.lastDodge = now;
        if (Math.random() < 0.4) {
          const d = near || 1;
          state.mode = 'dodge'; state.speed = 5; state.until = now + 900;
          state.target = { x: clamp(state.x + dx / d * 220, b.minX, b.maxX), y: clamp(state.y + dy / d * 180, b.minY, b.maxY) };
          if (Math.random() < 0.35) say(['Eep! 😳', 'Too slow! 😜', 'Can\'t catch me ✨'][Math.floor(Math.random() * 3)], 1600);
          sparkle(3, 10);
        }
      }

      // Steer gently towards the target (slowing down on arrival), like drifting in water
      let ax = 0; let ay = 0;
      if (state.target && keepOutElement) state.target = clearSpot(state.target.x, state.target.y);
      // drifted (or was thrown) into the area: swim straight back out
      if (keepOutElement && state.mode !== 'loop') {
        const box = keepOutBox();
        if (box && overlapsBox(state.x, state.y, box)) {
          const out = clearSpot(state.x, state.y);
          state.target = out; state.mode = 'home'; state.speed = 4; state.until = now + 1500;
        }
      }
      if (state.target && state.mode !== 'loop') {
        const tx = clamp(state.target.x, b.minX, b.maxX); const ty = clamp(state.target.y, b.minY, b.maxY);
        const ex = tx - state.x; const ey = ty - state.y; const dist = Math.hypot(ex, ey);
        if (dist < 6 && state.mode !== 'follow') {
          if (state.mode === 'visit' && now - state.lastPeekTalk > 25000 && Math.random() < 0.25 && !root.classList.contains('talking')) {
            state.lastPeekTalk = now; say(peekLines[Math.floor(Math.random() * peekLines.length)], 2400);
          }
          if (state.mode !== 'rest') { state.mode = 'rest'; state.until = now + rand(1800, 4200); }
          state.target = null;
        } else {
          const want = Math.min(state.speed, dist / 40) ;
          ax = (ex / (dist || 1)) * want - state.vx; ay = (ey / (dist || 1)) * want - state.vy;
        }
      }
      const ease = state.mode === 'dodge' || state.mode === 'home' ? 0.16 : 0.035; // darting vs drifting
      state.vx += ax * ease; state.vy += ay * ease;
      state.vx *= 0.985; state.vy *= 0.985;
      state.x = clamp(state.x + state.vx, b.minX, b.maxX);
      state.y = clamp(state.y + state.vy, b.minY, b.maxY);
      // a little sparkle trail when it's zooming
      if (Math.hypot(state.vx, state.vy) > 2.6 && Math.random() < 0.25) sparkle(1, 4);
      place(now);
    }

    function place(now) {
      const bob = reduceMotion() ? 0 : Math.sin(now / 650) * 4;
      const tilt = clamp(state.vx * 9, -20, 20);
      root.style.transform = `translate3d(${state.x}px, ${state.y + bob}px, 0)`;
      body.style.transform = `rotate(${tilt}deg)`;
      // swim pulse speeds up when it moves faster
      root.style.setProperty('--swim', `${clamp(1.8 - Math.hypot(state.vx, state.vy) * 0.35, 0.7, 1.8)}s`);
      // speech bubble goes on whichever side has room
      root.classList.toggle('bubble-left', state.x > innerWidth - 300);
      root.classList.toggle('bubble-below', state.y < 110);
    }

    // ---------- talking, moods & reactions ----------
    function say(text, ms = 4500) {
      if (setting === 'hidden') return;
      bubble.textContent = text;
      root.classList.add('talking');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => root.classList.remove('talking'), ms);
    }

    const buddy = {
      root,
      redraw() {},
      setMood(mood) {
        MOODS.forEach(name => root.classList.remove(`mood-${name}`));
        root.classList.add(`mood-${MOODS.includes(mood) ? mood : 'happy'}`);
      },
      say,
      snap() { replay('booped', 600); sparkle(3, 8); },
      celebrate() { replay('celebrate', 1600); sparkle(10, 22); state.mode = 'loop'; state.until = performance.now() + 1600; },
      sideEye() { replay('side-eye', 1700); state.vx *= 0.2; state.vy *= 0.2; state.mode = 'rest'; state.target = null; state.until = performance.now() + 2500; },
      setLines(provider) { lines = provider; },
      setSetting(value) {
        setting = ['roam', 'corner', 'hidden'].includes(value) ? value : 'roam';
        try { localStorage.setItem(SETTING_KEY, setting); } catch (e) {}
        root.classList.toggle('hidden-buddy', setting === 'hidden');
        state.until = 0; // pick something new right away
      },
      getSetting() { return setting; },
      // swim over to a spot on the screen (x, y = where its top-left should go)
      swimTo(x, y, speed = 3) { state.mode = 'home'; state.target = { x, y }; state.speed = speed; state.until = performance.now() + 4000; },
      // never float over this element (it can still be dragged there; it swims back out after)
      keepOutOf(element) { keepOutElement = element; }
    };
    buddy.setSetting(setting);

    // ---------- boop (click) and drag-to-toss ----------
    let drag = null;
    let justDragged = 0; // a drag ends with a click event too; ignore that one
    button.addEventListener('pointerdown', event => {
      drag = { startX: event.clientX, startY: event.clientY, offX: event.clientX - state.x, offY: event.clientY - state.y, moved: false, lastX: event.clientX, lastY: event.clientY, t: performance.now() };
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointermove', event => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) {
        drag.moved = true; state.dragging = true; root.classList.add('dragging');
      }
      if (!drag.moved) return;
      const b = bounds(); const now = performance.now(); const dt = Math.max(16, now - drag.t);
      state.vx = (event.clientX - drag.lastX) / dt * 16; state.vy = (event.clientY - drag.lastY) / dt * 16;
      drag.lastX = event.clientX; drag.lastY = event.clientY; drag.t = now;
      state.x = clamp(event.clientX - drag.offX, b.minX, b.maxX); state.y = clamp(event.clientY - drag.offY, b.minY, b.maxY);
      place(now);
    });
    const endDrag = () => {
      if (!drag) return;
      const wasDrag = drag.moved;
      drag = null;
      if (!wasDrag) return;
      state.dragging = false; root.classList.remove('dragging'); justDragged = performance.now();
      // let go: it keeps the throw speed for a moment, then drifts
      state.vx = clamp(state.vx, -14, 14); state.vy = clamp(state.vy, -14, 14);
      state.mode = 'rest'; state.target = null; state.until = performance.now() + 2500;
      replay('booped', 600);
      if (Math.hypot(state.vx, state.vy) > 5) { say('Wheeee! 💫', 1500); sparkle(6, 12); }
    };
    button.addEventListener('pointerup', endDrag);
    button.addEventListener('pointercancel', endDrag);
    button.addEventListener('click', () => {
      if (performance.now() - justDragged < 300) return;
      buddy.snap();
      const options = lines().filter(line => line && line !== lastLine);
      if (!options.length) return;
      lastLine = options[Math.floor(Math.random() * options.length)];
      say(lastLine);
    });
    root.addEventListener('pointerenter', () => { root.classList.add('hovered'); replay('wiggle', 700); });
    root.addEventListener('pointerleave', () => root.classList.remove('hovered'));

    // ---------- eyes follow your cursor ----------
    document.addEventListener('pointermove', event => {
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.seen = performance.now();
      if (root.classList.contains('side-eye')) return;
      const box = button.getBoundingClientRect();
      const ex = event.clientX - (box.left + box.width / 2); const ey = event.clientY - (box.top + box.height * 0.36);
      const d = Math.hypot(ex, ey) || 1;
      root.style.setProperty('--look-x', `${(ex / d) * 1.4}px`);
      root.style.setProperty('--look-y', `${(ey / d) * 1.2}px`);
    }, { passive: true });

    // ---------- swim away from what you're typing in ----------
    document.addEventListener('focusin', event => {
      if (!event.target.matches('input, select, textarea') || setting !== 'roam') return;
      const box = event.target.getBoundingClientRect();
      const overlaps = !(state.x > box.right + 30 || state.x + width() < box.left - 30 || state.y > box.bottom + 30 || state.y + height() < box.top - 30);
      if (!overlaps) return;
      const b = bounds();
      state.mode = 'dodge'; state.speed = 4; state.until = performance.now() + 1500;
      state.target = { x: box.left > innerWidth / 2 ? b.minX + 20 : b.maxX - 20, y: clamp(box.top - 140, b.minY, b.maxY) };
    });

    // ---------- blinking ----------
    (function blinkLoop() {
      setTimeout(() => {
        if (!root.classList.contains('side-eye')) replay('blink', 170);
        blinkLoop();
      }, rand(2600, 6000));
    })();

    addEventListener('resize', () => { const b = bounds(); state.x = clamp(state.x, b.minX, b.maxX); state.y = clamp(state.y, b.minY, b.maxY); });
    requestAnimationFrame(step);
    instance = buddy;
    return buddy;
  }

  window.SpendBuddy = { create };
})();
