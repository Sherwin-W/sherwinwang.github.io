# Asset and model sources

- `public/objects/*.svg`: original vector illustrations created for this page
  following Claude's completed art direction. No outside artwork, stock art,
  or image-generation service is included.
- `public/objects/roadmap/*.svg`: 36 additional original illustrations
  prepared for the catalog roadmap. These files are not in the active catalog
  and are not recognized classes.
- `public/paper-fibers.svg`: original lightweight SVG paper texture. Type uses
  system Georgia and system UI fonts. No remote font or asset is requested.
- `scripts/drawing-recognition/`: reproducible Quick, Draw! sample, model
  training/export and evaluation tools. Google Creative Lab's Quick, Draw!
  bitmap data is published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Attribution: Google Creative Lab, Quick, Draw! Dataset. The current active
  model is `public/models/drawing-recognizer-cnn/`; preserved 24-label MLP
  comparison weights are in `public/models/drawing-recognizer-24-candidate/`
  and the original 12-label weights in `public/models/drawing-recognizer/`.
  No raw visitor drawings or downloaded sample files are committed.

Exact prompts, category coverage, model sizes, evaluation protocol, class
metrics and limitations are recorded in `RECOGNITION.md`,
`MODEL_COMPARISON.md`, and `recognition-metrics-cnn-candidate.json`.
