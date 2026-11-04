# AgriTab auf Render einrichten

## 1. Quellcode auf GitHub bereitstellen

1. Auf https://github.com/new ein Repository mit dem Namen `agritab` erstellen und **Private** auswählen.
2. Nach dem Erstellen **uploading an existing file** auswählen. Wenn bereits Dateien vorhanden sind: **Add file → Upload files**.
3. `deployment/AgriTab-Render.zip` auf deinem PC entpacken. Den **Inhalt** des entpackten Ordners hochladen, einschließlich des Ordners `public`. Die ZIP-Datei selbst nicht als Quellcode hochladen.
4. Mit **Commit changes** speichern. Auf der obersten Ebene des Repositorys müssen `package.json`, `server.mjs` und `public/` liegen.

Das vorbereitete Paket enthält den App-Quellcode und die Anleitung. Bestehende lokale Touren und Standorte aus `data/` sind nicht enthalten. Die neue Online-Instanz beginnt mit einem leeren Betrieb; Bestandsdaten können später gezielt übernommen werden.

## 2. Repository mit Render verbinden

1. In deinem Render-Formular **Source Code → Git Provider → GitHub** auswählen.
2. Bei GitHub anmelden und Render Zugriff auf das private Repository `agritab` geben. Falls die Auswahl angeboten wird, **Only select repositories → agritab** verwenden.
3. Zurück bei Render das Repository `agritab` auswählen und **Connect** anklicken.

## 3. Web Service konfigurieren

| Feld bei Render | Wert |
| --- | --- |
| Name | `agritab` (oder ein noch freier Name) |
| Language / Runtime | `Node` |
| Branch | `main` (oder der bei GitHub angezeigte Standardbranch) |
| Region | `Frankfurt` |
| Root Directory | leer lassen |
| Build Command | `node --check server.mjs && node --check public/app.js` |
| Start Command | `node server.mjs` |
| Compute Plan / Instance Type | `0.5c-512mb` (früher `Starter`) |

Die App hat keine zusätzlichen npm-Abhängigkeiten. Das Build-Kommando prüft deshalb nur die JavaScript-Syntax. Die Datei `.node-version` legt Node.js 24 fest. Render setzt den Port automatisch; kein zusätzlicher `PORT`-Eintrag nötig.

## 4. Dauerhaften Speicher und Betriebsschlüssel setzen

Unter **Advanced / Disks** eine **Persistent Disk** hinzufügen:

| Einstellung | Wert |
| --- | --- |
| Name | `agritab-data` |
| Mount Path | `/var/data` |
| Size | `1 GB` als Startgröße |

Unter **Environment Variables** eintragen:

| Name | Wert |
| --- | --- |
| `DATA_DIR` | `/var/data/agritab` |
| `AGRITAB_KEY` | Einen eigenen langen, schwer zu erratenden Betriebsschlüssel wählen |

Den echten Betriebsschlüssel ausschließlich als Render-Umgebungsvariable hinterlegen und den berechtigten Fahrern mitteilen. Der in der Anmeldeseite genannte Schlüssel `agritab-local` ist nur der lokale Testschlüssel; online gilt der hier gesetzte Wert.

Die App verwendet eine lokale Datendatei. Für diese Version genau **eine Instanz** betreiben, keine zusätzlichen Replikate. Ein Datenträger bei Render bewahrt Dateien bei Neustarts und Deploys; zusätzliche Datensicherungen gehören zum produktiven Betrieb.

## 5. Deployment und Handys

1. Die angezeigten laufenden Kosten für Web Service und Disk prüfen und **Deploy Web Service / Create Web Service** auslösen.
2. Auf den Status **Live** warten. Falls der Build fehlschlägt, die Fehlermeldung aus den Logs prüfen.
3. Die von Render angezeigte HTTPS-Adresse auf Android in Chrome bzw. auf dem iPhone in Safari öffnen.
4. Mit Fahrername und dem eigenen Betriebsschlüssel anmelden, Kunden und Koppeln anlegen.
5. Alle Fahrer verwenden dieselbe HTTPS-Adresse. GPS-Freigabe am Handy aktivieren; die App für kontinuierlichen Standortabgleich geöffnet lassen.

Feste Fahrerzugänge, Wiederaufnahme offener Einsätze nach Neustarts und automatische Datensicherungen sind vor dem produktiven Einsatz noch zu ergänzen. Die aktuelle Anmeldung erzeugt bei jeder neuen Anmeldung ein neues Fahrerprofil; die Sitzungstoken sind nach Serverneustart ungültig. Der derzeitige Stand eignet sich als gemeinsamer Online-Test.

## Offizielle Dokumentation

- [Render: Web Services](https://render.com/docs/web-services)
- [Render: Persistent Disks](https://render.com/docs/disks)
- [Render: Node.js-Version festlegen](https://render.com/docs/node-version)
- [GitHub: Repository anlegen](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [GitHub: Dateien hochladen](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
