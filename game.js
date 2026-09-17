(() => {
  "use strict";

  const WORLD_W = 1280;
  const WORLD_H = 720;
  const STORAGE_KEY = "neonSurvivorScores";
  const MUTE_KEY = "neonSurvivorMuted";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const screens = {
    menu: document.getElementById("screen-menu"),
    how: document.getElementById("screen-how"),
    scores: document.getElementById("screen-scores"),
    pause: document.getElementById("screen-pause"),
    over: document.getElementById("screen-over"),
    name: document.getElementById("screen-name"),
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active"));
    if (name && screens[name]) screens[name].classList.add("active");
  }

  class AudioSys {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.32;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    }

    setMuted(m) {
      this.muted = m;
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
      if (this.master) this.master.gain.value = m ? 0 : 0.32;
    }

    tone(freq, dur, type = "square", vol = 0.18, slide = 0) {
      if (this.muted) return;
      this.ensure();
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    }

    noise(dur, vol = 0.12) {
      if (this.muted) return;
      this.ensure();
      const n = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1400;
      src.buffer = buf;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    }

    shoot() { this.tone(720, 0.06, "square", 0.08); }
    laser() { this.tone(240, 0.16, "sawtooth", 0.12, 900); }
    hit() { this.tone(180, 0.05, "triangle", 0.08); this.noise(0.04, 0.06); }
    destroy() { this.noise(0.18, 0.16); this.tone(220, 0.22, "sawtooth", 0.12, -160); }
    coin() { this.tone(880, 0.07, "square", 0.1); this.tone(1320, 0.1, "square", 0.08); }
    power() { this.tone(523, 0.08, "triangle", 0.1); this.tone(659, 0.1, "triangle", 0.1); this.tone(784, 0.14, "triangle", 0.1); }
    hurt() { this.tone(90, 0.28, "sawtooth", 0.18, -40); this.noise(0.2, 0.14); }
    bossIn() { this.tone(70, 0.6, "square", 0.16); this.tone(90, 0.8, "sawtooth", 0.1); }
    bossOut() { this.tone(196, 0.2, "triangle", 0.12); this.tone(247, 0.2, "triangle", 0.12); this.tone(330, 0.4, "triangle", 0.14); }
    level() { this.tone(440, 0.1, "square", 0.1); this.tone(660, 0.18, "square", 0.1); }
    over() { this.tone(220, 0.35, "sawtooth", 0.14, -120); this.tone(110, 0.7, "triangle", 0.12, -50); }
  }

  const audio = new AudioSys();

  class HighScores {
    constructor() {
      this.list = this.load();
    }
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(raw) ? raw.slice(0, 10) : [];
      } catch {
        return [];
      }
    }
    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list.slice(0, 10)));
    }
    qualifies(score) {
      if (score <= 0) return false;
      if (this.list.length < 10) return true;
      return score > (this.list[this.list.length - 1].score || 0);
    }
    add(name, score) {
      this.list.push({ name: (name || "ACE").slice(0, 12).toUpperCase(), score: Math.floor(score) });
      this.list.sort((a, b) => b.score - a.score);
      this.list = this.list.slice(0, 10);
      this.save();
    }
    best() {
      return this.list[0] ? this.list[0].score : 0;
    }
    render(ol) {
      ol.innerHTML = "";
      for (let i = 0; i < 10; i++) {
        const row = this.list[i] || { name: "---", score: 0 };
        const li = document.createElement("li");
        li.innerHTML = `<span class="rank">${i + 1}</span><span>${row.name}</span><span>${row.score}</span>`;
        ol.appendChild(li);
      }
    }
  }

  const scores = new HighScores();

  class Input {
    constructor() {
      this.keys = new Set();
      this.mouse = { x: WORLD_W / 2, y: WORLD_H / 2, down: false };
      this.joy = { x: 0, y: 0, active: false };
      this.touchShoot = false;
      this.aim = 0;
      this.pauseQueued = false;
      this.shieldQueued = false;
    }
    attach() {
      window.addEventListener("keydown", (e) => {
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key)) e.preventDefault();
        this.keys.add(e.key.toLowerCase());
        if (e.key === " ") this.shieldQueued = true;
        if (e.key.toLowerCase() === "p") this.pauseQueued = true;
        audio.ensure();
      });
      window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
      canvas.addEventListener("mousedown", (e) => {
        this.mouse.down = true;
        this.updateMouse(e);
        audio.ensure();
      });
      window.addEventListener("mouseup", () => { this.mouse.down = false; });
      canvas.addEventListener("mousemove", (e) => this.updateMouse(e));
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      window.addEventListener("blur", () => this.keys.clear());
    }
    updateMouse(e) {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * WORLD_W;
      this.mouse.y = ((e.clientY - r.top) / r.height) * WORLD_H;
    }
    axis() {
      let x = this.joy.x, y = this.joy.y;
      if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
      if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
      if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
      if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      return { x, y };
    }
    weaponSelect() {
      if (this.keys.has("1")) return "normal";
      if (this.keys.has("2")) return "spread";
      if (this.keys.has("3")) return "laser";
      return null;
    }
  }

  const input = new Input();

  class Particle {
    constructor(x, y, opts = {}) {
      this.x = x;
      this.y = y;
      this.vx = opts.vx || rand(-80, 80);
      this.vy = opts.vy || rand(-80, 80);
      this.life = opts.life || rand(0.25, 0.7);
      this.max = this.life;
      this.size = opts.size || rand(1.5, 4);
      this.color = opts.color || "#3ef6ff";
      this.glow = opts.glow || this.color;
      this.drag = opts.drag ?? 0.98;
    }
    update(dt) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= this.drag;
      this.vy *= this.drag;
    }
    draw(c) {
      const a = clamp(this.life / this.max, 0, 1);
      c.globalAlpha = a;
      c.fillStyle = this.color;
      c.shadowColor = this.glow;
      c.shadowBlur = 12;
      c.beginPath();
      c.arc(this.x, this.y, this.size * a, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      c.globalAlpha = 1;
    }
  }

  class Floater {
    constructor(x, y, text, color) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.life = 0.85;
    }
    update(dt) {
      this.life -= dt;
      this.y -= 42 * dt;
    }
    draw(c) {
      c.globalAlpha = clamp(this.life / 0.85, 0, 1);
      c.fillStyle = this.color;
      c.font = "bold 16px Segoe UI";
      c.textAlign = "center";
      c.shadowColor = this.color;
      c.shadowBlur = 8;
      c.fillText(this.text, this.x, this.y);
      c.shadowBlur = 0;
      c.globalAlpha = 1;
    }
  }

  class Projectile {
    constructor(x, y, ang, opts) {
      this.x = x;
      this.y = y;
      this.ang = ang;
      this.speed = opts.speed;
      this.r = opts.r;
      this.dmg = opts.dmg;
      this.from = opts.from;
      this.color = opts.color;
      this.life = opts.life || 1.6;
      this.pierce = opts.pierce || 0;
      this.vx = Math.cos(ang) * this.speed;
      this.vy = Math.sin(ang) * this.speed;
      this.dead = false;
      this.trail = [];
    }
    update(dt) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 8) this.trail.shift();
      if (this.life <= 0 || this.x < -40 || this.y < -40 || this.x > WORLD_W + 40 || this.y > WORLD_H + 40) this.dead = true;
    }
    draw(c) {
      c.strokeStyle = this.color;
      c.globalAlpha = 0.35;
      c.lineWidth = this.r;
      c.beginPath();
      this.trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = "#fff";
      c.shadowColor = this.color;
      c.shadowBlur = 16;
      c.beginPath();
      c.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }
  }

  class LaserBeam {
    constructor(x, y, ang, dmg, color) {
      this.x = x;
      this.y = y;
      this.ang = ang;
      this.dmg = dmg;
      this.color = color;
      this.life = 0.12;
      this.len = 820;
      this.dead = false;
      this.from = "player";
      this.hits = new Set();
    }
    update(dt) { this.life -= dt; if (this.life <= 0) this.dead = true; }
    draw(c) {
      const a = clamp(this.life / 0.12, 0, 1);
      const x2 = this.x + Math.cos(this.ang) * this.len;
      const y2 = this.y + Math.sin(this.ang) * this.len;
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = this.color;
      c.shadowColor = this.color;
      c.shadowBlur = 24;
      c.lineWidth = 10 * a;
      c.beginPath();
      c.moveTo(this.x, this.y);
      c.lineTo(x2, y2);
      c.stroke();
      c.strokeStyle = "#fff";
      c.lineWidth = 3 * a;
      c.beginPath();
      c.moveTo(this.x, this.y);
      c.lineTo(x2, y2);
      c.stroke();
      c.restore();
    }
    hitsEnemy(e) {
      const x2 = this.x + Math.cos(this.ang) * this.len;
      const y2 = this.y + Math.sin(this.ang) * this.len;
      const d = pointToSeg(e.x, e.y, this.x, this.y, x2, y2);
      return d < e.r + 8;
    }
  }

  function pointToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = clamp(t, 0, 1);
    return dist(px, py, x1 + t * dx, y1 + t * dy);
  }

  class Coin {
    constructor(x, y, value = 25) {
      this.x = x;
      this.y = y;
      this.value = value;
      this.r = 9;
      this.t = rand(0, Math.PI * 2);
      this.baseY = y;
    }
    update(dt) {
      this.t += dt * 4;
      this.y = this.baseY + Math.sin(this.t) * 6;
    }
    draw(c) {
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.t * 0.4);
      c.shadowColor = "#ffd24a";
      c.shadowBlur = 16;
      c.fillStyle = "#ffd24a";
      c.beginPath();
      c.arc(0, 0, this.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff6c2";
      c.beginPath();
      c.arc(-2, -2, 3, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#fff";
      c.lineWidth = 2;
      c.strokeRect(-4, -4, 8, 8);
      c.restore();
    }
  }

  const POWER_DEFS = {
    shield: { label: "SHIELD", color: "#3ef6ff", dur: 5 },
    slow: { label: "SLOW MOTION", color: "#a78bfa", dur: 5 },
    double: { label: "DOUBLE SCORE", color: "#ffd24a", dur: 8 },
    rapid: { label: "RAPID FIRE", color: "#ff6b9d", dur: 6 },
    health: { label: "HEALTH", color: "#4ade80", dur: 0 },
  };

  class PowerUp {
    constructor(x, y, kind) {
      this.x = x;
      this.y = y;
      this.kind = kind;
      this.r = 13;
      this.t = 0;
      this.def = POWER_DEFS[kind];
    }
    update(dt) { this.t += dt; }
    draw(c) {
      const pulse = 1 + Math.sin(this.t * 6) * 0.08;
      c.save();
      c.translate(this.x, this.y);
      c.scale(pulse, pulse);
      c.shadowColor = this.def.color;
      c.shadowBlur = 18;
      c.fillStyle = this.def.color;
      if (this.kind === "shield") {
        c.beginPath();
        c.arc(0, 0, this.r, 0, Math.PI * 2);
        c.strokeStyle = this.def.color;
        c.lineWidth = 3;
        c.stroke();
        c.beginPath();
        c.moveTo(-5, 2); c.lineTo(0, 8); c.lineTo(8, -6);
        c.stroke();
      } else if (this.kind === "slow") {
        this.poly(c, 6, this.r);
        c.fill();
      } else if (this.kind === "double") {
        c.fillRect(-10, -10, 20, 20);
        c.fillStyle = "#201000";
        c.font = "bold 12px Segoe UI";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("2X", 0, 1);
      } else if (this.kind === "rapid") {
        this.poly(c, 3, this.r);
        c.fill();
      } else {
        c.beginPath();
        c.moveTo(0, -11);
        c.bezierCurveTo(12, -8, 10, 6, 0, 12);
        c.bezierCurveTo(-10, 6, -12, -8, 0, -11);
        c.fill();
      }
      c.restore();
    }
    poly(c, n, r) {
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
        const fn = i ? c.lineTo.bind(c) : c.moveTo.bind(c);
        fn(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
    }
  }

  class Player {
    constructor() { this.reset(); }
    reset() {
      this.x = WORLD_W / 2;
      this.y = WORLD_H / 2;
      this.vx = 0;
      this.vy = 0;
      this.r = 16;
      this.speed = 340;
      this.hp = 5;
      this.maxHp = 5;
      this.weapon = "normal";
      this.cool = 0;
      this.iframes = 0;
      this.shield = 0;
      this.shieldCd = 0;
      this.aim = -Math.PI / 2;
      this.t = 0;
      this.engine = 0;
    }
    update(dt, game) {
      this.t += dt;
      this.cool = Math.max(0, this.cool - dt);
      this.iframes = Math.max(0, this.iframes - dt);
      this.shield = Math.max(0, this.shield - dt);
      this.shieldCd = Math.max(0, this.shieldCd - dt);
      const ax = input.axis();
      this.vx = lerp(this.vx, ax.x * this.speed, 1 - Math.pow(0.001, dt));
      this.vy = lerp(this.vy, ax.y * this.speed, 1 - Math.pow(0.001, dt));
      this.x = clamp(this.x + this.vx * dt, 28, WORLD_W - 28);
      this.y = clamp(this.y + this.vy * dt, 28, WORLD_H - 28);
      this.engine = Math.hypot(this.vx, this.vy);
      const moving = this.engine > 20;
      if (game.touchMode) {
        if (moving) this.aim = Math.atan2(this.vy, this.vx);
        else if (game.nearestEnemy()) {
          const e = game.nearestEnemy();
          this.aim = angTo(this.x, this.y, e.x, e.y);
        }
      } else {
        this.aim = angTo(this.x, this.y, input.mouse.x, input.mouse.y);
      }
      const wsel = input.weaponSelect();
      if (wsel) this.weapon = wsel;
      if (input.shieldQueued) {
        input.shieldQueued = false;
        this.tryShield();
      }
      const firing = input.mouse.down || input.touchShoot;
      if (firing) this.shoot(game);
    }
    tryShield() {
      if (this.shieldCd > 0 || this.shield > 0) return;
      this.shield = 2.4;
      this.shieldCd = 7;
      audio.power();
    }
    cooldown() {
      const base = this.weapon === "laser" ? 0.55 : this.weapon === "spread" ? 0.22 : 0.16;
      return game.effects.rapid > 0 ? base * 0.35 : base;
    }
    shoot(game) {
      if (this.cool > 0) return;
      this.cool = this.cooldown();
      const nose = 20;
      const sx = this.x + Math.cos(this.aim) * nose;
      const sy = this.y + Math.sin(this.aim) * nose;
      if (this.weapon === "normal") {
        game.projectiles.push(new Projectile(sx, sy, this.aim, {
          speed: 720, r: 4, dmg: 18, from: "player", color: "#3ef6ff",
        }));
        audio.shoot();
      } else if (this.weapon === "spread") {
        for (let i = -2; i <= 2; i++) {
          game.projectiles.push(new Projectile(sx, sy, this.aim + i * 0.16, {
            speed: 680, r: 3, dmg: 9, from: "player", color: "#7af8ff",
          }));
        }
        audio.shoot();
      } else {
        const beam = new LaserBeam(sx, sy, this.aim, 58, "#ff4de8");
        game.lasers.push(beam);
        audio.laser();
      }
    }
    hit(game, dmg) {
      if (this.iframes > 0) return;
      if (this.shield > 0 || game.effects.shield > 0) {
        this.shield = Math.max(0, this.shield - 0.4);
        game.spawnBurst(this.x, this.y, "#3ef6ff", 10);
        return;
      }
      this.hp -= 1;
      this.iframes = 1.15;
      game.combo = 0;
      game.shake = 14;
      game.spawnBurst(this.x, this.y, "#ff4d6d", 18);
      game.floaters.push(new Floater(this.x, this.y - 20, "-1 LIFE", "#ff6b9d"));
      audio.hurt();
      if (this.hp <= 0) game.gameOver();
    }
    draw(c) {
      if (this.iframes > 0 && Math.floor(this.t * 18) % 2 === 0) return;
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.aim);
      if (this.engine > 40) {
        c.fillStyle = "#ff9f43";
        c.shadowColor = "#ff6b00";
        c.shadowBlur = 16;
        c.beginPath();
        c.moveTo(-18, -6);
        c.lineTo(-28 - Math.sin(this.t * 30) * 6, 0);
        c.lineTo(-18, 6);
        c.fill();
      }
      c.shadowColor = "#3ef6ff";
      c.shadowBlur = 18;
      c.fillStyle = "#9ffff8";
      c.beginPath();
      c.moveTo(18, 0);
      c.lineTo(-14, 12);
      c.lineTo(-8, 0);
      c.lineTo(-14, -12);
      c.closePath();
      c.fill();
      c.fillStyle = "#14243a";
      c.beginPath();
      c.arc(2, 0, 4, 0, Math.PI * 2);
      c.fill();
      if (this.shield > 0 || game.effects.shield > 0) {
        c.strokeStyle = "rgba(62,246,255,0.85)";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, 24 + Math.sin(this.t * 8) * 2, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    }
  }

  class Enemy {
    constructor(type, x, y, level) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.level = level;
      this.t = rand(0, 10);
      this.dead = false;
      this.flash = 0;
      const hpMul = 1 + (level - 1) * 0.18;
      const spdMul = 1 + (level - 1) * 0.06;
      if (type === "basic") {
        this.r = 14; this.hp = 28 * hpMul; this.speed = 92 * spdMul; this.dmg = 1; this.points = 40; this.color = "#4ade80";
      } else if (type === "fast") {
        this.r = 11; this.hp = 18 * hpMul; this.speed = 190 * spdMul; this.dmg = 1; this.points = 70; this.color = "#facc15";
      } else if (type === "tank") {
        this.r = 24; this.hp = 140 * hpMul; this.speed = 58 * spdMul; this.dmg = 1; this.points = 160; this.color = "#fb923c";
      } else if (type === "shooter") {
        this.r = 15; this.hp = 36 * hpMul; this.speed = 80 * spdMul; this.dmg = 1; this.points = 90; this.color = "#e879f9"; this.cool = rand(0.4, 1.2);
      } else {
        this.r = 16; this.hp = 30 * hpMul; this.speed = 100 * spdMul; this.dmg = 1; this.points = 50; this.color = "#67e8f9";
      }
      this.maxHp = this.hp;
    }
    update(dt, game) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      const p = game.player;
      const slow = game.effects.slow > 0 ? 0.42 : 1;
      let ang = angTo(this.x, this.y, p.x, p.y);
      if (this.type === "shooter") {
        const d = dist(this.x, this.y, p.x, p.y);
        if (d < 280) ang += Math.PI;
        else if (d < 360) ang += Math.PI / 2;
        this.cool = (this.cool || 0) - dt;
        if (this.cool <= 0 && d < 520) {
          this.cool = 1.35;
          game.projectiles.push(new Projectile(this.x, this.y, angTo(this.x, this.y, p.x, p.y), {
            speed: 280, r: 5, dmg: 1, from: "enemy", color: "#ff4d6d", life: 3,
          }));
        }
      }
      if (this.type === "fast") ang += Math.sin(this.t * 6) * 0.4;
      this.x += Math.cos(ang) * this.speed * slow * dt;
      this.y += Math.sin(ang) * this.speed * slow * dt;
      this.x = clamp(this.x, 16, WORLD_W - 16);
      this.y = clamp(this.y, 16, WORLD_H - 16);
    }
    hurt(game, dmg) {
      this.hp -= dmg;
      this.flash = 0.08;
      game.floaters.push(new Floater(this.x, this.y - this.r, `${Math.floor(dmg)}`, "#fff"));
      audio.hit();
      if (this.hp <= 0) this.kill(game);
    }
    kill(game) {
      this.dead = true;
      const mult = game.scoreMul();
      const pts = Math.floor(this.points * mult);
      game.addScore(pts, this.x, this.y);
      game.kills += 1;
      game.combo += 1;
      game.comboTimer = 2.4;
      game.spawnBurst(this.x, this.y, this.color, 22);
      if (Math.random() < 0.55) game.coins.push(new Coin(this.x, this.y, 20));
      audio.destroy();
    }
    draw(c) {
      c.save();
      c.translate(this.x, this.y);
      c.shadowColor = this.color;
      c.shadowBlur = 16;
      c.fillStyle = this.flash > 0 ? "#fff" : this.color;
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      if (this.type === "basic") {
        c.beginPath();
        c.arc(0, 0, this.r, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(0, 0, this.r * 0.45, 0, Math.PI * 2);
        c.stroke();
      } else if (this.type === "fast") {
        c.rotate(this.t * 8);
        c.beginPath();
        c.moveTo(0, -this.r); c.lineTo(this.r, 0); c.lineTo(0, this.r); c.lineTo(-this.r, 0);
        c.closePath(); c.fill();
      } else if (this.type === "tank") {
        c.rotate(this.t * 0.6);
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI * 2) / 6;
          i ? c.lineTo(Math.cos(a) * this.r, Math.sin(a) * this.r) : c.moveTo(Math.cos(a) * this.r, Math.sin(a) * this.r);
        }
        c.closePath(); c.fill(); c.stroke();
      } else {
        c.rotate(this.t * 2);
        c.beginPath();
        c.moveTo(0, -this.r); c.lineTo(this.r * 0.9, this.r); c.lineTo(-this.r * 0.9, this.r);
        c.closePath(); c.fill();
      }
      c.restore();
    }
  }

  class Boss {
    constructor(level) {
      this.isBoss = true;
      this.x = WORLD_W / 2;
      this.y = -80;
      this.r = 46;
      this.level = level;
      this.hp = 520 + level * 90;
      this.maxHp = this.hp;
      this.speed = 70;
      this.t = 0;
      this.phase = 0;
      this.dead = false;
      this.flash = 0;
      this.points = 1200 + level * 80;
      this.color = "#ff2d6a";
      this.entering = 2.2;
      this.cool = 0;
      this.pattern = 0;
    }
    update(dt, game) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.cool = Math.max(0, this.cool - dt);
      const slow = game.effects.slow > 0 ? 0.5 : 1;
      if (this.entering > 0) {
        this.entering -= dt;
        this.y = lerp(this.y, 150, 1 - Math.pow(0.02, dt));
        return;
      }
      const p = game.player;
      this.pattern = Math.floor(this.t / 4) % 3;
      if (this.pattern === 0) {
        const a = angTo(this.x, this.y, p.x, p.y);
        this.x += Math.cos(a) * this.speed * slow * dt;
        this.y += Math.sin(a) * this.speed * 0.7 * slow * dt;
        if (this.cool <= 0) {
          this.cool = 0.55;
          for (let i = -1; i <= 1; i++) {
            game.projectiles.push(new Projectile(this.x, this.y, a + i * 0.18, {
              speed: 260, r: 7, dmg: 1, from: "enemy", color: "#ff4d6d", life: 4,
            }));
          }
        }
      } else if (this.pattern === 1) {
        this.x += Math.cos(this.t * 1.2) * 90 * dt;
        this.y += Math.sin(this.t * 0.9) * 40 * dt;
        if (this.cool <= 0) {
          this.cool = 0.22;
          const n = this.t * 3;
          game.projectiles.push(new Projectile(this.x, this.y, n, {
            speed: 240, r: 5, dmg: 1, from: "enemy", color: "#ffa0c0", life: 4,
          }));
        }
      } else {
        if (this.cool <= 0) {
          this.cool = 1.1;
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2 + this.t;
            game.projectiles.push(new Projectile(this.x, this.y, a, {
              speed: 200, r: 6, dmg: 1, from: "enemy", color: "#ffd24a", life: 4,
            }));
          }
        }
      }
      this.x = clamp(this.x, 70, WORLD_W - 70);
      this.y = clamp(this.y, 70, WORLD_H - 90);
    }
    hurt(game, dmg) {
      if (this.entering > 0) return;
      this.hp -= dmg;
      this.flash = 0.08;
      game.floaters.push(new Floater(this.x, this.y - 50, `${Math.floor(dmg)}`, "#ffd24a"));
      audio.hit();
      if (this.hp <= 0) this.kill(game);
    }
    kill(game) {
      this.dead = true;
      game.bossKills += 1;
      const pts = Math.floor(this.points * game.scoreMul());
      game.addScore(pts, this.x, this.y);
      game.kills += 1;
      game.combo += 3;
      game.comboTimer = 3;
      game.shake = 22;
      game.spawnBurst(this.x, this.y, "#ff2d6a", 48);
      for (let i = 0; i < 8; i++) game.coins.push(new Coin(this.x + rand(-40, 40), this.y + rand(-40, 40), 50));
      game.powerups.push(new PowerUp(this.x, this.y + 30, pick(["shield", "rapid", "double", "health"])));
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 1);
      game.floaters.push(new Floater(this.x, this.y, "BOSS REWARD", "#ffd24a"));
      audio.bossOut();
      game.bossBanner = 0;
    }
    draw(c) {
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.t * 0.4);
      c.shadowColor = this.color;
      c.shadowBlur = 28;
      c.fillStyle = this.flash > 0 ? "#fff" : this.color;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8;
        const rr = i % 2 === 0 ? this.r : this.r * 0.62;
        i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
      c.fill();
      c.fillStyle = "#16020c";
      c.beginPath();
      c.arc(0, 0, 14, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  const game = {
    state: "MENU",
    player: new Player(),
    enemies: [],
    projectiles: [],
    lasers: [],
    particles: [],
    coins: [],
    powerups: [],
    floaters: [],
    stars: [],
    score: 0,
    high: scores.best(),
    level: 1,
    time: 0,
    spawnT: 0,
    dropT: 0,
    coinT: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    coinsGot: 0,
    bossKills: 0,
    shake: 0,
    levelFlash: 0,
    bossBanner: 0,
    pendingScore: 0,
    effects: { shield: 0, slow: 0, double: 0, rapid: 0 },
    last: 0,
    touchMode: false,
    bgT: 0,
  };

  function spawnStars() {
    game.stars = Array.from({ length: 90 }, () => ({
      x: rand(0, WORLD_W),
      y: rand(0, WORLD_H),
      z: rand(0.3, 1.6),
      s: rand(0.6, 2.2),
    }));
  }

  function resetRun() {
    game.player.reset();
    game.enemies = [];
    game.projectiles = [];
    game.lasers = [];
    game.particles = [];
    game.coins = [];
    game.powerups = [];
    game.floaters = [];
    game.score = 0;
    game.level = 1;
    game.time = 0;
    game.spawnT = 0;
    game.dropT = 4;
    game.coinT = 2;
    game.combo = 0;
    game.comboTimer = 0;
    game.kills = 0;
    game.coinsGot = 0;
    game.bossKills = 0;
    game.shake = 0;
    game.levelFlash = 0;
    game.bossBanner = 0;
    game.effects = { shield: 0, slow: 0, double: 0, rapid: 0 };
    spawnEdge("basic");
    spawnEdge("basic");
  }

  function scoreMul() {
    const combo = 1 + Math.min(4, game.combo * 0.12);
    const dbl = game.effects.double > 0 ? 2 : 1;
    return combo * dbl;
  }
  game.scoreMul = scoreMul;

  game.addScore = (n, x, y) => {
    game.score += n;
    if (x != null) game.floaters.push(new Floater(x, y - 10, `+${n}`, "#ffd24a"));
    if (game.score > game.high) game.high = game.score;
  };

  game.spawnBurst = (x, y, color, n) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 280);
      game.particles.push(new Particle(x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color, glow: color, life: rand(0.3, 0.8),
      }));
    }
  };

  game.nearestEnemy = () => {
    let best = null, bd = 1e9;
    for (const e of game.enemies) {
      const d = dist(game.player.x, game.player.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };

  function spawnEdge(type) {
    const side = randi(0, 3);
    let x, y;
    if (side === 0) { x = rand(0, WORLD_W); y = -20; }
    else if (side === 1) { x = rand(0, WORLD_W); y = WORLD_H + 20; }
    else if (side === 2) { x = -20; y = rand(0, WORLD_H); }
    else { x = WORLD_W + 20; y = rand(0, WORLD_H); }
    game.enemies.push(new Enemy(type, x, y, game.level));
  }

  function chooseEnemy() {
    const lv = game.level;
    const pool = ["basic"];
    if (lv >= 2) pool.push("fast", "fast");
    if (lv >= 3) pool.push("shooter");
    if (lv >= 4) pool.push("tank");
    if (lv >= 7) pool.push("shooter", "tank", "fast");
    return pick(pool);
  }

  function hasBoss() {
    return game.enemies.some((e) => e.isBoss);
  }

  function maybeBoss() {
    if (game.level % 5 !== 0) return;
    if (hasBoss()) return;
    if (game.bossBanner > 0) return;
    if (game._bossFor === game.level) return;
    game._bossFor = game.level;
    game.enemies.push(new Boss(game.level));
    game.bossBanner = 2.4;
    audio.bossIn();
  }

  game.gameOver = () => {
    game.state = "GAMEOVER";
    audio.over();
    const stats = document.getElementById("over-stats");
    stats.innerHTML = `
      <div>FINAL SCORE <b>${Math.floor(game.score)}</b></div>
      <div>HIGH SCORE <b>${Math.floor(Math.max(game.high, scores.best()))}</b></div>
      <div>LEVEL <b>${game.level}</b></div>
      <div>ENEMIES DEFEATED <b>${game.kills}</b></div>
      <div>COINS COLLECTED <b>${game.coinsGot}</b></div>
    `;
    if (scores.qualifies(game.score)) {
      game.pendingScore = game.score;
      showScreen("name");
      const inp = document.getElementById("name-input");
      inp.value = "";
      setTimeout(() => inp.focus(), 50);
    } else {
      showScreen("over");
    }
  };

  function applyPower(kind) {
    audio.power();
    game.addScore(Math.floor(40 * scoreMul()));
    if (kind === "health") {
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 2);
      return;
    }
    const d = POWER_DEFS[kind].dur;
    game.effects[kind] = Math.max(game.effects[kind], d);
    if (kind === "shield") game.player.shield = Math.max(game.player.shield, 5);
  }

  function updatePlaying(dt) {
    game.time += dt;
    game.bgT += dt;
    game.shake = Math.max(0, game.shake - dt * 28);
    game.levelFlash = Math.max(0, game.levelFlash - dt);
    game.bossBanner = Math.max(0, game.bossBanner - dt);
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) game.combo = 0;
    for (const k of Object.keys(game.effects)) game.effects[k] = Math.max(0, game.effects[k] - dt);

    const nextLevel = 1 + Math.floor(game.time / 24);
    if (nextLevel > game.level) {
      game.level = nextLevel;
      game.levelFlash = 1.6;
      audio.level();
      maybeBoss();
    }

    game.addScore(8 * dt * scoreMul());

    const bossAlive = hasBoss();
    game.spawnT -= dt;
    const spawnRate = Math.max(0.28, 1.35 - game.level * 0.08);
    if (!bossAlive && game.spawnT <= 0) {
      game.spawnT = spawnRate;
      const n = game.level >= 8 ? 2 : 1;
      for (let i = 0; i < n; i++) spawnEdge(chooseEnemy());
    } else if (bossAlive && game.spawnT <= 0 && game.level >= 10) {
      game.spawnT = spawnRate * 2.2;
      spawnEdge("basic");
    }

    game.dropT -= dt;
    if (game.dropT <= 0) {
      game.dropT = rand(10, 16);
      const kinds = ["shield", "slow", "double", "rapid", "health"];
      game.powerups.push(new PowerUp(rand(80, WORLD_W - 80), rand(80, WORLD_H - 80), pick(kinds)));
    }
    game.coinT -= dt;
    if (game.coinT <= 0) {
      game.coinT = rand(5, 9);
      game.coins.push(new Coin(rand(60, WORLD_W - 60), rand(60, WORLD_H - 60), 30));
    }

    game.player.update(dt, game);

    for (const e of game.enemies) e.update(dt, game);
    for (const p of game.projectiles) p.update(dt);
    for (const l of game.lasers) l.update(dt);
    for (const p of game.particles) p.update(dt);
    for (const c of game.coins) c.update(dt);
    for (const u of game.powerups) u.update(dt);
    for (const f of game.floaters) f.update(dt);

    collide();

    game.enemies = game.enemies.filter((e) => !e.dead);
    game.projectiles = game.projectiles.filter((p) => !p.dead);
    game.lasers = game.lasers.filter((l) => !l.dead);
    game.particles = game.particles.filter((p) => p.life > 0).slice(-420);
    game.floaters = game.floaters.filter((f) => f.life > 0);
    game.coins = game.coins.filter((c) => !c.dead);
    game.powerups = game.powerups.filter((p) => !p.dead);
  }

  function collide() {
    const p = game.player;
    for (const b of game.projectiles) {
      if (b.from === "player") {
        for (const e of game.enemies) {
          if (e.dead || b.dead) continue;
          if (dist(b.x, b.y, e.x, e.y) < b.r + e.r) {
            e.hurt(game, b.dmg);
            if (b.pierce > 0) b.pierce -= 1;
            else b.dead = true;
            game.spawnBurst(b.x, b.y, b.color, 6);
          }
        }
      } else if (dist(b.x, b.y, p.x, p.y) < b.r + p.r) {
        b.dead = true;
        p.hit(game, 1);
      }
    }
    for (const beam of game.lasers) {
      for (const e of game.enemies) {
        if (e.dead || beam.hits.has(e)) continue;
        if (beam.hitsEnemy(e)) {
          beam.hits.add(e);
          e.hurt(game, beam.dmg);
          game.spawnBurst(e.x, e.y, beam.color, 10);
        }
      }
    }
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (dist(e.x, e.y, p.x, p.y) < e.r + p.r - 4) {
        p.hit(game, 1);
        if (!e.isBoss) {
          e.x += (e.x - p.x) * 0.4;
          e.y += (e.y - p.y) * 0.4;
        }
      }
    }
    for (const c of game.coins) {
      if (dist(c.x, c.y, p.x, p.y) < c.r + p.r) {
        c.dead = true;
        game.coinsGot += 1;
        game.addScore(Math.floor(c.value * scoreMul()), c.x, c.y);
        game.spawnBurst(c.x, c.y, "#ffd24a", 14);
        audio.coin();
      }
    }
    for (const u of game.powerups) {
      if (dist(u.x, u.y, p.x, p.y) < u.r + p.r) {
        u.dead = true;
        applyPower(u.kind);
        game.spawnBurst(u.x, u.y, u.def.color, 16);
        game.floaters.push(new Floater(u.x, u.y, u.def.label, u.def.color));
      }
    }
  }

  function drawBg() {
    const g = ctx.createRadialGradient(WORLD_W * 0.5, WORLD_H * 0.45, 40, WORLD_W * 0.5, WORLD_H * 0.5, 640);
    g.addColorStop(0, "#12204a");
    g.addColorStop(0.45, "#0a1028");
    g.addColorStop(1, "#050712");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#3ef6ff";
    ctx.lineWidth = 1;
    const grid = 48;
    const ox = (game.bgT * 12) % grid;
    for (let x = -grid; x < WORLD_W + grid; x += grid) {
      ctx.beginPath(); ctx.moveTo(x + ox, 0); ctx.lineTo(x + ox, WORLD_H); ctx.stroke();
    }
    for (let y = -grid; y < WORLD_H + grid; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y + ox * 0.4); ctx.lineTo(WORLD_W, y + ox * 0.4); ctx.stroke();
    }
    ctx.restore();

    for (const s of game.stars) {
      s.y += s.z * 18 * (1 / 60);
      if (s.y > WORLD_H) s.y = 0;
      ctx.globalAlpha = 0.4 + s.z * 0.4;
      ctx.fillStyle = "#dbeafe";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(62,246,255,0.55)";
    ctx.shadowColor = "#3ef6ff";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, WORLD_W - 20, WORLD_H - 20);
    ctx.shadowBlur = 0;
  }

  function drawHud() {
    const p = game.player;
    ctx.textAlign = "left";
    ctx.font = "bold 18px Segoe UI";
    ctx.fillStyle = "#e8f7ff";
    ctx.shadowColor = "#3ef6ff";
    ctx.shadowBlur = 8;
    ctx.fillText(`SCORE  ${Math.floor(game.score)}`, 28, 42);
    ctx.fillText(`LEVEL  ${game.level}`, 28, 68);
    ctx.textAlign = "right";
    ctx.fillText(`HIGH  ${Math.floor(game.high)}`, WORLD_W - 28, 42);
    ctx.font = "bold 14px Segoe UI";
    ctx.fillText("LIVES", WORLD_W - 28 - p.maxHp * 22, 68);
    for (let i = 0; i < p.maxHp; i++) {
      const hx = WORLD_W - 28 - (p.maxHp - 1 - i) * 20;
      ctx.fillStyle = i < p.hp ? "#ff4d6d" : "#2a2030";
      ctx.shadowColor = i < p.hp ? "#ff4d6d" : "transparent";
      ctx.beginPath();
      ctx.arc(hx, 64, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
    const weaponName = p.weapon.toUpperCase();
    const active = Object.keys(game.effects).filter((k) => game.effects[k] > 0 && k !== "health");
    const powerLabel = active.length ? active.map((k) => POWER_DEFS[k].label).join(" · ") : "NONE";
    ctx.font = "bold 14px Segoe UI";
    ctx.fillStyle = "#3ef6ff";
    ctx.fillText(`WEAPON  ${weaponName}`, 28, WORLD_H - 48);
    ctx.fillStyle = "#ffd24a";
    ctx.fillText(`POWER-UP  ${powerLabel}`, 28, WORLD_H - 26);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff6b9d";
    ctx.fillText(`COMBO  x${(1 + Math.min(4, game.combo * 0.12)).toFixed(1)}  (${game.combo})`, WORLD_W - 28, WORLD_H - 36);

    const boss = game.enemies.find((e) => e.isBoss);
    if (boss) {
      const w = 520, h = 16;
      const x = (WORLD_W - w) / 2, y = 22;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x - 4, y - 18, w + 8, 42);
      ctx.fillStyle = "#ffd24a";
      ctx.textAlign = "center";
      ctx.font = "bold 12px Segoe UI";
      ctx.fillText("BOSS", WORLD_W / 2, y - 4);
      ctx.fillStyle = "#2a1018";
      ctx.fillRect(x, y + 6, w, h);
      ctx.fillStyle = "#ff2d6a";
      ctx.shadowColor = "#ff2d6a";
      ctx.shadowBlur = 12;
      ctx.fillRect(x, y + 6, w * clamp(boss.hp / boss.maxHp, 0, 1), h);
      ctx.shadowBlur = 0;
    }

    if (game.levelFlash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(game.levelFlash, 0, 1);
      ctx.fillStyle = "#3ef6ff";
      ctx.textAlign = "center";
      ctx.font = "bold 64px Segoe UI";
      ctx.shadowColor = "#3ef6ff";
      ctx.shadowBlur = 24;
      ctx.fillText("LEVEL UP", WORLD_W / 2, WORLD_H / 2 - 20);
      ctx.font = "bold 22px Segoe UI";
      ctx.fillText(`LEVEL ${game.level}`, WORLD_W / 2, WORLD_H / 2 + 24);
      ctx.restore();
    }
    if (game.bossBanner > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(game.bossBanner, 0, 1);
      ctx.fillStyle = "#ff2d6a";
      ctx.textAlign = "center";
      ctx.font = "bold 42px Segoe UI";
      ctx.shadowColor = "#ff2d6a";
      ctx.shadowBlur = 20;
      ctx.fillText("WARNING  //  BOSS INCOMING", WORLD_W / 2, 130);
      ctx.restore();
    }
  }

  function drawMenuBackdrop() {
    drawBg();
    ctx.save();
    ctx.translate(WORLD_W / 2, WORLD_H / 2 + 40);
    ctx.rotate(game.bgT * 0.2);
    ctx.strokeStyle = "rgba(255,61,240,0.25)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 90 + i * 70, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(window.innerWidth / WORLD_W, window.innerHeight / WORLD_H);
    const cssW = WORLD_W * scale;
    const cssH = WORLD_H * scale;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(WORLD_W * dpr);
    canvas.height = Math.floor(WORLD_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop(ts) {
    if (!game.last) game.last = ts;
    let dt = (ts - game.last) / 1000;
    game.last = ts;
    dt = clamp(dt, 0, 0.05);
    game.bgT += dt;

    if (game.state === "PLAYING") {
      if (input.pauseQueued) {
        input.pauseQueued = false;
        game.state = "PAUSED";
        showScreen("pause");
      } else {
        updatePlaying(dt);
      }
    } else if (input.pauseQueued && game.state === "PAUSED") {
      input.pauseQueued = false;
      resume();
    } else {
      input.pauseQueued = false;
    }

    const sx = (Math.random() - 0.5) * game.shake;
    const sy = (Math.random() - 0.5) * game.shake;
    ctx.save();
    ctx.translate(sx, sy);
    if (game.state === "MENU" || game.state === "HOW" || game.state === "SCORES") drawMenuBackdrop();
    else {
      drawBg();
      for (const c of game.coins) c.draw(ctx);
      for (const u of game.powerups) u.draw(ctx);
      for (const p of game.projectiles) p.draw(ctx);
      for (const l of game.lasers) l.draw(ctx);
      for (const e of game.enemies) e.draw(ctx);
      if (game.state !== "MENU") game.player.draw(ctx);
      for (const p of game.particles) p.draw(ctx);
      for (const f of game.floaters) f.draw(ctx);
      if (game.state === "PLAYING" || game.state === "PAUSED" || game.state === "GAMEOVER") drawHud();
    }
    ctx.restore();
    requestAnimationFrame(loop);
  }

  function startGame() {
    audio.ensure();
    resetRun();
    game._bossFor = 0;
    input.pauseQueued = false;
    input.shieldQueued = false;
    input.mouse.down = false;
    input.touchShoot = false;
    game.state = "PLAYING";
    game.last = 0;
    showScreen(null);
  }

  function resume() {
    game.state = "PLAYING";
    showScreen(null);
    game.last = 0;
  }

  function toMenu() {
    game.state = "MENU";
    showScreen("menu");
  }

  function setupJoystick() {
    const stick = document.getElementById("joystick");
    const knob = document.getElementById("joystick-knob");
    let pid = null;
    const max = 40;
    function setFrom(clientX, clientY) {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx, dy = clientY - cy;
      const m = Math.hypot(dx, dy);
      if (m > max) { dx = (dx / m) * max; dy = (dy / m) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.joy.x = dx / max;
      input.joy.y = dy / max;
    }
    function end() {
      pid = null;
      input.joy.x = 0;
      input.joy.y = 0;
      knob.style.transform = "translate(0,0)";
    }
    stick.addEventListener("pointerdown", (e) => {
      pid = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      setFrom(e.clientX, e.clientY);
    });
    stick.addEventListener("pointermove", (e) => { if (e.pointerId === pid) setFrom(e.clientX, e.clientY); });
    stick.addEventListener("pointerup", end);
    stick.addEventListener("pointercancel", end);
  }

  function setupUI() {
    document.getElementById("btn-start").onclick = startGame;
    document.getElementById("btn-how").onclick = () => { game.state = "HOW"; showScreen("how"); };
    document.getElementById("btn-scores").onclick = () => {
      scores.render(document.getElementById("score-list"));
      game.state = "SCORES";
      showScreen("scores");
    };
    document.getElementById("btn-how-back").onclick = toMenu;
    document.getElementById("btn-scores-back").onclick = toMenu;
    document.getElementById("btn-resume").onclick = resume;
    document.getElementById("btn-pause-menu").onclick = toMenu;
    document.getElementById("btn-restart").onclick = startGame;
    document.getElementById("btn-over-menu").onclick = toMenu;
    document.getElementById("btn-save-name").onclick = () => {
      const name = document.getElementById("name-input").value.trim() || "ACE";
      scores.add(name, game.pendingScore);
      game.high = scores.best();
      showScreen("over");
    };
    document.getElementById("name-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("btn-save-name").click();
    });

    const muteBtn = document.getElementById("btn-mute");
    const syncMute = () => {
      muteBtn.classList.toggle("muted", audio.muted);
      muteBtn.textContent = audio.muted ? "MUTE" : "♪";
    };
    syncMute();
    muteBtn.onclick = () => { audio.setMuted(!audio.muted); syncMute(); };

    document.getElementById("btn-shoot-mobile").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      input.touchShoot = true;
      audio.ensure();
    });
    window.addEventListener("pointerup", () => { input.touchShoot = false; });
    document.getElementById("btn-shield-mobile").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      input.shieldQueued = true;
    });
    document.getElementById("btn-pause-mobile").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      input.pauseQueued = true;
    });

    const touchOn = () => {
      game.touchMode = true;
      document.body.classList.add("touch");
    };
    window.addEventListener("touchstart", touchOn, { passive: true, once: true });
    if (navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches) touchOn();

    setupJoystick();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    }, { passive: false });
  }

  spawnStars();
  input.attach();
  setupUI();
  resize();
  requestAnimationFrame(loop);
})();
