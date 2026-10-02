# Guaíra chapter map view

`GuairaChapterMapView` owns only the chapter map UI and its visible physical travel. It has no storage, URL, campaign, native attempt or completion authority. The host owns the session and scene mounting.

## Integration API

```ts
new GuairaChapterMapView(root, {
    snapshot, arrival,
    walkToSelection: false,
    openingAvailable: !hasEnteredChapter,
    onSelect(sceneId, generation) { /* session.selectScene, then view.update(next, true) */ },
    onEnter(sceneId, generation) {
        // Revalidate BOTH conditions immediately before session.enterScene.
        // view.canEnter(sceneId, generation) && session.canEnterScene(sceneId, generation)
    },
    onOpening(opening, generation) { /* validate first-entry latch and replace empty session */ },
    onRestart(generation) { /* validate, dispose old scene/view and replace session */ },
    onExit() { /* dispose the chapter and navigate to the main game */ }
});
view.update(snapshot, walkToSelection = false, openingAvailable = previousOpeningAvailable);
view.canEnter(sceneId, generation): boolean;
view.dispose(): void;
```

Import `chapter/guaira-chapter-map.css` in the chapter host entrypoint. The stylesheet is entirely scoped under `.guaira-chapter-map`; the host supplies a sized root and owns body/game layouts. The map appends one owned section and removes only that section on disposal.

Pass the physical arrival returned by the native scene on map construction. An update without walking freezes the current physical position even if the selected scene changes. CAMINHAR then starts a real road walk. Passing `true` requests walking to `CHAPTER_SCENES[selectedScene].arrival`; changing selection reverses from the current point. ENTRAR/REPETIR remain unavailable until the selected physical anchor is reached. CHEGAR and reduced motion skip travel only, never enter or award a result. Reduced motion requested while hidden or behind the journey dialog is applied on resume.

The host must latch `openingAvailable` false on the first entry, including an attempt later abandoned with no receipt. The default permits opening choice only for an empty generation-zero session. All contextual callbacks capture the generation displayed when installed; stale callbacks are rejected locally, and the host must still revalidate. Older generations of the same session cannot overwrite a newer view snapshot.

The view uses `GuairaChapterTravel`, `loadGuairaScene`, the existing diorama/mask, `paintGuairaMap`, `paintGuairaWaterFrame` and `LabToolbarAction`. It introduces no raster art. One selected-target plaque can appear only with safe scene clearance; compact layouts hide it. The footer keeps the selected action available.

## UI and lifecycle

- JORNADA opens a native modal dialog with the five actual route rows. Completed and next scenes can be selected; future rows explain their predecessor and remain disabled. Selecting only calls `onSelect`; the host updates the view with walking enabled
- Native controls provide Enter/Space/Tab behavior. Escape/cancel closes the dialog and restores JORNADA focus. The dialog freezes road, camera and water animation; there are no document-level arrow shortcuts
- Header and footer can wrap at 320px. Controls retain at least 44px height. The footer has an 84px minimum, with natural growth for text/actions; no fixed-height clipping. Forced-colors rules expose accessible text and system-color outlines
- Hidden documents, active native attempts and disposed sessions stop owned frames. Resume resets elapsed-time clocks. Disposal aborts loading/listeners, cancels RAF, disconnects the observer, drops paint resources and removes its DOM
- A core load error leaves the session untouched and provides retry and exit. A water-mask failure leaves a usable static diorama. Late asset completions are ignored after disposal or superseded loads

## Verification boundaries

`tests/guaira-chapter-map-view.test.ts` runs the production session, travel, loader, view and map/water painters against substituted browser device boundaries: EventTarget DOM, canvas context, frame clock, image decode, network and media query. It covers captured/stale/repeated actions, actual walking and direction reversal, preserve-position updates, menu/hidden suspension, reduced-motion arrival, optional water failure, invalid metadata/retry, late decode/disposal, completed/replay presentation and opening lock after abandonment. Getters forbid location, history and browser storage access.

These tests are DOM-boundary integration checks, not real-browser layout, rendering, native focus-trap, touch or screenshot proof. CSS assertions check scoped rules and wrapping intent only. A browser still needs to verify native dialog focus/Tab, 320px and compact landscape overflow, screenshots and actual chapter host integration. No browser, deployment or publication is part of this map-view patch.

Run the focused test without the tsx CLI IPC server:

```sh
node --import ./node_modules/tsx/dist/loader.mjs --test tests/guaira-chapter-map-view.test.ts
```
