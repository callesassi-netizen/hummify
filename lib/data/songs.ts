import type { Song } from "@/lib/types";

/**
 * Mock reference database.
 *
 * Each song carries:
 *   - `melody`    : MIDI notes (the iconic/hummable section)
 *   - `durations` : per-note length in beats (1 = quarter, 0.5 = eighth,
 *                   2 = half, 0.25 = sixteenth). Same length as `melody`.
 *   - `bpm`       : tempo for playback. Doesn't affect matching.
 *
 * Rhythm only affects the **playback preview** (so the user hears the
 * melody at the right speed). The matcher ignores rhythm entirely —
 * it operates on the note sequence and contour.
 *
 * Every melody here is **public domain** — traditional tunes and classical
 * themes whose composers died well over 70 years ago. That is a deliberate
 * constraint, not an accident of taste: a melody is the most strongly
 * protected part of a musical work, so a note-for-note transcription of a
 * copyrighted hook does not belong in a public repository. The matcher only
 * ever sees contours, so the choice costs the demo nothing.
 *
 * TODO (real db): swap this file for a server fetch against a proper melody
 * index, licensed for the purpose. The matcher only needs `Song.melody` to
 * be present.
 *
 * Streaming links use *search* URLs so they always resolve to something
 * sensible even without per-track IDs. Replace with real track URIs once
 * an integration exists.
 */

const search = (q: string) => ({
  spotify:    `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  appleMusic: `https://music.apple.com/search?term=${encodeURIComponent(q)}`,
  youtube:    `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
});

/**
 * Return playback-ready (notes, durations, bpm) for a song, with rests
 * filtered out and durations defaulted to 1 (quarter) per note.
 *
 * Keeps notes ↔ durations strictly parallel even after filtering nulls,
 * so the player never gets out-of-sync arrays.
 */
export function getPlayableMelody(song: Song): {
  notes: number[];
  durations: number[];
  bpm: number;
} {
  const notes: number[] = [];
  const durations: number[] = [];
  song.melody.forEach((n, i) => {
    if (n !== null) {
      notes.push(n);
      durations.push(song.durations?.[i] ?? 1);
    }
  });
  return { notes, durations, bpm: song.bpm ?? 100 };
}

export const SONGS: Song[] = [
  {
    id: "happy-birthday",
    title: "Happy Birthday to You",
    artist: "Traditional",
    section: "chorus",
    // "Hap-py birth-day to you"
    melody:    [60,    60,    62, 60, 65, 64],
    durations: [0.75,  0.25,  1,  1,  1,  2],
    bpm: 100,
    links: search("Happy Birthday to You"),
  },
  {
    id: "twinkle-twinkle",
    title: "Twinkle Twinkle Little Star",
    artist: "Traditional",
    section: "chorus",
    // "Twin-kle twin-kle lit-tle star, how I won-der what you are"
    melody:    [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60],
    durations: [1,  1,  1,  1,  1,  1,  2,  1,  1,  1,  1,  1,  1,  2],
    bpm: 110,
    links: search("Twinkle Twinkle Little Star"),
  },
  {
    id: "fur-elise",
    title: "Für Elise",
    artist: "Ludwig van Beethoven",
    section: "hook",
    // Bagatelle in A minor, WoO 59 — the alternating E / D# opening
    melody:    [76,  75,  76,  75,  76,  71,  74,  72,  69],
    durations: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5],
    bpm: 132,
    links: search("Für Elise Beethoven"),
  },
  {
    id: "symphony-5",
    title: "Symphony No. 5",
    artist: "Ludwig van Beethoven",
    section: "hook",
    // "Short-short-short-LONG", twice — three repeats then a drop
    melody:    [67,  67,  67,  63, 65,  65,  65,  62],
    durations: [0.5, 0.5, 0.5, 3,  0.5, 0.5, 0.5, 3],
    bpm: 108,
    links: search("Beethoven Symphony No. 5"),
  },
  {
    id: "mountain-king",
    title: "In the Hall of the Mountain King",
    artist: "Edvard Grieg",
    section: "hook",
    // Peer Gynt Suite No. 1 — the creeping stepwise climb in B minor
    melody:    [59,  61,  62,  64,  66,  62,  66,  64,  62,  66,  64,  62],
    durations: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5],
    bpm: 138,
    links: search("In the Hall of the Mountain King Grieg"),
  },
  {
    id: "eine-kleine-nachtmusik",
    title: "Eine kleine Nachtmusik",
    artist: "Wolfgang Amadeus Mozart",
    section: "hook",
    // K. 525, Allegro — the rising G major arpeggio
    melody:    [67,  62,  67,  62,  67,  71,  74],
    durations: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.5],
    bpm: 132,
    links: search("Eine kleine Nachtmusik Mozart"),
  },
  {
    id: "canon-in-d",
    title: "Canon in D",
    artist: "Johann Pachelbel",
    section: "hook",
    // The descending ground bass everyone recognises
    melody:    [66, 64, 62, 61, 59, 57, 59, 61],
    durations: [2,  2,  2,  2,  2,  2,  2,  2],
    bpm: 64,
    links: search("Pachelbel Canon in D"),
  },
  {
    id: "greensleeves",
    title: "Greensleeves",
    artist: "Traditional",
    section: "verse",
    // English, 16th century — arching minor line
    melody:    [57, 60, 62, 64,  65,  64, 62, 59, 55, 57, 59, 60, 57],
    durations: [1,  2,  1,  1.5, 0.5, 1,  2,  1,  1,  2,  1,  1,  2],
    bpm: 100,
    links: search("Greensleeves"),
  },
  {
    id: "scarborough-fair",
    title: "Scarborough Fair",
    artist: "Traditional",
    section: "verse",
    // "Are you go-ing to Scar-bo-rough Fair"
    melody:    [57,  57,  64, 64,  59,  60, 59, 57],
    durations: [1.5, 1.5, 3,  1.5, 0.5, 1,  1,  3],
    bpm: 96,
    links: search("Scarborough Fair traditional"),
  },
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    artist: "Traditional",
    section: "chorus",
    // "A-ma-zing grace, how sweet the sound"
    melody:    [62, 67, 71,  67,  71, 69, 67, 64, 62],
    durations: [1,  2,  0.5, 0.5, 2,  1,  2,  1,  2],
    bpm: 80,
    links: search("Amazing Grace"),
  },
  {
    id: "when-the-saints",
    title: "When the Saints Go Marching In",
    artist: "Traditional",
    section: "chorus",
    // Three rising runs, then the turn back down
    melody:    [60, 64, 65, 67, 60, 64, 65, 67, 60, 64, 65, 67, 64, 60, 64, 62],
    durations: [1,  1,  1,  3,  1,  1,  1,  3,  1,  1,  1,  2,  2,  1,  1,  4],
    bpm: 120,
    links: search("When the Saints Go Marching In"),
  },
  {
    id: "row-your-boat",
    title: "Row, Row, Row Your Boat",
    artist: "Traditional",
    section: "chorus",
    // "Row, row, row your boat, gent-ly down the stream"
    melody:    [60, 60, 60,   62,   64, 64,   62,   64,   65,   67],
    durations: [1,  1,  0.75, 0.25, 1,  0.75, 0.25, 0.75, 0.25, 2],
    bpm: 100,
    links: search("Row Row Row Your Boat"),
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    artist: "Ludwig van Beethoven",
    section: "hook",
    // Symphony No. 9 main theme — mostly quarter notes
    melody:    [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64,  64,  62, 62],
    durations: [1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1.5, 0.5, 1,  2],
    bpm: 110,
    links: search("Ode to Joy Beethoven"),
  },
  {
    id: "mary-had-a-little-lamb",
    title: "Mary Had a Little Lamb",
    artist: "Traditional",
    section: "chorus",
    // "Ma-ry had a lit-tle lamb, lit-tle lamb, lit-tle lamb"
    melody:    [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67],
    durations: [1,  1,  1,  1,  1,  1,  2,  1,  1,  2,  1,  1,  2],
    bpm: 110,
    links: search("Mary Had a Little Lamb"),
  },
  {
    id: "jingle-bells",
    title: "Jingle Bells",
    artist: "Traditional",
    section: "chorus",
    // "Jin-gle bells, jin-gle bells, jin-gle all the way"
    melody:    [64, 64, 64, 64, 64, 64, 64, 67, 60, 62, 64],
    durations: [1,  1,  2,  1,  1,  2,  1,  1,  1,  1,  4],
    bpm: 120,
    links: search("Jingle Bells"),
  },
  {
    id: "frere-jacques",
    title: "Frère Jacques",
    artist: "Traditional",
    section: "chorus",
    // "Frè-re Jac-ques, Frè-re Jac-ques, dor-mez vous, dor-mez vous"
    melody:    [60, 62, 64, 60, 60, 62, 64, 60, 64, 65, 67, 64, 65, 67],
    durations: [1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  1,  1,  2],
    bpm: 100,
    links: search("Frère Jacques"),
  },
];
