# Playable portfolio catalog roadmap

This is a proposed content and recognition plan, not a claim that all listed
objects are currently recognized. The interaction milestone was verified with the original twelve labels. The
active supported collection is now 24 labels in the batch-24 training/export
contract and `src/playable/catalog.js`. This 24-class batch has held-out and
browser-preprocessing evidence; review the weak classes in `RECOGNITION.md`
before continuing toward 60.

## Source labels and artwork policy

The training-label availability check used Google's canonical
[Quick, Draw! `categories.txt`](https://github.com/googlecreativelab/quickdraw-dataset/blob/master/categories.txt),
which lists 345 dataset prompts, and its
[dataset README](https://github.com/googlecreativelab/quickdraw-dataset#the-data).
Quick, Draw! provides broad prompt coverage; it does not certify that a label
will be visually separable in this app's smaller classifier. Availability below
means the exact prompt name appears in that listing. Parenthetical display names
are UI wording only. Do not merge semantically adjacent prompts (for example,
`airplane` and `helicopter`) into one training class without a deliberate label
mapping and evaluation. The current `rose`, `oak`, `pine`, and similar catalog
aliases are search/display aliases; they are not extra trained labels.

All portfolio object art must be original artwork authored in this repository,
following [`ART_DIRECTION.md`](ART_DIRECTION.md). Dataset drawings are training
examples, not artwork to copy into the product. A label becomes
**recognition-supported** only after it is in training, exported model labels,
the catalog, original artwork, and browser inference, with held-out per-class
results documented. Until then it is a roadmap candidate or a picker-only item.

## Category plan

The 60-object portfolio is organized across six categories. Existing entries
remain in their present categories; future batch members spread the collection
across animals, plants, food, household objects, transport, and sky objects.
Fungi are grouped with plants for this portfolio. These are visual browsing
categories, independent of the classifier's label order.

## Milestone 12: current supported collection

Every label below is present in the official listing and in the current training
and browser model. Artwork is present under `public/objects/`.

| Category | Training label | Status / note |
| --- | --- | --- |
| Animals | `cat` | Supported now |
| Animals | `dog` | Supported now |
| Animals | `rabbit` | Supported now |
| Animals | `bird` | Supported now |
| Animals | `fish` | Supported now |
| Animals | `butterfly` | Supported now |
| Plants and fungi | `tree` | Supported now |
| Plants and fungi | `flower` | Supported now |
| Plants and fungi | `mushroom` | Supported now; portfolio groups fungi here |
| Plants and fungi | `cactus` | Supported now |
| Sky | `sun` | Supported now |
| Sky | `moon` | Supported now |

## Milestone 24: completed 12-label expansion

All exact labels below appear in the official listing. This batch adds breadth
to every planned category except sky, which already has Sun and Moon. Use exact
training labels in exports; human-friendly labels appear in parentheses.

| # | Category | Exact training label | Display label | Status |
| ---: | --- | --- | --- | --- |
| 13 | Animals | `cow` | Cow | Integrated and evaluated |
| 14 | Animals | `duck` | Duck | Integrated; weak auto coverage |
| 15 | Animals | `elephant` | Elephant | Integrated; weak recognition |
| 16 | Animals | `frog` | Frog | Integrated; weak recognition |
| 17 | Plants | `leaf` | Leaf | Integrated and evaluated |
| 18 | Plants | `house plant` | Potted plant | Integrated; exact-label display mapping |
| 19 | Food | `apple` | Apple | Integrated and evaluated |
| 20 | Food | `banana` | Banana | Integrated and evaluated |
| 21 | Food | `pizza` | Pizza | Integrated and evaluated |
| 22 | Household | `chair` | Chair | Integrated and evaluated |
| 23 | Transport | `airplane` | Airplane | Integrated and evaluated |
| 24 | Transport | `bicycle` | Bicycle | Integrated and evaluated |

The 24-label model, artwork, picker, and browser inference are integrated. Its
per-class top-1/top-3, confusions, unknown rejection, and auto-spawn
precision/coverage are reported in `RECOGNITION.md` and the JSON metrics. Review
that evidence before selecting or integrating more classes. Choose any
auto-spawn score-and-margin rule on validation data only; do not call raw
softmax scores calibrated confidence or tune the rule on test data. If a label
or group performs weakly, report that limitation and keep it picker-only or
suggestion-only until the evidence supports a change.

## Roadmap to 60: proposed later additions

These 36 exact prompt names are available in the official listing. They are
candidate labels only; availability does not imply adequate model quality.

| # | Category | Exact training label | Display label | Availability / mapping note |
| ---: | --- | --- | --- | --- |
| 25 | Animals | `bear` | Bear | Available, exact |
| 26 | Animals | `bee` | Bee | Available, exact |
| 27 | Animals | `crab` | Crab | Available, exact |
| 28 | Animals | `dolphin` | Dolphin | Available, exact |
| 29 | Animals | `horse` | Horse | Available, exact |
| 30 | Animals | `lion` | Lion | Available, exact |
| 31 | Animals | `owl` | Owl | Available, exact |
| 32 | Animals | `penguin` | Penguin | Available, exact |
| 33 | Plants | `grass` | Grass | Available, exact |
| 34 | Plants | `palm tree` | Palm tree | Available, exact; distinct prompt from `tree` |
| 35 | Plants | `bush` | Bush | Available, exact |
| 36 | Plants | `rose` | Rose | **Available**, exact prompt; distinct from broad `flower` |
| 37 | Food | `bread` | Bread | Available, exact |
| 38 | Food | `cake` | Cake | Available, exact |
| 39 | Food | `carrot` | Carrot | Available, exact |
| 40 | Food | `cookie` | Cookie | Available, exact |
| 41 | Food | `donut` | Donut | Available, exact |
| 42 | Food | `grapes` | Grapes | Available, exact |
| 43 | Food | `ice cream` | Ice cream | Available, exact |
| 44 | Food | `strawberry` | Strawberry | Available, exact |
| 45 | Household | `bed` | Bed | Available, exact |
| 46 | Household | `book` | Book | Available, exact |
| 47 | Household | `broom` | Broom | Available, exact |
| 48 | Household | `clock` | Clock | Available, exact |
| 49 | Household | `floor lamp` | Floor lamp | Available, exact; colloquial `lamp` is a display alias, not a source label |
| 50 | Household | `mug` | Mug | Available, exact |
| 51 | Household | `toaster` | Toaster | Available, exact |
| 52 | Household | `vase` | Vase | Available, exact |
| 53 | Transport | `ambulance` | Ambulance | Available, exact |
| 54 | Transport | `bus` | Bus | Available, exact |
| 55 | Transport | `helicopter` | Helicopter | Available, exact; distinct prompt from `airplane` |
| 56 | Transport | `motorbike` | Motorbike | Available, exact |
| 57 | Transport | `sailboat` | Sailboat | Available, exact |
| 58 | Sky | `cloud` | Cloud | Available, exact |
| 59 | Sky | `rainbow` | Rainbow | Available, exact |
| 60 | Sky | `star` | Star | Available, exact |

All 60 planned training labels now match exact prompts in the canonical listing.
The `lamp`/`floor lamp` distinction is a naming ambiguity: use `floor lamp` as
the training/export label and `Floor lamp` for display. Check every selected
label against catalog aliases and every `other` training category before
implementation; a label currently used as a negative example must be removed
from that group before becoming supported.

## Expansion and quality gates

For each batch, add a category only when all of the following are complete:

1. Exact source prompt, intended display name, category, and any mapping are
   recorded. Ambiguous or composite mappings are evaluated as mappings, not
   assumed equivalent.
2. Training examples are added with disjoint train, validation, and test
   sources. Revise the `other` set so it does not contain newly supported
   labels, and preserve representative unsupported categories.
3. The exported label order and model manifest include the class; browser
   inference and its supported/unknown filtering consume that same contract.
4. An original, recognizable in-repo illustration follows the shared visual
   direction and has an accessible picker name. Add individual animation only
   where it helps the object read clearly.
5. Report per-class top-1/top-3 quality, relevant confusions, held-out
   unsupported behavior, and any weak category. Measure auto-spawn precision
   and coverage on an independent held-out set after choosing the acceptance
   rule from validation. Do not describe scores as calibrated probabilities.
6. Exercise browser inference and the picker at desktop and mobile sizes. Keep
   model loading separate from basic canvas interaction.

The next expansion beyond 24 should be planned only after the 24-label results
are reviewed. Do not fill all 60 slots in one model change.
