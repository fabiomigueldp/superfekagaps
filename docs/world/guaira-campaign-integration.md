# Guaíra campaign integration

## Campaign and compatibility

The authored route is Costa → Porto → Fábrica → Guaíra → Serra → Reserva → Domínio. Guaíra is a named chapter region, not a renumbering of the released numeric worlds. The original 30 stage IDs, 72 seals, records and checkpoints remain unchanged. The chapter contributes five completion receipts and optional Galeria/Câmara completion: 35 required campaign sections in total.

A new save opens Guaíra after 3-5. Finishing 3-5 presents its region/flight chooser. The mayor's genuine water-release result opens Serra. The former Factory–Serra path remains a maintenance shortcut after this gate. An imported pre-chapter v1 save that already completed 3-5 retains its earned Serra access through `legacySerraAccess`; it does not receive fabricated Guaíra receipts. Imports/exports include the additive versioned chapter object while retaining the established storage key and v1 campaign envelope.

## Chapter persistence

Only durable facts cross sessions: chosen opening, contiguous completed scenes, current/next selection, interrupted scene ID, optional completions and audio-enabled preference. Attempt/generation tokens and native game objects are never restored. Real, living runtime completion is saved immediately, before pressing Continue or leaving the map. Reloading an unfinished scene resumes from its native start; earned receipts survive. Replay keeps earned progress. Campaign volume/shake preferences apply to required and optional scenes, with reduced-motion shake suppression.

Chapter updates reread the shared save and merge earned chapter facts monotonically, retaining concurrent campaign changes. Campaign persistence merges newer chapter facts to protect stale/bfcache pages. Invalid saves remain protected until explicit valid import. Failed storage is visible; cross-page flight arrival is refused if persistence fails, keeping the live source and retry/cancel controls available.

The optional Turbosuco victory is written idempotently in the campaign update loop at real victory, as well as on safe return.

## Flight and geography

Original STOL courier, 32 genuine headings, moving propeller/flaps, acceleration, climb/cruise/approach and braking; no mirroring of perspective frames. Dedicated crossings support Factory ↔ Guaíra ↔ Serra with explicit runway anchors on the authored dioramas. The fixed global atlas retains old numeric region placements and places Guaíra east of the factory. Grounded terminal overlays extend Factory/Serra without moving their existing routes.

The modal owns one flight and commits arrival at most once. Skip succeeds only after required assets load; cancel keeps the source. Hidden/blurred windows stop elapsed travel. Reduced motion uses the short calm mode. Art failure offers retry or cancel and never reports arrival. Effects use an isolated effects-only WorldAudio route with the user's levels/mute preference and are disposed with the flight. Artistic listening remains a review task, not a tested claim.

## Verification

The integration used one aggregate TypeScript test pass plus directly affected reruns for intentional gate/receipt-label changes and native-menu test harness assumptions. Relevant checks cover migration, concurrent chapter writes, live completion before navigation, native-start resume, optional scenes, stale callbacks, retry/cancel, failed-save flight retry, immediate salon victory, map transport and keyboard controls. Level/player/world validators, both TypeScript projects, production build and size checks ran on the integrated source.

Actual browser verification belongs to the immutable preview before promotion: main native menu, Factory unlock → Guaíra flight, loading/cancel/skip/reduced motion, chapter resume/optional completion, mayor → Serra return, reverse flight, failed-storage handling, compact viewport and console errors. Local Chromium and cloud-browser localhost were blocked in this executor, so this commit does not claim that runtime browser pass, physical touch testing or full-campaign playthrough.

Automatic Vercel deployments remain disabled. No Oracle deployment is performed by these changes.
