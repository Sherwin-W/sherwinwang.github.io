# MBTI test: voice catalog

Every character line is a real person's recording. Nothing is synthesised. Lines without a recording are shown as subtitles only. The catalog lives in `src/mbti/stage2/voiceCatalog.ts`, with types and lookup in `voiceLines.ts`, and the files are in `public/voices/` (9 clips).

## Sources and licences

- **Mozilla Common Voice Corpus 17.0, English** (https://commonvoice.mozilla.org/en/datasets). Licence: **CC0 1.0**. Volunteers read sentences and other volunteers validate them, so every clip used here is a validated recording of exactly the listed sentence. Clips come from the CC0 mirror `fixie-ai/common_voice_17_0` on Hugging Face; the original Common Voice file name is recorded for each clip. Speaker age and gender are self-reported to the dataset, and the app never claims who the speaker is.
- **LibriTTS-R** (Y. Koizumi et al., 2023; https://www.openslr.org/141/). Licence: **CC BY 4.0**, so attribution is required. It is a sentence-segmented, restored version of public-domain LibriVox audiobook readings. The lines used are dialogue that readers voiced in character. Each clip's attribution (dataset, book and reader) is in the catalog and shown in the app. Gender comes from the dataset metadata; no age is recorded.

Credit is shown in the app ("Voices and credits" on the intro and results screens) for every clip, including the CC0 ones.

## Cast

The site owner chose these voices by listening to 39 candidates (32 new plus the previous cast) side by side in a temporary local casting tool (not part of the site). Only the chosen clips are in `public/voices/` (9 files, about 155 KB).

| Character | Scene | Part | Transcript (= subtitle) | File | Length | Speaker | Original | Licence |
|---|---|---|---|---|---|---|---|---|
| Lena | `party` | line | “What are you doing tonight?” | `public/voices/party-line.m4a` | 1.3 s | Common Voice contributor 1b1ac398 | Mozilla Common Voice Corpus 17.0 (English), common_voice_en_616239.mp3 | CC0 |
| Dr. Okoye | `interview` | line | “Have you ever had any experience?” | `public/voices/interview-line.m4a` | 2.7 s | LibriVox reader Andrea | LibriTTS-R, utterance 2276_149909_000098_000000 (LibriVox reading of “Sister Carrie”) | CC BY 4.0 |
| Jordan | `two-programs` | line | “What shall I do?” | `public/voices/two-programs-line.m4a` | 1.4 s | LibriVox reader JamesMcAndrew | LibriTTS-R, utterance 8023_286253_000054_000000 (LibriVox reading of “Happy Days”) | CC BY 4.0 |
| Walter | `walters-leap` | line | “Did you really think it through?” | `public/voices/walters-leap-line.m4a` | 2.1 s | Common Voice contributor d0b38bee | Mozilla Common Voice Corpus 17.0 (English), common_voice_en_17258596.mp3 | CC0 |
| Maya | `destiny` | line | “Everyone, when they are young, knows what their destiny is.” | `public/voices/destiny-line.m4a` | 3.8 s | Common Voice contributor de3c7a6c | Mozilla Common Voice Corpus 17.0 (English), common_voice_en_26177.mp3 | CC0 |
| Sam | `weekend` | line | “Can we plan on doing it on Tuesday?” | `public/voices/weekend-line.m4a` | 1.7 s | Common Voice contributor 0b314d9c | Mozilla Common Voice Corpus 17.0 (English), common_voice_en_17888100.mp3 | CC0 |
| Sam | `weekend` | followUp | “How do you mean?” | `public/voices/weekend-followUp.m4a` | 0.7 s | Common Voice contributor 0b314d9c | Mozilla Common Voice Corpus 17.0 (English), common_voice_en_17887940.mp3 | CC0 |
| Sam | `weekend` | outro | “See you later!” | `public/voices/weekend-outro.m4a` | 0.8 s | Common Voice contributor 0b314d9c | Mozilla Common Voice Corpus 17.0 (English), common_voice_en_17887582.mp3 | CC0 |
| Rosa | `checking-in` | line | “Are you well?” | `public/voices/checking-in-line.m4a` | 0.8 s | LibriVox reader Sarah Gutierrez | LibriTTS-R, utterance 2943_171000_000033_000001 (LibriVox reading of “Elsie Dinsmore”) | CC BY 4.0 |

## Gaps

- **Follow-up questions** have no recording for every character except Sam: the chosen speakers did not record a fitting follow-up, and splicing is not allowed. They are shown as text and the call says so.
- **Greetings and sign-offs** were dropped for every character except Sam's sign-off, because the chosen voices did not record any.
- **Stage 1 questions** have no recordings and are shown as text.

## How the clips were chosen and prepared

1. **Search.** An index of the sentence, votes, self-reported age and gender, and speaker ID of every validated English clip (1,799,288 rows) was built by reading only those Parquet columns over HTTP range requests, without downloading audio. Scenes were then adapted to short, natural questions that many people recorded, such as "What would you do?" (136 takes).
2. **One voice per character.** Every recorded line of a character comes from one speaker, and no speaker is used by two characters; tests enforce both rules. The line text was adapted to what the chosen speaker actually said.
3. **Quality screen.** Every candidate was measured for signal-to-noise ratio, clipping, bandwidth, speaking rate and leading or trailing silence. Rejected takes include one with 54 clipped samples and one with almost no energy above 1 kHz (muffled). The chosen clips have 27–41 dB SNR and no clipping.
4. **Processing** (`scripts/voices/process.py`): silence trimmed to about 120 ms before and 180 ms after speech; loudness-matched (voiced RMS −20 dBFS, short look-ahead limiter at −1.5 dBFS, all clips within about 2.4 dB); 15 ms fades; mono AAC 64 kb/s in `.m4a`, which Chrome, Edge, Safari and Firefox all play. No pitch or speed changes, and no splicing of words.

The final choice was made by ear by the site owner; the measurements above only screened out unusable takes.

## Replacing a voice

Process the new recording with `scripts/voices/process.py` into `public/voices/<scene>-<part>.m4a`, update that entry in `voiceCatalog.ts` (transcript, speaker, source, licence, duration), and change the scene's text in `scenes.ts` to match the transcript exactly. The unit tests check that subtitles equal transcripts, that the files exist and are valid, that licences and attribution are present, that each character keeps one voice, and that no file is left unused.
