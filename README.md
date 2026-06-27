# 🎡 Glücksrad mit Abstimmungsfaktor

Eine Web-App im Stil einer Spielshow: Man stellt eine Frage, gibt mehrere
Antwortmöglichkeiten ein und lässt das Glücksrad entscheiden. Jede Antwort
hat einen **Abstimmungsfaktor**, der ihre Gewinnchance beeinflusst.

Umgesetzt mit **HTML, CSS und JavaScript** (reines Frontend, ohne Server).

## Live-Version

Sobald das Projekt über GitHub Pages veröffentlicht ist, läuft es unter:

    https://DEIN-BENUTZERNAME.github.io/gluecksrad/

(Den Platzhalter durch deinen GitHub-Benutzernamen ersetzen.)

## Funktionen

- Eigene Frage und beliebig viele Antwortmöglichkeiten eingeben
- Abstimmungsfaktor pro Antwort: höherer Faktor = höhere Gewinnchance
- **Zwei Wege, gemeinsam abzustimmen, bevor das Rad sich dreht:**
  - 🙋 **Im Raum, ohne Internet/Datenbank:** Ein Gerät geht herum, jede
    Person tippt einmal. Die Stimmen leben nur im Arbeitsspeicher des
    Browsers – es gibt keine Datenbank, keinen Server, keine Datei.
  - 📱 **Per QR-Code, über Firebase:** Alle scannen den Code mit dem
    eigenen Handy, reichen Ideen ein oder stimmen ab – auch von
    unterwegs, unabhängig vom Aufenthaltsort.
  
  Beide Wege füllen am Ende automatisch den Abstimmungsfaktor.
- Glücksrad im Spielhallen-Look mit Neon, leuchtenden Stäben und Lichtern
- Drehung über 8 Sekunden mit Spannungston und dem typischen Klack-Geräusch
- Gewinner-Anzeige mit Fanfare, Applaus, Konfetti und goldenem Feuerwerk
- Begrüßung und Hintergrundmusik beim Start

## Bedienung

1. Seite öffnen und auf **LOS GEHT'S** klicken (nötig, damit der Browser Ton erlaubt).
2. Frage und Antworten eingeben, optional die Faktoren anpassen.
3. Auf **DREHEN** klicken und das Ergebnis abwarten.

## Der Abstimmungsfaktor (Kern des Projekts)

Jede Antwort hat einen Faktor (eine Zahl ab 1). Die Auslosung funktioniert
nach dem **Lostopf-Prinzip**: Eine Antwort mit Faktor 5 bekommt 5 Lose, eine
mit Faktor 1 nur 1 Los. Dann wird zufällig ein Los gezogen – Antworten mit
mehr Losen gewinnen also häufiger. Das Rad stoppt anschließend genau bei der
ausgelosten Antwort.

Im Code erledigt das die Funktion `pickWinnerIndex` in `script.js`.

## Projektaufbau

| Datei                | Aufgabe                                              |
|----------------------|-----------------------------------------------------|
| `index.html`         | Gerüst der Hauptseite (Gastgeber)                   |
| `style.css`          | Aussehen: Neon-Look, Glow, blinkende Lampen, 3D     |
| `script.js`          | Logik: Rad zeichnen, auslosen, drehen, Töne, Live   |
| `vote.html`          | Abstimmungsseite, die per QR-Code geöffnet wird     |
| `vote.js`            | Logik der Abstimmungsseite (Idee/Stimme abgeben)    |
| `firebase-config.js` | Eigene Firebase-Zugangsdaten (hier eintragen!)      |
| `sounds/`            | Ordner für optionale eigene Sounddateien            |

## Zwei Abstimmungswege – und warum es beide gibt

Die App bietet bewusst zwei unabhängige Wege an, die jeweils ein anderes
Problem lösen:

**Variante A – "Im Raum abstimmen" (ohne Datenbank).** Ohne Datenbank
existieren Stimmabgaben nur im Browser der jeweiligen Person. Diese Variante
löst das trotzdem: Ein Gerät geht im Raum herum (oder eine Person tippt
stellvertretend für jede Wortmeldung), die Stimmen werden direkt in einer
JavaScript-Variable im Arbeitsspeicher gezählt. Voraussetzung: alle befinden
sich im selben Raum. Es wird keine Datenbank, kein Server und keine externe
Bibliothek benötigt – reines HTML/CSS/JS.

**Variante B – "Per QR-Code abstimmen" (mit Firebase).** Damit auch Personen
abstimmen können, die nicht im selben Raum sind, nutzt diese Variante eine
kostenlose Cloud-Datenbank (Firebase) als gemeinsamen Treffpunkt im Netz. Das
geht über das hinaus, was Variante A kann: Abstimmung funktioniert von
überall mit Internetzugang, nicht nur vor Ort.

Beide Varianten füllen am Ende denselben Abstimmungsfaktor – nur der Weg
dorthin unterscheidet sich.

## Live-Abstimmung per QR-Code einrichten (Firebase)

Damit mehrere Handys gleichzeitig abstimmen können, brauchen die Geräte einen
gemeinsamen Treffpunkt im Netz. Da GitHub Pages keinen eigenen Server-Code
(Python, PHP …) ausführt, wird dafür **Firebase Realtime Database** genutzt –
ein kostenloser Cloud-Dienst von Google. Die App selbst bleibt dabei reiner
HTML/CSS/JS-Frontend-Code; Firebase übernimmt nur das Speichern und
Live-Verteilen der Stimmen.

So funktioniert es im Ablauf:

1. Gastgeber klickt auf „Live-Abstimmung per QR-Code starten“.
2. Es entsteht eine zufällige Sitzungs-Kennung und ein QR-Code.
3. Alle scannen den Code → `vote.html` öffnet sich auf ihrem Handy.
4. Dort kann jede Person eine eigene Idee einreichen oder für eine
   vorhandene abstimmen. Alles erscheint live beim Gastgeber.
5. Gastgeber beendet die Abstimmung → die Ideen werden als Antworten
   übernommen, die Stimmen wahlweise als Abstimmungsfaktor.

### Einmalige Einrichtung

1. Auf <https://console.firebase.google.com> mit Google-Konto anmelden.
2. Projekt anlegen (Google Analytics kann aus bleiben).
3. „Build“ → „Realtime Database“ → „Datenbank erstellen“, im **Testmodus**
   starten (erlaubt Lesen/Schreiben ohne Login – passend, da sich niemand
   anmelden soll).
4. Projekteinstellungen → „Deine Apps“ → Web-App (`</>`) hinzufügen.
5. Den angezeigten `firebaseConfig`-Block kopieren und in die Datei
   `firebase-config.js` einsetzen (die Beispielwerte ersetzen).

Ohne diese Einrichtung funktioniert das Glücksrad ganz normal weiter – nur die
Live-Abstimmung zeigt dann einen freundlichen Hinweis statt eines QR-Codes.

### Fehlerbehebung: "Zugriff verweigert" / "Verbindung fehlgeschlagen"

Diese Meldung bedeutet fast immer, dass die Datenbank-Regeln Lesen/Schreiben
ohne Anmeldung blockieren (Standard, falls beim Anlegen nicht "Testmodus"
gewählt wurde). Beheben: Firebase-Konsole → "Build" → "Realtime Database" →
Reiter **"Regeln"** → Inhalt ersetzen durch:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Danach auf **"Veröffentlichen"** klicken. Das öffnet die Datenbank ganz
bewusst ohne Login (siehe Hinweis zur Fairness unten) – für eine entspannte
Abstimmung im kleinen Kreis ist das die richtige Einstellung.

### Hinweis zur Fairness / Manipulation

Die Abstimmung ist für den entspannten Einsatz unter Freund:innen, Familie
oder im Team gedacht, nicht als manipulationssichere Wahl. Ein Gerät merkt
sich pro Sitzung, wofür es schon gestimmt hat, aber technisch könnte jemand
durch Neuladen mehrfach abstimmen. Für den vorgesehenen Zweck (gemeinsam fair
entscheiden) ist das ausreichend.

## Eigene Sounddateien (optional)

Im Ordner `sounds/` können eigene MP3-Dateien abgelegt werden:

- `applause.mp3` – echter Applaus und Jubel (beim Gewinner)
- `welcome.mp3` – gesprochene Begrüßung (beim Start)
- `music.mp3` – Hintergrundmusik

Fehlt eine Datei, erzeugt die App einen Ersatz im Browser. Über GitHub Pages
werden die MP3-Dateien zuverlässig geladen.

## Technische Hinweise

- Frontend: HTML, CSS, JavaScript – kein eigener Server-Code.
- Töne werden über die Web Audio API erzeugt bzw. aus den MP3-Dateien geladen.
- Die Grafik des Rades wird als SVG dynamisch aus den Eingaben erzeugt.
- Die Live-Abstimmung nutzt Firebase Realtime Database (kostenloser
  Cloud-Dienst) und die kostenlose QR-Code-API von api.qrserver.com.
