/* =====================================================================
   TEILNEHMENDEN-LOGIK (vote.js)
   ---------------------------------------------------------------------
   Liest die Sitzungs-Kennung aus der URL, hört live auf Änderungen in
   Firebase und ermöglicht: eine Idee abstimmen ODER eine eigene Idee
   einreichen.
   ===================================================================== */

"use strict";

const el = {
  status:   document.getElementById("vote-status"),
  question: document.getElementById("vote-question"),
  ideas:    document.getElementById("vote-ideas"),
  form:     document.getElementById("vote-form"),
  input:    document.getElementById("vote-input"),
  thanks:   document.getElementById("vote-thanks"),
};

// Merkt sich, für welche Ideen dieses Gerät in dieser Sitzung schon
// gestimmt hat (nur im Arbeitsspeicher, kein Schutz vor Neuladen –
// das ist ein bewusster Kompromiss für eine entspannte Abstimmung
// im Freundes-/Familienkreis, keine manipulationssichere Wahl).
const alreadyVoted = new Set();

/* Liest ?session=ABC123 aus der aktuellen Seitenadresse */
function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("session");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showStatus(text) {
  el.status.hidden = false;
  el.status.textContent = text;
}

function init() {
  if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
    showStatus("⚠️ Verbindung zur Abstimmung nicht möglich (Firebase nicht eingerichtet).");
    return;
  }

  const sessionId = getSessionId();
  if (!sessionId) {
    showStatus("⚠️ Kein gültiger Abstimmungslink. Bitte den QR-Code erneut scannen.");
    return;
  }

  const sessionRef = firebase.database().ref("sessions/" + sessionId);

  // Live-Verbindung: läuft jedes Mal, wenn sich irgendetwas in der
  // Sitzung ändert (neue Idee, neue Stimme, oder Sitzung beendet).
  sessionRef.on("value", snapshot => {
    const data = snapshot.val();

    if (!data) {
      // Sitzung wurde beendet (oder existiert nicht) -> freundlich abschließen
      el.status.hidden = false;
      el.question.hidden = true;
      el.ideas.hidden = true;
      el.form.hidden = true;
      showStatus("🎉 Die Abstimmung ist beendet – das Glücksrad dreht sich jetzt!");
      return;
    }

    el.status.hidden = true;
    el.question.hidden = false;
    el.question.textContent = data.question || "Worüber stimmen wir ab?";
    el.ideas.hidden = false;
    el.form.hidden = false;

    renderIdeas(data.ideas || {}, sessionRef);
  }, error => {
    showStatus("⚠️ Verbindung fehlgeschlagen. Bitte WLAN/Mobilfunk prüfen und neu laden.");
    console.error(error);
  });

  // Eigene Idee einreichen
  el.form.addEventListener("submit", e => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (text === "") return;
    sessionRef.child("ideas").push({ text, votes: 0 });
    el.input.value = "";
    flashThanks("✅ Danke, deine Idee wurde eingereicht!");
  });
}

/* Zeichnet alle aktuellen Ideen als tippbare Kacheln */
function renderIdeas(ideasObj, sessionRef) {
  const entries = Object.entries(ideasObj);
  el.ideas.innerHTML = "";

  if (entries.length === 0) {
    el.ideas.innerHTML = '<p class="vote-empty">Noch keine Ideen da – reich die erste ein!</p>';
    return;
  }

  // Nach Stimmen sortiert, das sorgt für etwas Spannung
  entries.sort((a, b) => (b[1].votes || 0) - (a[1].votes || 0));

  entries.forEach(([key, idea]) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "vote-idea";
    if (alreadyVoted.has(key)) tile.classList.add("vote-idea--done");
    tile.innerHTML = `
      <span class="vote-idea__text">${escapeHtml(idea.text || "")}</span>
      <span class="vote-idea__votes">${idea.votes || 0}</span>
    `;
    tile.addEventListener("click", () => castVote(key, sessionRef, tile));
    el.ideas.appendChild(tile);
  });
}

/* Stimme für eine Idee abgeben (atomar hochzählen, damit auch bei
   vielen gleichzeitigen Stimmen keine verloren geht) */
function castVote(ideaKey, sessionRef, tileEl) {
  if (alreadyVoted.has(ideaKey)) return; // schon abgestimmt
  alreadyVoted.add(ideaKey);
  tileEl.classList.add("vote-idea--done");

  sessionRef.child("ideas/" + ideaKey + "/votes").transaction(current => (current || 0) + 1);
  flashThanks("✅ Danke, deine Stimme wurde gezählt!");
}

/* Kurze Bestätigung einblenden */
let thanksTimer = null;
function flashThanks(message) {
  el.thanks.textContent = message;
  el.thanks.hidden = false;
  clearTimeout(thanksTimer);
  thanksTimer = setTimeout(() => { el.thanks.hidden = true; }, 2500);
}

init();
