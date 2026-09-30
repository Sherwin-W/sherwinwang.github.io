# Asset sources

- `public/objects/*.svg`: original vector illustrations authored for this page by the implementation worker, following `ART_DIRECTION.md`; no external artwork, model, font, or stock asset used. Colors and shapes were customized to the paper-cutout specification.
- `public/paper-fibers.svg`: original lightweight SVG turbulence texture authored for this page; no external source.
- UI type uses system Georgia and system UI fonts. No remote assets or visitor uploads.
- `scripts/drawing-recognition/train.py` samples category-specific 28×28 bitmap rows from Google's [Quick, Draw! dataset](https://github.com/googlecreativelab/quickdraw-dataset). The dataset is released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); attribution: Google Creative Lab, Quick, Draw! Dataset. A deterministic subset-trained model is exported to `public/models/drawing-recognizer/`; no raw user drawings or dataset sample files are included in the repository. Details, class coverage, model size, evaluation and limitations are recorded in `RECOGNITION.md` and `recognition-metrics.json`.
