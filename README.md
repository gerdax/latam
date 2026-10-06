# Pastelowy lot

Projekt lokalnej gry przeglądarkowej. Oryginalna ilustracja znajduje się w `references/` i nie jest zmieniana ani wymagana podczas gry.

Wymagania: Node.js 22.12+ oraz pnpm. Uruchomienie: `pnpm install`, następnie `pnpm dev`. Weryfikacja: `pnpm test` i `pnpm build`. Podgląd produkcji: `pnpm exec vite preview --host 0.0.0.0`.

Przeciągnięcie w górę lub w dół steruje lotem; strzałki góra/dół działają identycznie. Dźwięk włącza się przy pierwszym sterowaniu. Kolizja powoduje automatyczny restart. Parametry lotu są w `src/physics.ts`, sceneria w `src/terrain.ts`, model w `src/aircraft.ts`.

Lotniska pojawiają się co około 41 sekund lotu (pierwsze po około 16 sekundach). Aby wylądować, wyrównaj samolot i zmniejsz opadanie przed dotknięciem pasa kołami. Po przyziemieniu samolot automatycznie hamuje. Przytrzymaj sterowanie w górę, aby ponownie rozpędzić się i wystartować; puszczenie podczas rozbiegu przerywa start. Mocne uderzenie, kontakt kadłubem lub wyjazd poza koniec pasa powodują zderzenie. Położenie lotnisk jest w `src/airports.ts`; limity lądowania i rozbiegu są w konfiguracji fizyki.

Zderzenia korzystają z własnego, uproszczonego solvera bryły sztywnej w `src/crash.ts`. Impulsy kontaktowe wywołują odbicie i obrót w trzech osiach, z tarciem, grawitacją oraz tłumieniem. Środek samolotu pozostaje w płaszczyźnie lotu. Sprężystość domyślnie wynosi 0.5; wolne kontakty nie odbijają, dzięki czemu wrak osiada. Materiał jest konfigurowany przez `crashMaterial` w konfiguracji lotu. Restart następuje po trzech sekundach; podczas zderzenia sterowanie jest wyłączone. Bez zewnętrznego silnika fizycznego.

Lot pozwala na wznoszenie pod kątem około 55° i opadanie do 69°. Pułap wynosi dwie wysokości kadru nad terenem (40 jednostek w poziomie, 48 w pionie), z wyhamowaniem w ostatnich czterech jednostkach. Kamera płynnie podąża na wysokości; podczas opadania wraca do widoku ziemi. Zmiana orientacji ekranu nie teleportuje samolotu znajdującego się powyżej nowego pułapu. Chmury na kolejnych poziomach wysokości korzystają z puli 25 obiektów.

Przy końcowym podejściu po puszczeniu sterowania samolot delikatnie wyrównuje nos, jeśli prędkość opadania jest bezpieczna. Tolerancja przyziemienia wynosi 2.2 jednostki/s oraz około 12.6° nachylenia; mocne uderzenia nadal kończą się zderzeniem.

Lotniska mają dwa hangary i płytę postojową obok pasa. Otwarte hangary mieszczą kolejno transportowiec ze śmigłami, samolot pasażerski lub wojskowy odrzutowiec; co czwarte lotnisko ma zamknięty hangar. Zaparkowane modele są dekoracyjne i nie blokują pasa. Układ jest stały dla danego lotniska, a obiekty są ponownie używane w nieskończonej scenerii.

Przed pierwszym lotem oraz po każdym restarcie pojawia się tabelka z obrazkami: Cessna, samolot transportowy, pasażerski i wojskowy. Kliknięcie lub dotknięcie obrazka rozpoczyna lot wybranym modelem. Do tego czasu świat i dźwięk są zatrzymane. Podczas lotu tabelka jest ukryta. Wszystkie modele korzystają z tego samego sterowania i parametrów lotu, ale mają własny obrys kolizji i wysokość podwozia nad pasem. Obrazki są renderowane z rzeczywistych modeli 3D.

## GitHub Pages

Adres gry: https://gerdax.github.io/latam/

Publiczne repozytorium `gerdax/latam` zawiera kod źródłowy na gałęzi `main`. Build gry publikowany jest na osobnej gałęzi `gh-pages`; GitHub Pages korzysta z jej katalogu głównego. Referencje, dokumentacja oraz ustawienia lokalne nie trafiają do builda. Publikacja nie zależy od wcześniejszego repozytorium `latam-play`.

`pnpm build:pages` przygotowuje build z bazą `/latam/`. `pnpm deploy:pages` buduje grę i wysyła wygenerowane pliki na `gh-pages` w `gerdax/latam`, używając tymczasowego katalogu. Przy pierwszej publikacji tworzy tę gałąź; kolejne aktualizują wyłącznie jej pliki strony. Wymaga dostępu Git z prawem zapisu do `gerdax/latam`; GitHub Pages publikuje build po zakończeniu wdrożenia. Zwykłe `pnpm build` pozostaje buildem lokalnym z bazą `/`.
