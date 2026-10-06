# Weryfikacja

Sprawdzone 6 października 2026:

- Kompilacja TypeScript i build produkcyjny Vite: poprawne.
- 27 testów automatycznych: poprawne. Obejmują proporcje wznoszenia/opadania, zmianę kierunku i bezwładność, zgodność przy 30 i 120 klatkach/s, sufit, kolizje po przechyleniu, rozpiętość skrzydeł, restart, ciągłość terenu oraz ograniczoną liczbę segmentów i lotnisk po 100 000 jednostek lotu. Dodatkowo: udane i zbyt mocne przyziemienie, kontakt kadłubem, hamowanie i postój, start, przerwany rozbieg, koniec pasa oraz konfiguracja parametrów samolotu.
- Podgląd w przeglądarce: widoki 1280×720 i 390×844, brak widocznych napisów/interfejsu, terrain wypełnia dolną krawędź, działający WebGL, brak błędów w konsoli podczas sprawdzenia. Wysłano przeciągnięcie i strzałkę do gry.
- Przegląd kodu i geometrii przez niezależnego agenta; wykryte problemy z orientacją ścian terenu, dolną krawędzią terenu i obrysem kolizji poprawiono oraz objęto testami. Przy rozbudowie o lotniska poprawiono również konflikt głębokości asfaltu i trawy przez polygon offset. Pas obejrzano w przeglądarce; pełny cykl lądowania/startu sprawdzono testami symulacji, bez ręcznego wykonania w przeglądarce.

Ograniczenia: nie sprawdzono na fizycznym telefonie, nie oceniono dźwięku odsłuchem, nie wykonano długiego profilowania pamięci/GPU w przeglądarce. Pauzowanie po ukryciu karty zweryfikowano w kodzie, bez osobnego testu przeglądarkowego. Obrys kolizji jest próbkowanym przybliżeniem modelu, a fizyka jest celowo uproszczona. Sterowanie po zmianach lotnisk nie było ponownie testowane na fizycznym urządzeniu.

W tej sesji Node.js pochodził z dołączonego środowiska Codex; systemowy `node` nie był dostępny w PATH.

Model zmniejszono do ⅔ pierwotnych wymiarów. Skalę zastosowano również do punktów kolizji, prześwitu podwozia na pasie i promienia toczenia kół.

Po rozbudowie własnej fizyki zderzeń przechodzi 38 testów i build produkcyjny. Testy obejmują sprężystość 0.4–0.6, kierunek momentu obrotowego przy kontakcie dzioba i skrzydła, tarcie bez dodawania energii, tłumienie, wielokrotne kontakty, zgodność przy 30 i 120 klatkach/s, obrys śmigła, ignorowanie sterowania po uderzeniu i czysty restart po trzech sekundach. Niezależny przegląd potwierdził brak wzrostu energii w 5000 losowych przypadkach kontaktu. Dodano również punkty podparcia obwodu podstawy ogona.

W lokalnym podglądzie obejrzano próbki zderzenia i osiadania po 0.65 oraz 1.8 sekundy, bez błędów konsoli. Model korzysta bezpośrednio z orientacji bryły, bez sztucznego obracania lub zmniejszania wraku. Materiał ma sprężystość 0.5, tarcie 0.55, tłumienie liniowe 1.4 i kątowe 2. Solver jest uproszczony: próbkowany obrys, przybliżona bezwładność pudełka, korekcja penetracji w pionie, brak precesji żyroskopowej. Translacja pozostaje w płaszczyźnie lotu, obrót może zachodzić w trzech osiach. Zewnętrznego silnika fizycznego nie dodano. Nie powtarzano odsłuchu ani testu na fizycznym telefonie.

Dodano dym po kolizji: początkowy wyrzut i ciągła emisja przy uszkodzonym silniku, unoszenie, dryf i zanikanie. Pula 96 sprite'ów oraz jedna współdzielona tekstura są używane ponownie; restart usuwa widoczne cząstki. Dym obejrzano w lokalnym podglądzie po 1.8 sekundy zderzenia, bez błędów konsoli; TypeScript i build produkcyjny przechodzą. Nie powtarzano testów fizyki, której nie zmieniono, ani pomiarów GPU na telefonie.
