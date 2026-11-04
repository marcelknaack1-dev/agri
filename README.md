# AgriTab

Mobile Web-App für Android, iPhone, Tablet und Desktop. Ohne zusätzliche npm-Abhängigkeiten, Node.js ab Version 22.

## Starten

```powershell
$env:AGRITAB_KEY = 'einen-eigenen-langen-betriebsschluessel-eintragen'
node server.mjs
```

Dann http://localhost:3000 öffnen. Ohne gesetzten Schlüssel lautet der lokale Testschlüssel `agritab-local`. Jeder Fahrer meldet sich mit seinem Namen und demselben Betriebsschlüssel an. Alle Geräte müssen dieselbe Serveradresse verwenden. Der Server lauscht auf Port 3000 auf allen Netzwerkschnittstellen; keine automatische Firewalländerung.

Zum Testen mit dem Handy im selben Netzwerk die IPv4-Adresse des PCs statt `localhost` verwenden, z. B. `http://<PC-IP>:3000/`. Das Handy muss mit dem WLAN desselben Routers verbunden sein; der PC darf auch per Kabel angeschlossen sein und muss eingeschaltet bleiben. Die PC-IP kann sich ändern. Über lokales HTTP sind Touren und Zeitbuchungen möglich; für GPS und die vollständige PWA-Installation ist HTTPS nötig.

## Erster Einsatz

1. Unter **Betrieb** einen Kunden und dessen Koppeln anlegen.
2. Über das Profil oben rechts Trecker, Häcksler oder LKW wählen.
3. In der Übersicht Kunden auswählen und **Einsatz starten** antippen.
4. **Arbeit**, **Warten** oder **Pause** antippen. Die Abschnitte werden mit Serverzeit und Kunde gespeichert.
5. Über **Tour erfassen** Koppel und Nettogewicht in kg eingeben. Jede Ladung wird als eigene Tour mit Zeitstempel gespeichert.
6. **Standort teilen** aktivieren. Alle fünf Sekunden werden Position und Betriebsdaten mit dem Server abgeglichen. GPS-Messungen können vom Betriebssystem langsamer bereitgestellt werden; Positionen über 30 Sekunden werden grau dargestellt.
7. **Einsatz stoppen** beendet die Zeitbuchung. Kundenwechsel erfordert einen neuen Einsatz. Touren und Zeiten lassen sich als CSV exportieren.

## Handybetrieb und Grenzen

- Für GPS und die Installation auf echten Handys die App über einen HTTPS-Reverse-Proxy unter einer gemeinsamen Serveradresse bereitstellen. `http://localhost` ist für die Entwicklung geeignet; eine lokale HTTP-IP-Adresse reicht für GPS auf Handys nicht aus.
- Android: Browsermenü → Zum Startbildschirm / App installieren. iPhone: Safari → Teilen → Zum Home-Bildschirm. Die Oberfläche passt sich kleinen Displays an.
- Die App ist eine PWA, kein App-Store-Paket. GPS im Hintergrund oder bei gesperrtem Bildschirm wird nicht garantiert. Zuverlässiges Hintergrundtracking benötigt native Android-/iOS-Komponenten und passende Berechtigungen.
- Internet ist für Leaflet, die Schriftarten und OpenStreetMap-Kacheln erforderlich. Die Karte nutzt Leaflet gemäß dessen [offizieller Anleitung](https://leafletjs.com/examples-v1/quick-start/).
- OpenStreetMap verlangt bei Kartenanfragen einen echten Herkunftsheader (`Referer`). Die App setzt `strict-origin-when-cross-origin` auf Seite, Server und Kartenebene: Nach außen wird nur die Serveradresse übertragen, kein Seitenpfad. Kartenkacheln lädt der Browser direkt und mit seinem normalen HTTP-Cache; der Service Worker speichert keine Kartenkacheln. Keine Offline-Kartendownloads und kein Kachel-Neuladen im 5-Sekunden-Takt; dieser Takt gilt für Betriebsdaten und Fahrzeugpositionen. Siehe [OSM-Nutzungsbedingungen](https://operations.osmfoundation.org/policies/tiles/).
- Nach einer Aktualisierung die Seite normal neu laden, damit die korrigierte Kartenanbindung geladen wird. Kein erzwungenes Neu-Laden aller Kacheln oder wiederholte Abrufe zum Umgehen einer Sperre. Falls OSM trotz korrekter Herkunftsangaben weiter sperrt, den Sperrgrund nach den [offiziellen Hinweisen](https://wiki.openstreetmap.org/wiki/Blocked_tiles) prüfen.
- Kein Offline-Buchen: Eine Buchung ist erst nach Serverbestätigung gespeichert. Bei Verbindungsverlust bleiben angezeigte Daten als veraltet gekennzeichnet. Eingaben im Tourdialog bleiben bei einem Fehler erhalten und können erneut gesendet werden; Tour-IDs verhindern doppelte Buchungen.
- Daten liegen in `data/state.json`. Regelmäßig sichern. Ein einzelner Serverprozess ist vorgesehen, keine verteilte Datenbank.
- Anmeldung nutzt einen gemeinsamen Betriebsschlüssel und temporäre Sitzungstoken im Serverspeicher. Nach Serverneustart erneut anmelden; bisherige Datensätze bleiben erhalten. Eine erneute Anmeldung erzeugt ein neues Fahrerprofil. Vor produktivem Einsatz dauerhafte Fahrerkonten, Rollen, Sitzungsverwaltung und Wiederaufnahme offener Einsätze ergänzen.
- Alle angemeldeten Fahrer sehen sämtliche Kunden, Touren, Zeiten und freigegebene Standorte. Es gibt noch keine getrennten Betriebe oder Administratorrollen. Den Testschlüssel ausschließlich für lokale Tests verwenden.
- Kein automatisches Hosting oder öffentliche Veröffentlichung konfiguriert.

## Prüfen

```powershell
node --test
node --check public/app.js
node --check server.mjs
```

Der Integrationstest prüft zwei Fahrer, Zugangsprüfung, Kunden/Koppeln, Gewichtsvalidierung, doppelte Buchungen, Statuswechsel, gemeinsame GPS-Daten sowie dauerhafte Speicherung über einen Serverneustart.

## Online-Test auf Render

Die Schritt-für-Schritt-Anleitung steht in [DEPLOY-RENDER.md](DEPLOY-RENDER.md). Das vorbereitete Quellcode-Paket `deployment/AgriTab-Render.zip` kann nach dem Entpacken in ein privates GitHub-Repository hochgeladen werden. Es enthält keine lokalen Betriebsdaten aus `data/`.
