# Music Analyzer Spot-Check Notes

Use this file after running 3-4 real songs through the analyzer.

| Track file | Runtime | Sections / chorus / drop quality | Key moments quality | Build-ups quality | Main issue | Tune needed? |
| --- | --- | --- | --- | --- | --- | --- |
| E lucevan le stelle.mp3 | Not recorded by runner | 10 sections; low opening and high-energy finale structure looks plausible from the report. | 8 key moments, 3 climaxes; climaxes cluster in the final third, which looks plausible for a finale-oriented track. | 4 build-ups; all short 3.99s ramps into late peaks. | MP3 decode warnings required audioread fallback. Need listening check for whether bridge/chorus labels match the song. | Maybe after listening check |
| Raindrops—Flavio Belardo.mp3 | Not recorded by runner | 6 sections; starts as CHORUS and stays mostly medium intensity. This may be acceptable for a short dense track, but needs listening check. | 7 key moments, 2 climaxes; markers are distributed across the track. | 2 build-ups; enough for a 1:34 track. | No high-intensity sections despite high peak energy; verify if this feels too conservative visually. MP3 decode warnings required audioread fallback. | Maybe |
| はちみ-requiem.mp3 | Not recorded by runner | 9 sections; late chorus/bridge high-energy finale looks plausible. | 10 key moments, 3 climaxes; final climax at the end looks useful for show design. | 4 build-ups; one very early build-up may need listening validation. | MP3 stream had several decode/resync warnings before audioread fallback succeeded. | Maybe after listening check |

## Summary

- Overall readiness: All three tracks produced schema `1.2.0` analysis JSON, compact payload JSON, Markdown reports, and run logs.
- Biggest issue found: The MP3 files triggered decoder warnings and fell back to `audioread`; outputs were still produced successfully.
- Suggested tuning: Do a listening pass against the generated section labels and key moments. Pay special attention to whether Raindrops is under-classified as medium intensity and whether the early build-up in はちみ-requiem is musically useful.
- Demo risk: Medium-low for local analysis output. The main risk is subjective section/peak quality, not pipeline failure.
