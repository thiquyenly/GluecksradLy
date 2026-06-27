/* =====================================================================
   GLÜCKSRAD – LOGIK (script.js)
   ---------------------------------------------------------------------
   Hier passiert das "Denken" der App:
   - Antwort-Zeilen verwalten
   - das Rad als SVG zeichnen
   - per ABSTIMMUNGSFAKTOR einen Gewinner auslosen
   - das Rad 5 Sekunden drehen und beim Gewinner stoppen
   - Spannungs- und Siegestöne erzeugen
   ===================================================================== */

"use strict";

/* ---- A. Feste Farbpalette für die Tortenstücke ---- */
const SEGMENT_COLORS = [
  "#ff2e9a", "#00f0ff", "#ffd23f", "#8cff5a",
  "#a06bff", "#ff7b3d", "#3dffd0", "#ff5470",
];

/* ---- B. Wichtige HTML-Elemente einmalig "greifen" ---- */
const el = {
  question:    document.getElementById("question"),
  answerList:  document.getElementById("answer-list"),
  addAnswer:   document.getElementById("add-answer"),
  spin:        document.getElementById("spin"),
  wheel:       document.getElementById("wheel"),
  bulbs:       document.getElementById("bulbs"),
  pins:        document.getElementById("pins"),
  rays:        document.getElementById("rays"),
  flapper:     document.getElementById("flapper"),
  overlay:     document.getElementById("result-overlay"),
  confetti:    document.getElementById("confetti"),
  resultText:  document.getElementById("result-answer"),
  resultClose: document.getElementById("result-close"),
  optProportional: document.getElementById("opt-proportional"),
  optSound:    document.getElementById("opt-sound"),
  spinMessage: document.getElementById("spin-message"),
  startOverlay: document.getElementById("start-overlay"),
  startBtn:    document.getElementById("start-btn"),
  openLiveBtn: document.getElementById("open-live"),
  liveOverlay: document.getElementById("live-overlay"),
  liveQuestion: document.getElementById("live-question"),
  liveQr:      document.getElementById("live-qr"),
  liveUrl:     document.getElementById("live-url"),
  liveFactorMode: document.getElementById("live-factor-mode"),
  liveIdeas:   document.getElementById("live-ideas"),
  liveCancelBtn: document.getElementById("live-cancel"),
  liveFinishBtn: document.getElementById("live-finish"),
  openRoomBtn: document.getElementById("open-room"),
  roomOverlay: document.getElementById("room-overlay"),
  roomQuestion: document.getElementById("room-question"),
  roomOptions: document.getElementById("room-options"),
  roomTally:   document.getElementById("room-tally"),
  roomCancelBtn: document.getElementById("room-cancel"),
  roomFinishBtn: document.getElementById("room-finish"),
};

/* ---- C. Zustand der App ---- */
let isSpinning = false;       // verhindert Doppel-Drehen
let currentRotation = 0;      // aktuelle Raddrehung in Grad (summiert sich auf)
let segments = [];            // zuletzt gezeichnete Segmente (für die Auslosung)
let spinMessageTimer = null;  // blendet die Fehlermeldung automatisch wieder aus

/* =====================================================================
   D. ANTWORT-ZEILEN
   ===================================================================== */

/* Erstellt eine einzelne Zeile mit Farbpunkt, Textfeld, Faktor-Feld, Löschen */
function makeAnswerRow(text = "", factor = 1) {
  const li = document.createElement("li");
  li.className = "answer-row";
  li.innerHTML = `
    <span class="swatch"></span>
    <input type="text" class="text-input answer-text" placeholder="Antwort eingeben" value="${escapeHtml(text)}" maxlength="40" />
    <input type="number" class="factor-input answer-factor" min="1" max="99" value="${factor}" title="Abstimmungsfaktor" />
    <button type="button" class="remove-answer" title="Entfernen">×</button>
  `;
  // Löschen-Knopf verbinden
  li.querySelector(".remove-answer").addEventListener("click", () => {
    li.remove();
    drawWheel();
  });
  // Bei jeder Änderung das Rad neu zeichnen
  li.querySelector(".answer-text").addEventListener("input", drawWheel);
  li.querySelector(".answer-factor").addEventListener("input", drawWheel);
  return li;
}

/* Liest alle gültigen Antworten (mit Text) aus den Eingabefeldern */
function readAnswers() {
  const rows = [...el.answerList.querySelectorAll(".answer-row")];
  const result = [];
  rows.forEach((row, i) => {
    const text = row.querySelector(".answer-text").value.trim();
    let factor = parseInt(row.querySelector(".answer-factor").value, 10);
    if (!Number.isFinite(factor) || factor < 1) factor = 1;
    if (text !== "") {
      result.push({ text, factor, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] });
    }
  });
  return result;
}

/* =====================================================================
   E. DAS RAD ZEICHNEN (als SVG)
   ===================================================================== */
function drawWheel() {
  const answers = readAnswers();

  // Farbpunkte in den Zeilen aktualisieren
  [...el.answerList.querySelectorAll(".answer-row")].forEach((row, i) => {
    row.querySelector(".swatch").style.color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
    row.querySelector(".swatch").style.background = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
  });

  el.wheel.innerHTML = ""; // alte Zeichnung löschen
  segments = [];

  if (answers.length === 0) {
    // Leeres Rad mit Hinweis
    el.wheel.innerHTML = `
      <circle cx="200" cy="200" r="198" fill="#160a33"/>
      <text x="200" y="205" text-anchor="middle" fill="#b7a7d9"
            font-family="Outfit" font-size="18">Antworten eingeben</text>`;
    return;
  }

  // Sichtbare Größe der Stücke bestimmen.
  // Standard: alle gleich groß. Mit Option: proportional zum Faktor.
  const proportional = el.optProportional.checked;
  const weights = answers.map(a => (proportional ? a.factor : 1));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const cx = 200, cy = 200, r = 198;
  let startAngle = -90; // oben beginnen (dort steht der Zeiger)

  answers.forEach((a, i) => {
    const sweep = (weights[i] / totalWeight) * 360; // Winkel dieses Stücks
    const endAngle = startAngle + sweep;

    // Tortenstück als SVG-Pfad
    const path = describeArc(cx, cy, r, startAngle, endAngle);
    const slice = document.createElementNS("http://www.w3.org/2000/svg", "path");
    slice.setAttribute("d", path);
    slice.setAttribute("fill", a.color);
    slice.setAttribute("stroke", "rgba(0,0,0,.25)");
    slice.setAttribute("stroke-width", "1");
    el.wheel.appendChild(slice);

    // Beschriftung in die Mitte des Stücks setzen
    const mid = startAngle + sweep / 2;
    const labelPos = polarToCartesian(cx, cy, r * 0.60, mid);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", labelPos.x);
    label.setAttribute("y", labelPos.y);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");
    label.setAttribute("fill", "#1a0033");
    label.setAttribute("font-family", "Outfit, sans-serif");
    label.setAttribute("font-weight", "800");
    label.setAttribute("font-size", answers.length > 8 ? "13" : (answers.length > 5 ? "15" : "18"));
    // Text quer im Stück ausrichten (wie am Anfang)
    label.setAttribute("transform", `rotate(${mid} ${labelPos.x} ${labelPos.y})`);
    label.textContent = trim(a.text, answers.length > 8 ? 10 : 14);
    label.dataset.index = i;   // merken, welches Segment dazugehört
    label.dataset.mid = mid;   // Grundwinkel merken (für spätere Neuausrichtung)
    el.wheel.appendChild(label);

    // Stück merken (Winkelbereich für die Auslosung)
    segments.push({ ...a, startAngle, endAngle, mid });
    startAngle = endAngle;
  });

  // Viele goldene Stäbe gleichmäßig rundherum (wie im Original, fein verteilt)
  buildPins(36);
  // Klacken aber nur an den Antwort-Grenzen (langsameres, schöneres Geräusch)
  clackCount = answers.length;
}

/* =====================================================================
   F. GEWICHTETE AUSLOSUNG (der eigentliche Abstimmungsfaktor)
   ---------------------------------------------------------------------
   "Lostopf-Prinzip": Eine Antwort mit Faktor 5 bekommt 5 Lose,
   eine mit Faktor 1 nur 1 Los. Dann wird zufällig ein Los gezogen.
   ===================================================================== */
function pickWinnerIndex(answers) {
  const totalFactor = answers.reduce((s, a) => s + a.factor, 0);
  let ticket = Math.random() * totalFactor; // Zufallszahl im "Topf"
  for (let i = 0; i < answers.length; i++) {
    ticket -= answers[i].factor;
    if (ticket < 0) return i; // dieses Los gehört Antwort i
  }
  return answers.length - 1; // Sicherheitsnetz
}

/* Zeigt eine Fehlermeldung im Design der App (statt Browser-alert)
   und lässt den DREHEN-Button kurz wackeln, um Aufmerksamkeit zu lenken. */
function showSpinMessage(text) {
  el.spinMessage.textContent = text;
  el.spinMessage.hidden = false;
  el.spin.classList.remove("shake");
  void el.spin.offsetWidth; // erzwingt Neustart der Animation
  el.spin.classList.add("shake");
  clearTimeout(spinMessageTimer);
  spinMessageTimer = setTimeout(hideSpinMessage, 4500);
}
function hideSpinMessage() {
  el.spinMessage.hidden = true;
  clearTimeout(spinMessageTimer);
}

/* =====================================================================
   G. DREHEN
   ===================================================================== */
function spin() {
  if (isSpinning) return;
  const answers = readAnswers();
  if (answers.length < 2) {
    showSpinMessage("Bitte mindestens zwei Antworten eingeben – sonst gibt es nichts auszulosen.");
    return;
  }
  hideSpinMessage(); // alte Meldung verschwindet, sobald es weitergeht

  isSpinning = true;
  el.spin.disabled = true;
  el.bulbs.classList.add("fast"); // Lampen blinken schneller
  el.rays.classList.add("fast");  // Strahlen leuchten kräftiger
  stopBackgroundMusic();          // Musik aus, damit der Spannungston frei klingt

  // 1) Gewinner per Faktor auslosen
  const winnerIndex = pickWinnerIndex(answers);
  const winner = segments[winnerIndex];

  // 2) Zielwinkel berechnen: Mitte des Gewinner-Stücks soll oben (beim Zeiger) landen.
  const extraTurns = 5; // volle Umdrehungen
  const targetUnderPointer = -90;
  let delta = targetUnderPointer - (winner.mid + currentRotation);
  delta = ((delta % 360) + 360) % 360;
  const startRotation = currentRotation;
  currentRotation += delta + extraTurns * 360;
  const totalTravel = currentRotation - startRotation; // gesamte Drehung in Grad

  // 3) Spannungston starten
  if (el.optSound.checked) playSuspense();

  // 4) Animation auslösen (CSS macht die 5-Sekunden-Drehung)
  el.wheel.style.transform = `rotate(${currentRotation}deg)`;

  // 5) Klack-Geräusch synchron erzeugen, solange das Rad dreht
  startTicking(startRotation, totalTravel);

  // 6) Nach genau 8 Sekunden: Ergebnis zeigen
  setTimeout(() => finishSpin(winner.text), 8000);
}

/* Verfolgt die Raddrehung Frame für Frame und löst bei jedem Pin,
   der am Zeiger vorbeikommt, ein Klack + Flapper-Zucken aus.
   Die Bewegungskurve entspricht der CSS-Animation (erst schnell, dann langsam). */
function startTicking(startRotation, totalTravel) {
  const duration = 8000;
  const t0 = performance.now();
  let lastFlapPassed = 0;   // zählt jeden Stift (visuelles Zucken)
  let lastClackPassed = 0;  // zählt nur die Antwort-Grenzen (Geräusch)

  function frame(now) {
    const elapsed = now - t0;
    let progress = Math.min(elapsed / duration, 1);
    // gleiche Verlangsamung wie die CSS-Kurve (easeOut): am Ende langsam
    const eased = 1 - Math.pow(1 - progress, 3);
    const rotated = eased * totalTravel; // wie weit das Rad schon gedreht hat

    // Visuell: Zeiger zuckt bei JEDEM goldenen Stift (wirkt durchgängig echt)
    const degPerPin = 360 / Math.max(pinCount, 1);
    const flapsPassed = Math.floor(rotated / degPerPin);
    if (flapsPassed > lastFlapPassed) {
      lastFlapPassed = flapsPassed;
      flapOnce();
    }

    // Hörbar: Klack-Geräusch nur an den Antwort-Grenzen (ruhigerer Rhythmus)
    const degPerClack = 360 / Math.max(clackCount, 1);
    const clacksPassed = Math.floor(rotated / degPerClack);
    if (clacksPassed > lastClackPassed) {
      lastClackPassed = clacksPassed;
      if (el.optSound.checked) clack();
    }

    if (progress < 1 && isSpinning) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* Lässt den Zeiger einmal kurz ausschlagen (ohne Ton) */
function flapOnce() {
  el.flapper.classList.remove("tick");
  void el.flapper.offsetWidth; // erzwingt Neustart der CSS-Animation
  el.flapper.classList.add("tick");
}

function finishSpin(winnerText) {
  isSpinning = false;
  el.spin.disabled = false;
  el.bulbs.classList.remove("fast");
  el.rays.classList.remove("fast");

  if (el.optSound.checked) { stopSuspense(); playFanfare(); playApplause(); }

  el.resultText.textContent = winnerText;
  el.overlay.hidden = false;
  launchConfetti(); // bunte Schnipsel + goldenes Feuerwerk
}

/* =====================================================================
   H. TÖNE (Web Audio API – im Browser erzeugt, keine Dateien nötig)
   ===================================================================== */
let audioCtx = null;
let suspenseTimer = null;

/* ---- Begrüßung: gesprochener Willkommens-Satz ---- */
function speakWelcome() {
  // Zuerst versuchen, eine eigene MP3 abzuspielen (sounds/welcome.mp3)
  const welcomeAudio = new Audio("sounds/welcome.mp3");
  welcomeAudio.play().catch(() => {
    // Keine Datei -> Sprachausgabe des Browsers nutzen
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance("Willkommen zum legendären Glücksrad!");
    utter.lang = "de-DE";
    utter.rate = 1.0;
    utter.pitch = 0.8;   // etwas tiefer = männlicher Eindruck
    // Falls verfügbar, eine männliche deutsche Stimme auswählen
    const voices = window.speechSynthesis.getVoices();
    const male = voices.find(v => v.lang.startsWith("de") &&
      /male|männ|stefan|markus|conrad|hans/i.test(v.name));
    const german = voices.find(v => v.lang.startsWith("de"));
    utter.voice = male || german || null;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

/* ---- Motivierende Hintergrundmusik (fröhliche Melodie-Schleife) ---- */
let bgmTimer = null;
let bgmAudio = null;
function startBackgroundMusic() {
  // Zuerst eigene MP3 versuchen (sounds/music.mp3)
  bgmAudio = new Audio("sounds/music.mp3");
  bgmAudio.loop = true;
  bgmAudio.volume = 0.4;
  bgmAudio.play().catch(() => {
    // Keine Datei -> fröhliche Melodie im Browser erzeugen
    bgmAudio = null;
    playSynthMusic();
  });
}
function playSynthMusic() {
  const ctx = getAudio();
  if (ctx.state === "suspended") ctx.resume();
  // Eine kurze, fröhliche Tonfolge, die sich wiederholt
  const melody = [523, 659, 784, 659, 587, 784, 880, 784];
  let i = 0;
  bgmTimer = setInterval(() => {
    const f = melody[i % melody.length];
    beep(f, 220, "triangle", 0.05);          // leise Melodie
    beep(f / 2, 220, "sine", 0.03);          // sanfter Bass darunter
    i++;
  }, 260);
}
function stopBackgroundMusic() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  if (bgmAudio) { bgmAudio.pause(); bgmAudio = null; }
}

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/* Ein Ton mit Frequenz, Dauer, Klangfarbe und Lautstärke.
   Klingt sanft ein und aus, damit es voller und weniger nach "Piep" klingt. */
function beep(freq, durationMs, type = "triangle", volume = 0.15, startDelay = 0) {
  const ctx = getAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain).connect(ctx.destination);
  const t0 = ctx.currentTime + startDelay;
  const dur = durationMs / 1000;
  // Hüllkurve: leise -> laut (Attack) -> leise (Release)
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur);
}

/* Spannungsmusik: treibender Show-Puls mit Bass-Schlag, der schneller wird */
function playSuspense() {
  const ctx = getAudio();
  if (ctx.state === "suspended") ctx.resume();
  let step = 0;
  // aufsteigende Tonleiter, die sich wiederholt (Show-Spannung)
  const scale = [392, 440, 494, 523, 587, 659];
  suspenseTimer = setInterval(() => {
    const note = scale[step % scale.length];
    beep(note, 130, "sawtooth", 0.09);          // Melodie-Ton
    beep(note * 2, 90, "triangle", 0.04);        // höhere Oktave als Glanz
    if (step % 2 === 0) beep(98, 150, "sine", 0.18); // tiefer Bass-Schlag im Takt
    step++;
  }, 150);
}
/* Ein einzelner Hand-Klatscher: sehr kurzer, gefilterter Rausch-Impuls */
function singleClap(timeOffset, volume) {
  const ctx = getAudio();
  const start = ctx.currentTime + timeOffset;
  const len = 0.07;
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const fade = 1 - i / d.length;       // schneller Abfall = "Klatsch"
    d[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400 + Math.random() * 800; // jede Hand klingt etwas anders
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(start);
  src.stop(start + len);
}

/* Spielt echten Applaus aus der Datei sounds/applause.mp3 ab.
   Liegt keine Datei vor, wird der synthetische Applaus als Ersatz benutzt. */
let applauseAudio = null;
function playApplause(durationMs = 3600) {
  // Audio-Element einmalig anlegen
  if (!applauseAudio) {
    applauseAudio = new Audio("sounds/applause.mp3");
    applauseAudio.preload = "auto";
  }
  // Versuchen, die Datei abzuspielen
  applauseAudio.currentTime = 0;
  const attempt = applauseAudio.play();
  if (attempt && attempt.catch) {
    attempt.catch(() => {
      // Keine Datei vorhanden oder Fehler -> synthetischer Applaus als Notlösung
      playSyntheticApplause(durationMs);
    });
  }
  limitApplauseTo(15000); // Datei kann länger sein – hier hart auf 15s begrenzen
}

/* Stoppt die Applaus-MP3 nach einer festen Dauer, ohne Überblendung. */
let applauseLimitTimer = null;
function limitApplauseTo(maxMs) {
  clearTimeout(applauseLimitTimer);
  applauseLimitTimer = setTimeout(() => {
    applauseAudio.pause();
    applauseAudio.currentTime = 0;
  }, maxMs);
}

/* Stoppt den Applaus sofort, z. B. wenn das Ergebnis-Fenster geschlossen wird */
function stopApplause() {
  clearTimeout(applauseLimitTimer);
  if (applauseAudio) {
    applauseAudio.pause();
    applauseAudio.currentTime = 0;
  }
}

/* Ersatz-Applaus, falls keine MP3 hinterlegt ist (rein im Browser erzeugt) */
function playSyntheticApplause(durationMs = 3600) {
  const ctx = getAudio();
  if (ctx.state === "suspended") ctx.resume();
  const dur = durationMs / 1000;

  // Klatschen: einzelne Hände, leicht zufällig versetzt
  let t = 0;
  while (t < dur) {
    const handsAtOnce = 6 + Math.floor(Math.random() * 8);
    for (let h = 0; h < handsAtOnce; h++) {
      const jitter = Math.random() * 0.08;
      const swell = Math.min(t * 2.5, 1);
      singleClap(t + jitter, (0.05 + Math.random() * 0.06) * swell);
    }
    t += 0.13 + Math.random() * 0.06;
  }

  // Jubelstimmen
  const voices = [150, 196, 246, 175, 220, 262];
  voices.forEach(base => {
    const start = ctx.currentTime + Math.random() * 1.2;
    const len = 0.9 + Math.random() * 0.8;
    [1, 2].forEach(mult => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      osc.type = mult === 1 ? "sawtooth" : "triangle";
      const f = base * mult;
      osc.frequency.setValueAtTime(f * 0.9, start);
      osc.frequency.linearRampToValueAtTime(f * 1.15, start + len * 0.35);
      osc.frequency.linearRampToValueAtTime(f * 0.85, start + len);
      vib.frequency.value = 5.5 + Math.random() * 2;
      vibGain.gain.value = f * 0.025;
      vib.connect(vibGain).connect(osc.frequency);
      const formant = ctx.createBiquadFilter();
      formant.type = "bandpass";
      formant.frequency.value = 800 + Math.random() * 300;
      formant.Q.value = 5;
      const vol = mult === 1 ? 0.09 : 0.04;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
      osc.connect(formant).connect(gain).connect(ctx.destination);
      osc.start(start); osc.stop(start + len);
      vib.start(start); vib.stop(start + len);
    });
  });
}

function stopSuspense() {
  if (suspenseTimer) { clearInterval(suspenseTimer); suspenseTimer = null; }
}

/* Das berühmte "Klack": ein sehr kurzer, trockener Schlag,
   wenn der Zeiger gegen einen Stab schlägt. */
function clack() {
  const ctx = getAudio();
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  // Kurzes Rauschen für den "Holz/Plastik"-Anschlag
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.04); // schneller Abfall = "Klack"
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}

/* Spielt einen Akkord: mehrere Töne gleichzeitig (klingt voll, nicht "piepsig") */
function chord(freqs, durationMs, volume, startDelay) {
  freqs.forEach(f => beep(f, durationMs, "triangle", volume, startDelay));
}

/* Siegesfanfare im Show-Stil: aufsteigende Akkorde + krönender Schlussakkord */
function playFanfare() {
  const ctx = getAudio();
  if (ctx.state === "suspended") ctx.resume();
  // Drei kurze Akkorde, die hochsteigen (typischer "Tah-Tah-Taaah"-Effekt)
  chord([392, 523, 659], 200, 0.16, 0.00);  // G-Dur
  chord([440, 587, 698], 200, 0.16, 0.18);  // höher
  chord([523, 659, 784], 260, 0.18, 0.36);  // noch höher
  // Krönender, langer Schlussakkord (C-Dur, breit gestreut)
  chord([523, 659, 784, 1047], 900, 0.20, 0.62);
  beep(262, 900, "sine", 0.16, 0.62);        // tiefer Grundton als Fundament
}

/* =====================================================================
   I. HILFSFUNKTIONEN
   ===================================================================== */

/* Winkel/Radius -> x/y-Koordinate */
function polarToCartesian(cx, cy, radius, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

/* Erzeugt den SVG-Pfad für ein Tortenstück zwischen zwei Winkeln */
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

/* Text kürzen, falls zu lang fürs Rad */
function trim(s, max) { return s.length > max ? s.slice(0, max - 1) + "…" : s; }

/* =====================================================================
   KONFETTI + GOLDENES FEUERWERK: explodiert aus der Mitte
   ===================================================================== */
let confettiAnim = null;
function launchConfetti() {
  const canvas = el.confetti;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const colors = ["#ff2e9a", "#00f0ff", "#ffd23f", "#8cff5a", "#a06bff", "#ff7b3d"];
  const golds = ["#ffd23f", "#fff3b0", "#ffae00", "#fff7d6"];

  const pieces = [];   // buntes Konfetti
  const sparks = [];   // goldene Feuerwerks-Funken

  // Buntes Konfetti: fliegt kräftig aus der Mitte in alle Richtungen
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = 9 + Math.random() * 15;        // kräftiger Ausbruch
    pieces.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      spin: -8 + Math.random() * 16,
    });
  }

  // Goldenes Feuerwerk: mehrere Explosions-Ringe, zeitversetzt gezündet
  function addFireworkRing(originX, originY, delayFrames) {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const power = 7 + Math.random() * 5;
      sparks.push({
        x: originX, y: originY,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        color: golds[Math.floor(Math.random() * golds.length)],
        life: 0, maxLife: 70 + Math.random() * 20,
        delay: delayFrames,
        size: 2.5 + Math.random() * 2,
      });
    }
  }
  // ein großer Ring in der Mitte, dazu kleinere ringsum, leicht versetzt
  addFireworkRing(cx, cy, 0);
  addFireworkRing(cx - 180, cy - 90, 18);
  addFireworkRing(cx + 180, cy - 70, 30);
  addFireworkRing(cx, cy + 120, 44);

  let frame = 0;
  const startTime = performance.now();
  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Buntes Konfetti zeichnen
    pieces.forEach(p => {
      p.vy += 0.12;        // sanfte Schwerkraft erst nach dem Knall
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.rot += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    // Goldene Funken zeichnen (mit leuchtendem Schweif)
    sparks.forEach(s => {
      if (frame < s.delay) return;     // noch nicht gezündet
      s.life++;
      s.vy += 0.06;                    // Funken sinken langsam
      s.vx *= 0.97; s.vy *= 0.97;
      s.x += s.vx; s.y += s.vy;
      const fade = Math.max(1 - s.life / s.maxLife, 0);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = s.color;
      ctx.shadowColor = "#ffd23f";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    frame++;
    if (now - startTime < 4500) {
      confettiAnim = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  cancelAnimationFrame(confettiAnim);
  confettiAnim = requestAnimationFrame(draw);
}

/* Sonderzeichen für sicheres Einfügen entschärfen */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Glühbirnen-Kranz rund ums Rad erzeugen */
function buildBulbs(count = 24) {
  const radius = 50; // in Prozent vom Container -> über translate gelöst
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    const bulb = document.createElement("div");
    bulb.className = "bulb" + (i % 2 ? " odd" : "");
    // vom Mittelpunkt aus nach außen schieben
    const x = Math.cos(angle) * 48;
    const y = Math.sin(angle) * 48;
    bulb.style.transform = `translate(${x * 5}px, ${y * 5}px)`;
    bulb.style.left = `calc(50% + ${x}%)`;
    bulb.style.top  = `calc(50% + ${y}%)`;
    el.bulbs.appendChild(bulb);
  }
}

/* Goldene Stäbe (Pins) am Radrand erzeugen – einen pro Segmentgrenze.
   Diese Pins lösen beim Vorbeidrehen das Klack-Geräusch aus. */
let pinCount = 0;
let clackCount = 0; // wie viele Klacks pro Umdrehung (= Anzahl Antworten)
function buildPins(count) {
  pinCount = count;
  el.pins.innerHTML = "";
  for (let i = 0; i < count; i++) {
    // -90° = oben starten, passend zu den Segmentgrenzen
    const angleDeg = -90 + (i / count) * 360;
    const a = (angleDeg * Math.PI) / 180;
    const pin = document.createElement("div");
    pin.className = "pin";
    const x = Math.cos(a) * 50; // knapp am Rand
    const y = Math.sin(a) * 50;
    pin.style.left = `calc(50% + ${x}%)`;
    pin.style.top  = `calc(50% + ${y}%)`;
    // Pin nach außen ausrichten
    pin.style.transform = `translate(-50%,-50%) rotate(${angleDeg + 90}deg)`;
    el.pins.appendChild(pin);
  }
}

/* =====================================================================
   K0. ABSTIMMUNG IM RAUM (OHNE DATENBANK, OHNE INTERNET)
   ---------------------------------------------------------------------
   Bewusst die "einfache" Variante: Die Stimmen leben ausschließlich in der
   Variable `roomTally` im Arbeitsspeicher DIESES EINEN Browsers. Es gibt
   keinen Server, keine Datenbank, keine Datei, die etwas speichert – sobald
   die Seite neu geladen wird, sind die Stimmen wieder weg. Genau das ist
   hier gewollt: ein Prozess, der mehrere Stimmen auswertet, OHNE dafür
   eine Datenbank zu brauchen (Voraussetzung: alle sind im selben Raum und
   teilen sich entweder das Gerät oder eine Person tippt stellvertretend).
   ===================================================================== */
let roomTally = [];

/* Während eine Abstimmung läuft, dürfen Antworten nicht verändert werden,
   sonst würden die Stimmen-Indizes nicht mehr zu den Antworten passen. */
function setAnswerEditingLocked(locked) {
  el.addAnswer.disabled = locked;
  el.openRoomBtn.disabled = locked;
  el.openLiveBtn.disabled = locked;
  el.answerList.querySelectorAll(".answer-text, .answer-factor, .remove-answer")
    .forEach(elInput => { elInput.disabled = locked; });
}

function openRoomVoting() {
  const answers = readAnswers();
  if (answers.length < 2) {
    showSpinMessage("Bitte mindestens zwei Antworten eingeben, bevor die Abstimmung startet.");
    return;
  }

  roomTally = answers.map(() => 0);
  el.roomQuestion.textContent = el.question.value.trim() || "Worüber stimmen wir ab?";
  renderRoomOptions(answers);
  updateRoomTallyLabel();
  el.roomOverlay.hidden = false;
  setAnswerEditingLocked(true);
}

/* Zeichnet eine tippbare Kachel pro Antwort (gleiche Optik wie vote.html) */
function renderRoomOptions(answers) {
  el.roomOptions.innerHTML = "";
  answers.forEach((a, i) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "vote-idea";
    tile.innerHTML = `
      <span class="vote-idea__text">${escapeHtml(a.text)}</span>
      <span class="vote-idea__votes" data-room-count="${i}">0</span>
    `;
    tile.addEventListener("click", () => {
      roomTally[i]++;
      tile.querySelector("[data-room-count]").textContent = roomTally[i];
      tile.classList.add("vote-pulse");
      setTimeout(() => tile.classList.remove("vote-pulse"), 250);
      updateRoomTallyLabel();
    });
    el.roomOptions.appendChild(tile);
  });
}

function updateRoomTallyLabel() {
  const total = roomTally.reduce((sum, v) => sum + v, 0);
  el.roomTally.textContent = total === 0
    ? "Noch keine Stimme abgegeben."
    : `${total} ${total === 1 ? "Stimme" : "Stimmen"} insgesamt abgegeben.`;
}

/* Beendet die Abstimmung. Bei applyResults=true werden die gezählten
   Stimmen direkt als Abstimmungsfaktor in die Antwortliste übernommen. */
function closeRoomVoting(applyResults) {
  if (applyResults) {
    const rows = [...el.answerList.querySelectorAll(".answer-row")];
    rows.forEach((row, i) => {
      const factorInput = row.querySelector(".answer-factor");
      factorInput.value = Math.max(1, roomTally[i] || 0);
    });
    drawWheel();
  }
  el.roomOverlay.hidden = true;
  setAnswerEditingLocked(false);
  roomTally = [];
}

/* =====================================================================
   K. LIVE-ABSTIMMUNG PER QR-CODE (Firebase)
   ---------------------------------------------------------------------
   Ein "Sitzungs"-Datensatz in Firebase verbindet das Gastgeber-Gerät mit
   beliebig vielen Teilnehmenden-Handys: jede Idee und jede Stimme landet
   live in diesem einen Datensatz, den alle gerade geöffneten Seiten
   (Gastgeber + Teilnehmende) gleichzeitig beobachten.
   ===================================================================== */
let liveSessionId = null;
let liveSessionRef = null;

/* Kurze, gut lesbare Zufalls-Kennung (ohne verwechselbare Zeichen wie 0/O, 1/I) */
function randomSessionId(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/* Baut die Teilnehmen-URL relativ zur aktuellen Seite, egal wo gehostet */
function buildVoteUrl(sessionId) {
  const base = window.location.href.replace(/index\.html?($|[?#])/i, "$1");
  const folder = base.slice(0, base.lastIndexOf("/") + 1);
  return folder + "vote.html?session=" + sessionId;
}

/* Startet eine neue Live-Sitzung: legt sie in Firebase an, zeigt den
   QR-Code und hört ab sofort live auf neue Ideen/Stimmen. */
function openLiveVoting() {
  if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
    showSpinMessage("Firebase ist nicht eingerichtet – siehe firebase-config.js.");
    return;
  }

  const question = el.question.value.trim() || "Worüber stimmen wir ab?";
  liveSessionId = randomSessionId();
  liveSessionRef = firebase.database().ref("sessions/" + liveSessionId);

  // Bereits eingetragene Antworten als Startvorschläge übernehmen,
  // damit niemand bei null anfangen muss.
  const seedAnswers = readAnswers();
  const ideasSeed = {};
  seedAnswers.forEach(a => {
    const key = liveSessionRef.child("ideas").push().key;
    ideasSeed[key] = { text: a.text, votes: 0 };
  });

  liveSessionRef.set({
    question,
    factorMode: el.liveFactorMode.checked,
    ideas: ideasSeed,
  }).catch(error => {
    el.liveOverlay.hidden = true;
    setAnswerEditingLocked(false);
    if (error && error.code === "PERMISSION_DENIED") {
      showSpinMessage("Firebase blockiert den Zugriff – Datenbank-Regeln auf Lesen/Schreiben=true stellen (siehe README).");
    } else {
      showSpinMessage("Verbindung zu Firebase fehlgeschlagen. Bitte Internet prüfen.");
    }
    console.error(error);
  });

  const voteUrl = buildVoteUrl(liveSessionId);
  el.liveQr.src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(voteUrl);
  el.liveUrl.textContent = voteUrl;
  el.liveQuestion.textContent = question;
  el.liveOverlay.hidden = false;
  setAnswerEditingLocked(true);

  // Live-Listener: läuft bei jeder Änderung erneut (neue Idee, neue Stimme)
  liveSessionRef.child("ideas").on("value", snapshot => {
    renderLiveIdeas(snapshot.val() || {});
  }, error => {
    if (error && error.code === "PERMISSION_DENIED") {
      showSpinMessage("Firebase blockiert den Zugriff – Datenbank-Regeln auf Lesen/Schreiben=true stellen (siehe README).");
    }
    console.error(error);
  });
}

/* Zeichnet die aktuelle Ideen-Liste im Gastgeber-Dashboard, nach
   Stimmen sortiert, damit die Spannung sichtbar steigt. */
function renderLiveIdeas(ideasObj) {
  const entries = Object.entries(ideasObj);
  el.liveIdeas.innerHTML = "";

  if (entries.length === 0) {
    el.liveIdeas.innerHTML = '<p class="live-empty">Noch keine Ideen eingereicht …</p>';
    return;
  }

  entries.sort((a, b) => (b[1].votes || 0) - (a[1].votes || 0));
  entries.forEach(([key, idea]) => {
    const row = document.createElement("div");
    row.className = "live-idea-row pulse";
    const votes = idea.votes || 0;
    row.innerHTML = `
      <span class="live-idea-text">${escapeHtml(idea.text || "")}</span>
      <span class="live-idea-votes">${votes} ${votes === 1 ? "Stimme" : "Stimmen"}</span>
    `;
    el.liveIdeas.appendChild(row);
  });
}

/* Beendet die Live-Sitzung. Bei applyResults=true werden die zuletzt
   bekannten Ideen+Stimmen als neue Antwortliste samt Faktoren übernommen. */
function closeLiveVoting(applyResults) {
  if (!liveSessionRef) { el.liveOverlay.hidden = true; setAnswerEditingLocked(false); return; }

  liveSessionRef.child("ideas").off("value");

  if (applyResults) {
    liveSessionRef.child("ideas").once("value").then(snapshot => {
      applyLiveResultsToWheel(snapshot.val() || {});
      liveSessionRef.remove(); // aufräumen, damit nichts in der Datenbank bleibt
    });
  } else {
    liveSessionRef.remove();
  }

  el.liveOverlay.hidden = true;
  setAnswerEditingLocked(false);
  liveSessionId = null;
  liveSessionRef = null;
}

/* Übernimmt die eingesammelten Ideen als neue Antwortliste. Je nach
   Schalter wird die Stimmenzahl zum Abstimmungsfaktor – oder jede
   Idee bekommt bewusst die gleiche Gewinnchance (Faktor 1). */
function applyLiveResultsToWheel(ideasObj) {
  const entries = Object.values(ideasObj).filter(i => (i.text || "").trim() !== "");
  if (entries.length === 0) {
    showSpinMessage("Es wurden keine Ideen eingereicht.");
    return;
  }

  const factorMode = el.liveFactorMode.checked;
  el.answerList.innerHTML = "";
  entries.forEach(idea => {
    const factor = factorMode ? Math.max(1, idea.votes || 0) : 1;
    el.answerList.appendChild(makeAnswerRow(idea.text, factor));
  });
  drawWheel();
}

/* =====================================================================
   J. START
   ===================================================================== */
/* Zeichnet das farbige Rad im Start-Logo (Regenbogen-Segmente) */
function buildLogoWheel() {
  const g = document.getElementById("logo-wheel");
  if (!g) return;
  const cx = 300, cy = 230, r = 210;
  const count = 24;
  // Regenbogen-Farbtöne rundherum
  for (let i = 0; i < count; i++) {
    const a1 = (i / count) * 2 * Math.PI - Math.PI / 2;
    const a2 = ((i + 1) / count) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`);
    path.setAttribute("fill", `hsl(${(i / count) * 360}, 75%, 55%)`);
    path.setAttribute("stroke", "#ffffff");
    path.setAttribute("stroke-width", "1.5");
    g.appendChild(path);
  }
  // dünner goldener Außenring
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", cx); ring.setAttribute("cy", cy); ring.setAttribute("r", r);
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "#b8912e");
  ring.setAttribute("stroke-width", "6");
  g.appendChild(ring);
}

function init() {
  // Beispielhafte Startdaten, damit man sofort etwas sieht
  el.question.value = "Was essen wir heute Abend?";
  [
    ["Pizza", 3],
    ["Sushi", 1],
    ["Pasta", 2],
    ["Burger", 1],
  ].forEach(([t, f]) => el.answerList.appendChild(makeAnswerRow(t, f)));

  buildBulbs(24);
  buildLogoWheel(); // farbiges Rad im Start-Logo zeichnen
  drawWheel();

  // Knöpfe verbinden
  el.addAnswer.addEventListener("click", () => {
    el.answerList.appendChild(makeAnswerRow());
    drawWheel();
  });
  el.spin.addEventListener("click", spin);
  el.optProportional.addEventListener("change", drawWheel);
  el.resultClose.addEventListener("click", () => {
    el.overlay.hidden = true;
    stopApplause(); // Applaus sofort beenden, nicht bis zum Ende weiterlaufen lassen
    if (el.optSound.checked) startBackgroundMusic(); // Musik wieder an
  });

  // Start-Button: blendet den Startbildschirm aus, begrüßt und startet Musik
  el.startBtn.addEventListener("click", () => {
    el.startOverlay.classList.add("hidden");
    if (el.optSound.checked) {
      speakWelcome();
      // Musik kurz nach der Begrüßung starten, damit sie sich nicht überlagert
      setTimeout(startBackgroundMusic, 2600);
    }
  });

  el.question.addEventListener("input", () => {}); // Frage frei wählbar

  // Live-Abstimmung per QR-Code
  el.openLiveBtn.addEventListener("click", openLiveVoting);
  el.liveCancelBtn.addEventListener("click", () => closeLiveVoting(false));
  el.liveFinishBtn.addEventListener("click", () => closeLiveVoting(true));

  // Abstimmung im Raum (ohne Datenbank)
  el.openRoomBtn.addEventListener("click", openRoomVoting);
  el.roomCancelBtn.addEventListener("click", () => closeRoomVoting(false));
  el.roomFinishBtn.addEventListener("click", () => closeRoomVoting(true));
}

init();
