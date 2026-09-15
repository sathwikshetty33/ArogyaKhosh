# ArogyaKhosh — ML

Models behind the emergency flow. Nothing here is served yet; the Python gRPC
service that exposes these to the Go API comes next.

## notebooks/accident_verifier.ipynb

Trains the accident-photo classifier: a frozen CLIP encoder with a logistic
regression head on top. Built to run in Colab — set a Roboflow API key and a
dataset in the config cell and run top to bottom.

It emits `artifacts/accident_head.json`, which carries the CLIP model id, the
linear weights, the class order and the chosen threshold. The encoder itself is
pulled from Hugging Face by id at serving time, so the artifact stays a few KB.

Two things in the notebook are deliberate rather than incidental:

- **Tuned for recall, not accuracy.** The emergency contact makes the real
  decision, so a false alarm costs one SMS while a miss costs a life. The
  threshold is picked as the highest one that still hits `TARGET_RECALL` on the
  validation split, and the notebook reports how many alerts that buys per real
  accident caught.
- **The threshold is exported, not baked in.** The Go service reads it from the
  artifact, so sensitivity can be retuned in production without retraining.

### Scope: vehicles, not people

The positive class is **a damaged vehicle or a crash scene**, never an injured
person. Two reasons, and the second is the important one:

1. No usable public dataset of injured people exists, and won't — such images
   cannot be published with consent.
2. Asking a bystander to photograph an injured stranger is a worse instruction
   than asking for the vehicle. It is invasive, legally awkward in many places,
   and it puts a phone between someone and a person who needs help.

The cost is real: a pedestrian struck by a car that left the scene, a fall, or
any medical emergency with no vehicle in frame will score low. That is why the
emergency page needs a second path — *can't get a clear photo?* — which alerts
the contact anyway and marks the report `unverified`. Nobody should go
unreachable because a classifier saw no bumper.

### Getting negatives

Most accident datasets on Roboflow are positives-only. The notebook takes
negatives from any number of extra sources — `NEGATIVE_SOURCES` for Roboflow
projects, `NEGATIVE_FOLDERS` for local directories — and assigns them a split.

The trap is subtler than it looks. If the negatives were shot differently from
the positives (catalogue photos of cars against studio backgrounds, say, versus
web photos of roadside wreckage) the model learns *which dataset an image came
from* and scores beautifully while being useless in production. So:

- prefer negatives with the same character as the positives: roadside photos of
  ordinary vehicles and traffic, not product shots
- use two or three negative sources, so "source" is not one clean signal
- section 4 reports image geometry per class and warns on obvious mismatches
- section 9 scores photos you took yourself, which belong to neither dataset —
  the gap between that number and the test-set number *is* the dataset bias,
  measured

### Known limits

Public accident datasets are overwhelmingly dashcam or CCTV footage of the
*moment of impact*. Our real input is a handheld phone photo of the *aftermath*.
Section 4 of the notebook prints a sample grid precisely so this mismatch is
visible before you trust the numbers. If the test metrics look good but photos
you take yourself score badly, the dataset is the problem, not the model.

No classifier solves spoofing — a crash photo saved from the web is genuinely a
crash photo. That is handled with EXIF and geolocation checks, per-token rate
limits, and the human in the loop.
