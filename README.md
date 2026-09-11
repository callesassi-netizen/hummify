# Hummify

> Nynna en melodi. Vi gissar låten.

En Shazam-inspirerad webapp där du **nynnar, sjunger eller visslar** en
melodi och appen försöker identifiera vilken låt det är. Byggd som
premium-MVP med fokus på en tydlig arkitektur som kan växa: själva
igenkänningsmotorn är isolerad bakom ett rent gränssnitt och kan bytas
ut mot en riktig melodidatabas eller ML-modell utan att UI:t påverkas.

---

## Snabbstart

```bash
cd hummify
npm install
npm run dev
```

Öppna **http://localhost:3030** i Chrome, Edge, Safari eller Firefox.
Acceptera mikrofonbehörigheten när webbläsaren frågar.

> **Port 3030** är vald för att inte krocka med t.ex. WordPress eller
> annan utveckling på `:3000`. Byt i `package.json` om du vill ha en
> annan.

> **iOS / Safari:** Mikrofon kräver HTTPS i produktion. Lokalt på
> `localhost` fungerar HTTP. För att testa på en fysisk telefon mot
> din utvecklingsdator: använd `ngrok http 3030` eller motsvarande.

### Scripts

| Kommando            | Vad det gör                                       |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Startar dev-servern på `localhost:3030`           |
| `npm run build`     | Bygger produktionsversion                         |
| `npm start`         | Kör produktionsversionen på `localhost:3030`      |
| `npm run type-check`| TypeScript-kontroll utan att bygga                |

---

## Hur fungerar matchningen?

Pipelinen följer i grova drag det här:

```
mic  ─►  AudioContext  ─►  Float32 audio frames  ─►  pitchy (MPM)  ─►  PitchFrame[]
                                                                            │
                                                                            ▼
                                              extractMelody  ─►  MelodyContour
                                                                            │
                                                                            ▼
                                                              findMatches → top 1–3
```

1. **Mikrofon** — `navigator.mediaDevices.getUserMedia` med
   `echoCancellation: false` så vi får råa toner snarare än
   VoIP-städat ljud.
2. **AudioContext + AnalyserNode** — varje requestAnimationFrame-tick
   tar vi ett 2048-samples-fönster.
3. **Pitch detection** — biblioteket [`pitchy`](https://github.com/ianprime0509/pitchy)
   implementerar **McLeod Pitch Method**. Den är robust mot
   oktavfel (klassiskt problem för rena autokorrelations-metoder),
   snabb nog att köra i huvudtråden och returnerar dessutom ett
   *clarity*-värde 0..1 så vi kan slänga ovokala frames.
4. **Melodi-extraktion** (`lib/audio/melodyExtraction.ts`) —
   median-smoothar tonsekvensen för att radera spik-fel,
   run-length-komprimerar (en utdragen ton räknas som *en* not),
   och bygger en **Parsons-kod** (`uudrudd…`) + en intervallsekvens
   i halvtonsteg.
5. **Matchning** (`lib/matching/`) — för varje låt i mock-databasen:
   - **Glider** användarens mönster över referensmelodin.
   - För varje förskjutning:
     - Räknar andel matchande Parsons-riktningar (riktnings-likhet).
     - Räknar medel-absolut intervallavvikelse (tonsteg-likhet).
   - Kombinerar `0.6·riktning + 0.4·intervall`, med en liten bonus
     för längre matchade fönster.
6. **Confidence** — bästa alignment-poängen multipliceras med en
   liten *clarity-faktor* (0.9–1.1). Resultat under 25% filtreras
   bort hellre än att visa nonsens.

Detta gör matchningen **transpositionsoberoende** (du kan nynna i
vilken tonart som helst) och **tempo-tolerant** i normalfallet
eftersom rep-noter komprimeras.

---

## Vad är riktigt och vad är mockat?

| Område                       | Status               |
| ---------------------------- | -------------------- |
| Mikrofoninspelning           | **Riktig** (Web Audio API) |
| Pitch detection              | **Riktig** (`pitchy` / McLeod) |
| Melodi-extraktion & kontur   | **Riktig** (median-smooth, run-length, Parsons + intervall) |
| Matchningslogik              | **Riktig** algoritm, men kör mot mockad databas |
| Låtdatabas                   | **Mockad** — 16 handskrivna MIDI-melodier i `lib/data/songs.ts`, alla public domain |
| Streaminglänkar              | **Mockade sökningar** — Spotify/AM/YT search-URLs (alltid giltiga) |
| "Analyserar"-fördröjning     | 650ms syntetisk paus så loading-animationen hinner synas |

Hela igenkänningskedjan är alltså på riktigt — det enda som är "fake"
är *innehållet* i databasen och avsaknaden av direkta track-URI:er.

**Om låtvalet.** Databasen innehåller enbart public domain-melodier:
traditionella visor och klassiska teman vars upphovsmän dog för långt över
sjuttio år sedan. Det är ett medvetet val, inte en slump. Melodin är den
starkast skyddade delen av ett musikaliskt verk, och en not-för-not-
transkription av en upphovsrättsskyddad hook hör inte hemma i ett öppet
repo — särskilt inte i en app som spelar upp den. Matchningen ser ändå bara
konturer, så begränsningen kostar demot ingenting.

---

## Filstruktur

```
hummify/
├── app/
│   ├── layout.tsx              # Fonter, metadata, ambient bakgrund
│   ├── page.tsx                # State-maskin: idle → recording → analyzing → results
│   └── globals.css             # Tailwind base + premium dark theme
├── components/
│   ├── RecordButton.tsx        # Stor rund CTA med pulsanimation
│   ├── Visualizer.tsx          # Canvas-baserad frekvensbar-visualizer
│   ├── AnalyzingState.tsx      # Loading-läget med "Analyserar melodi…"
│   ├── ResultsList.tsx         # Lista av matchningar + "Nynna igen"
│   ├── ResultCard.tsx          # Enskilt låtförslag + streaming-länkar
│   └── ErrorState.tsx          # Felmeddelanden (nekad mic, för kort, etc)
├── lib/
│   ├── types.ts                # Domäntyper (Song, PitchFrame, MelodyContour, …)
│   ├── audio/
│   │   ├── recorder.ts         # AudioRecorder-klass (mic + AnalyserNode + rAF-loop)
│   │   ├── pitchDetection.ts   # pitchy-wrapper, hz↔midi-konvertering
│   │   └── melodyExtraction.ts # Median-smooth, run-length, Parsons, intervall
│   ├── matching/
│   │   ├── contour.ts          # Lågnivå: Parsons-agreement, intervalldiff, sliding
│   │   └── matcher.ts          # Hög-nivå: findMatches() → MatchResult[]
│   └── data/
│       └── songs.ts            # Mockad låtdatabas (handtranskriberade MIDI-melodier)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.mjs
```

---

## Tekniska val (och varför)

- **Next.js 14 (App Router) + TypeScript + Tailwind** — snabbast väg
  till en mobile-first webbapp som funkar i alla browsers utan
  app-store-friktion. PWA-redo via metadata-/viewport-API:erna.
- **Web Audio API direkt, inte MediaRecorder** — vi behöver inte
  spara/skicka råljudet, bara analysera det. Att stanna i
  `Float32`-land sparar både CPU och kod.
- **`pitchy` (MPM)** — bättre än grundläggande autokorrelation,
  lättare än att köra en WASM-modell som CREPE/SPICE i MVP. Ger
  oss dessutom clarity-värde gratis.
- **Parsons + intervall + sliding alignment** — robust mot
  transposition och rimligt OK mot tempo-variation utan att vi
  behöver implementera full DTW i v1. Lätt att läsa, lätt att
  byta ut.
- **`framer-motion`** — ger oss "premium-känsla" animationer
  (puls runt knappen, fade-in på resultat) utan att vi behöver
  rulla egna keyframes.

---

## Föreslagna nästa steg

För att gå från "bra demo" till "faktiskt brukbar":

1. **Riktig melodi-databas.** Importera contour-data från en öppen
   källa (t.ex. extrahera melodi-spår från MIDI-arkiv av populära
   låtar). Spara som JSON med fält `id, title, artist, melody[]`.
   Inga UI-ändringar behövs — bara byt ut `lib/data/songs.ts`.
2. **Byt sliding-alignment mot DTW** i `lib/matching/contour.ts`.
   En Sakoe-Chiba-bandad DTW hanterar användare som hoppar över
   eller lägger till noter mitt i frasen — vanligaste felkällan i
   nuvarande matchning.
3. **Audio Worklet för pitch detection.** Flytta `detect()`-anropet
   till `AudioWorkletNode` så main-thread kan rendera 60fps även på
   svaga telefoner.
4. **CREPE/SPICE via WASM eller TF.js.** För svårare ljud (visslande
   med läckage, brus) ger ML-baserad pitch detection klart bättre
   resultat. Wrappa den så `createPitchDetector()`-signaturen är
   oförändrad.
5. **Backend för matchning.** Flytta `findMatches()` till en Next.js
   Route Handler eller en separat tjänst. Skickar man pitch-konturer
   (inte audio) är data ~1 kB, kostar nästan ingenting att skala.
6. **Spotify Web API.** Med en användarinloggning kan vi byta
   sök-länkarna mot riktiga track-URI:er, inbäddad spelare och
   "spara till bibliotek".
7. **Användarkonton + historik.** Supabase eller Clerk räcker —
   historik är bara `(user_id, contour, top_match, created_at)`.
8. **Crowd-sourcing.** Spara *anonymiserade* pitch-konturer av
   verifierade matchningar och använd dem som extra träningsdata
   för en lärande matchningsmodell.
9. **Fingerprinting för originalljud.** Lägg till en *separat* väg
   för "användaren spelar originalinspelningen" via t.ex. Chromaprint /
   acoustid. En enkel klassificerare på inspelningens spektrala
   bredd kan routa mellan "hum-engine" och "fingerprint-engine".

---

## Kända begränsningar i MVP:n

- Databasen är liten (16 låtar) — många försök kommer ge svaga
  matchningar oavsett hur välsjungen frasen är.
- Bakgrundsbrus, vibrato och uppenbara fel-toner kan göra att
  pitch-detektorn slänger för många frames och appen säger
  "för få tydliga toner".
- Auto-stopp efter 15 sekunder. Längre inspelningar är generellt
  inte bättre — användaren upprepar bara samma fras.
- Ingen tonart-/tempo-detektion: bara melodikontur.

---

## Licens

MIT.
