# Design DNA — mubi.com

Captured at 1440×900. Ground truth = the hero screenshot; numbers = DOM extraction.

## Design Map

**Colours**
- Image ground (under hero stills): `#0B0B0E`
- Paper (sections below the fold): `#FFFFFF`
- Ink text: `#212121` · Muted text: `#7D7D7D`
- Accent: `#001489` (deep blue) — the single saturated colour
- Text over imagery: `#FFFFFF`

**Type**
- One family — **Riforma**, a Swiss grotesque — across every role.
- Display: 50px / 70px line-height, weight 500, uppercase, wide tracking.
- Body: 18px / 24px, weight 700.
- No pairing: roles are separated by size, case and tracking, not by a second family.

**Layout**
- Hero: full-bleed film still, edge-to-edge; type laid directly over it.
- Container ~1425px, body padding 0; 4-column grid, 30px gap; left-aligned, large.

**Shape**
- Radii: 2px (essentially square). Shadows: none meaningful. Borders: hairline.

**Signature**
- A frame of cinema *is* the hero. White uppercase type sits directly on a full-bleed film still; the only brand intrusions are the wordmark, the tracked headline, and one deep-blue button.

## Taste DNA

**1 — Cinema is the hero**
- Trigger: the page needs a hero.
- Decision: a full-bleed film still with type laid over it — not an illustration, gradient or product shot.
- Reason: MUBI sells cinema, so the most persuasive asset is a frame of cinema itself; the design recedes so the medium talks.
- Evidence: the hero is a dusk film still edge-to-edge; the headline sits in white directly on the image, no card or scrim box.

**2 — One voice, no pairing**
- Trigger: choosing typefaces.
- Decision: one grotesque (Riforma) for every role, separated only by size, case and tracking.
- Reason: a single typographic voice reads as authored editorial confidence; a second family would dilute it.
- Evidence: the extractor found a single family; h1 (50px/500) and body (18px/700) are the same Riforma.

**3 — Refuse ornament (Restraint)**
- Trigger: where to add visual interest.
- Decision: square corners (2px), flat surfaces (no elevation), nothing spent on chrome.
- Reason: sharp, flat surfaces keep attention on imagery and type; rounding and shadows would compete with the film stills.
- Evidence: top radius value is 2px; box-shadow is effectively absent across the page.

**4 — Exactly one colour**
- Trigger: accent usage.
- Decision: reserve one saturated colour (#001489) for the single primary action.
- Reason: one unmissable coloured object against monochrome and imagery makes the call-to-action impossible to miss.
- Evidence: accent candidates are led by rgb(0,20,137); the sign-up button is the only saturated element in the viewport.

## How this recalibrates CreaticTV

Keep our dark + gold *cinémathèque* identity, but adopt MUBI's **discipline**:
- **Let imagery be the hero** — full-bleed channel/film stills, type over image (no boxed card). Directly informs the Live preview pane and the poster heroes.
- **One accent, used sparingly** — gold only on the single primary action per surface, not scattered.
- **Sharpen and flatten** — pull radii down and cut decorative shadows; let type + imagery carry the premium feel rather than elevation.
- **Type as the system** — lean on a tight scale (our Fraunces display used with restraint + Inter for everything else), with uppercase tracked labels as a recurring device.
