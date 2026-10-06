# Pastelowy lot

Projekt lokalnej gry przeglądarkowej. Oryginalna ilustracja znajduje się w `references/` i nie jest zmieniana ani wymagana podczas gry.

Wymagania: Node.js 22.12+ oraz pnpm. Uruchomienie: `pnpm install`, następnie `pnpm dev`. Weryfikacja: `pnpm test` i `pnpm build`. Podgląd produkcji: `pnpm exec vite preview --host 0.0.0.0`.

Przeciągnięcie w górę lub w dół steruje lotem; strzałki góra/dół działają identycznie. Dźwięk włącza się przy pierwszym sterowaniu. Kolizja powoduje automatyczny restart. Parametry lotu są w `src/physics.ts`, sceneria w `src/terrain.ts`, model w `src/aircraft.ts`.

Lotniska pojawiają się co około 41 sekund lotu (pierwsze po około 16 sekundach). Aby wylądować, wyrównaj samolot i zmniejsz opadanie przed dotknięciem pasa kołami. Po przyziemieniu samolot automatycznie hamuje. Przytrzymaj sterowanie w górę, aby ponownie rozpędzić się i wystartować; puszczenie podczas rozbiegu przerywa start. Mocne uderzenie, kontakt kadłubem lub wyjazd poza koniec pasa powodują zderzenie. Położenie lotnisk jest w `src/airports.ts`; limity lądowania i rozbiegu są w konfiguracji fizyki.

Zderzenia korzystają z własnego, uproszczonego solvera bryły sztywnej w `src/crash.ts`. Impulsy kontaktowe wywołują odbicie i obrót w trzech osiach, z tarciem, grawitacją oraz tłumieniem. Środek samolotu pozostaje w płaszczyźnie lotu. Sprężystość domyślnie wynosi 0.5; wolne kontakty nie odbijają, dzięki czemu wrak osiada. Materiał jest konfigurowany przez `crashMaterial` w konfiguracji lotu. Restart następuje po trzech sekundach; podczas zderzenia sterowanie jest wyłączone. Bez zewnętrznego silnika fizycznego.
