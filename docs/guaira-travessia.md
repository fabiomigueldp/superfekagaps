# Guaíra · travessia experimental

Route: `/guaira-travessia.html`. Guaíra is a fictional setting. The short traversal is separate from the six-world campaign, and its in-memory store never reads or writes browser storage.

The level is 1152×288 world pixels (72×18 tiles), about 3.6 native screens. Ground top is y224. It connects a dry red street (x0–416), a maintenance bridge over the sluice (x416–624), and an irrigated rice bank (x624–1152). Two workers are friendly scenery. Clean cyan water is cosmetic, with no swimming, damage or fluid simulation.

Feka starts at x48 with the normal helmet. Use the existing movement, jump and sentada controls. The ordinary switch at x352–384, y216–224 links to an ordinary gated lift. Jump and press down above the switch to raise the bridge from y336 to y224. Its home lies below the normal fall-death boundary; the 208px opening cannot be crossed by an ordinary maximum run jump. The mechanism can be toggled again; its collision geometry comes directly from `WorldObjects`, as does its moving deck art.

The native checkpoint is at x656, safely past the crossing. Death before the checkpoint resets the valve. Death after it restores the valve and bridge to their solved position through the local adapter, and uses the normal checkpoint helmet, coins and death/reveal pipeline. Recomeçar always starts a new local traversal. No save schema or campaign IDs are extended.

Reaching x1080 while grounded after solving the bridge fixes the local result and reveals the native Ossabravo action. The CURRAL action navigates explicitly to `/guaira-lab.html`. Water animation continues and Feka settles into his native idle pose after completion; the run time remains fixed, and pause freezes the scene. There is no experimental campaign exit and no call to `finishStage`. The map action returns to `/guaira.html?at=town` before the checkpoint or `/guaira.html?at=rice` afterward, preserving local spatial continuity.

The toolbar uses native buttons/links containing the existing 44px bitmap action painter. Three actions are visible: PAUSA/TENTAR/MAPA, or CURRAL/TENTAR/MAPA after finishing. Pausing the completed scene exposes CONTINUAR in the same slot. Enter/Space on those controls do not reach gameplay. Escape, HUD pause, blur and document hiding pause the real engine. Reduced motion disables shake and decorative motion while retaining necessary bridge movement. Touch uses the ordinary movement/jump/down controls.

Verification: `tests/guaira-traversal.test.ts` exercises a frozen keyboard replay through real Input, Player, WorldObjects and WorldGame, checkpoint and death recovery, failed puzzle bypass, pause/visibility, touch, toolbar navigation and campaign/storage isolation. The browser harness substitutes DOM boundaries only. An actual offline Canvas replay is a rendering proof, not a browser capture; proof media lives outside the repository.
