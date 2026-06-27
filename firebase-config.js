/* =====================================================================
   FIREBASE-KONFIGURATION
   ---------------------------------------------------------------------
   HIER TRÄGST DU DEINE EIGENEN DATEN EIN!
   Diese bekommst du in der Firebase-Konsole unter:
   Projekteinstellungen -> Deine Apps -> Web-App -> "SDK-Einrichtung
   und Konfiguration".

   Ersetze die Beispielwerte unten durch deinen eigenen Block.
   Diese Datei wird sowohl von index.html (Gastgeber) als auch von
   vote.html (Teilnehmende) eingebunden – du musst sie nur EINMAL pflegen.
   ===================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCKsYbHk-Fdbp-UUejNdWeTCFbzF_sJYVY",
  authDomain: "gluecksrad-4f3a1.firebaseapp.com",
  databaseURL: "https://gluecksrad-4f3a1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gluecksrad-4f3a1",
  storageBucket: "gluecksrad-4f3a1.firebasestorage.app",
  messagingSenderId: "869852250490",
  appId: "1:869852250490:web:64d90887226086bec616c3",
  measurementId: "G-2E633E8E48"
};

// Firebase mit der obigen Konfiguration starten.
// Ab hier können index.html und vote.html auf firebase.database() zugreifen.
//
// Die Prüfung "typeof firebase" ist eine Sicherheitsnetz: Falls das
// Firebase-SDK aus irgendeinem Grund nicht geladen werden konnte (z. B.
// kein Internet, Netzwerk blockiert externe Skripte), startet die App
// trotzdem ohne Absturz – die Live-Abstimmung zeigt dann nur eine
// freundliche Meldung an, statt die ganze Seite zu zerschießen.
if (typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
} else {
  console.warn("Firebase-SDK konnte nicht geladen werden – Live-Abstimmung ist deaktiviert.");
}
