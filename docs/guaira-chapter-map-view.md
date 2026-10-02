# Guaíra chapter map view

`GuairaChapterMapView` owns only the chapter map UI and its visible physical travel. It has no storage, URL, campaign, native attempt or completion authority. The host owns the session and scene mounting.

## Integration API

```ts
new GuairaChapterMapView(root, {
    snapshot, arrival, navigation, // { target, revision }; revision belongs to the host
    walkToSelection: false,
    focusAction: false, // true when BAIRRO returns from the owned Gallery
    openingAvailable: !hasEnteredChapter,
    onSelect(target, generation, revision) { /* validate both tokens, update target/revision, then view.update */ },
    onEnter(target, generation, revision) {
        // Revalidate view.canEnter(target, generation, revision) immediately.
        // Required targets also need session.canEnterScene(target.sceneId, generation).
        // Optional targets use the host's separate Gallery ownership.
    },
    onOpening(opening, generation, revision) { /* validate both tokens and first-entry latch */ },
    onRestart(generation, revision) { /* validate, dispose old view and replace session */ },
    onExit(generation, revision) { /* validate, dispose the chapter and navigate to the main game */ }
});
view.update(snapshot, walkToSelection = false, openingAvailable = previousOpeningAvailable, navigation);
view.canEnter(target, generation, revision): boolean;
view.dispose(): void;
```

Import `chapter/guaira-chapter-map.css` in the chapter host entrypoint. The stylesheet is entirely scoped under `.guaira-chapter-map`; the host supplies a sized root and owns body/game layouts. The map appends one owned section and removes only that section on disposal.

`GuairaChapterNavigation.ts` defines a required target `{ kind: 'chapter', sceneId }` or optional target `{ kind: 'optional', stop: 'bairro' }`, paired with a monotonically increasing `revision`. The host supplies navigation on construction and every update, advancing revision even for same-target selection. Selecting Bairro leaves the chapter snapshot untouched. RETOMAR selects the exact retained `snapshot.selectedScene`, which may be an earned replay rather than the recommendation; the host restores that target without manufacturing a session generation.

Pass the physical arrival returned by the native scene on map construction. An update without walking freezes the current physical position even if the selected scene changes. CAMINHAR then starts a real road walk. Passing `true` requests walking to the target's actual anchor (`bairro`/`guaira-2` for Gallery, or `CHAPTER_SCENES[target.sceneId].arrival` for a required scene); changing selection reverses from the current point. ENTRAR/REPETIR remain unavailable until the selected physical anchor is reached. CHEGAR and reduced motion skip travel only, never enter or award a result. Reduced motion requested while hidden or behind the journey dialog is applied on resume.

The host must latch `openingAvailable` false on the first entry, including an attempt later abandoned with no receipt. The default permits opening choice only for an empty generation-zero session. All rendered actions capture both the session generation and independent navigation revision displayed when installed; stale callbacks are rejected locally, and the host must still revalidate. Older generations of the same session and older navigation revisions cannot overwrite the view. A stationary Bairro actor only enables GALERIA when the optional target is selected. Passing through, arrival, CHEGAR and reduced motion never enter it.

The view uses `GuairaChapterTravel`, `loadGuairaScene`, the existing diorama/mask, `paintGuairaMap`, `paintGuairaWaterFrame` and `LabToolbarAction`. It introduces no raster art. One selected-target plaque can appear only with safe scene clearance; compact layouts hide it. The footer keeps the selected action available.

## UI and lifecycle

- JORNADA opens a native modal dialog with exactly five numbered required route rows. Completed and next scenes can be selected; future rows explain their predecessor and remain disabled. A separate unnumbered ‘Desvio opcional’ section selects Bairro/Gallery. It never gains a completion badge or a sixth result. Selecting only calls `onSelect`; the host updates the view with walking enabled
- At selected Bairro, explicit GALERIA enters the owned optional runtime. BAIRRO returns with the same required snapshot, optional target and physical arrival. The compact RETOMAR action restores the retained required scene and walks there without auto-entry. Optional title/status take priority even at 5/5, while the counter and chapter-completion hint retain the required truth
- Native controls provide Enter/Space/Tab behavior; repeated held activation keys are suppressed only on buttons inside this map. Escape/cancel closes the dialog and restores JORNADA focus. The dialog freezes road, camera and water animation; there are no document-level arrow shortcuts
- `focusAction: true` restores the ready action after internal return, deferring while hidden and declining to steal focus if another control received it. When CHEGAR or RETOMAR becomes hidden, the view captures its focus ownership before hiding it, then focuses the available map action. Natural arrival leaves unrelated focus alone
- Header and footer can wrap at 320px; the footer uses one column through 540px so optional actions do not squeeze its description. Controls retain at least 44px height. The footer has an 84px minimum, with natural growth for text/actions; no fixed-height clipping. Forced-colors rules expose accessible text and system-color outlines
- Hidden documents, window blur, active native attempts and disposed sessions stop owned frames. Blurred callbacks cannot select, enter or close the journey. Focus resets elapsed-time clocks and resumes only when the document is visible and the journey is closed. Disposal aborts loading/listeners, cancels RAF, disconnects the observer, drops paint resources and removes its DOM
- A core load error leaves the session untouched and provides retry and exit. A water-mask failure leaves a usable static diorama. Late asset completions are ignored after disposal or superseded loads

## Verification boundaries

`tests/guaira-chapter-map-view.test.ts` runs the production session, travel, loader, view and map/water painters against substituted browser device boundaries: EventTarget DOM, canvas context, frame clock, image decode, network and media query. It covers captured/stale/repeated actions, actual walking and direction reversal, preserve-position updates, menu/hidden suspension, reduced-motion arrival, optional water failure, invalid metadata/retry, late decode/disposal, completed/replay presentation and opening lock after abandonment. Optional cases cover both openings, five-row grouping, the actual Bairro anchor, pass-through rejection, same-generation revision retirement, exact retained replay, 5/5 title/count preservation, modal/hidden/blur/resize/reduced-motion suspension, visible focus return without time catch-up, blurred asset readiness, repeated activation, asset retry and ready-focus ownership. Its hidden setter clears focus immediately to model the browser behavior that motivated the focus repair. Getters forbid location, history and browser storage access.

These tests are DOM-boundary integration checks, not real-browser layout, rendering, native focus-trap, touch or screenshot proof. CSS assertions check scoped rules and wrapping intent only. A browser still needs to verify native dialog focus/Tab, 320px and compact landscape overflow, screenshots and actual chapter host integration. No browser, deployment or publication is part of this map-view patch.

Run the focused test without the tsx CLI IPC server:

```sh
node --import ./node_modules/tsx/dist/loader.mjs --test tests/guaira-chapter-map-view.test.ts
```
