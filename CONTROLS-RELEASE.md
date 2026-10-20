# Edition controls maintenance

This branch preserves the edition's original graphics, levels, simulation and score keys. It backports the shared World input modules from 939d00b, including per-action gamepad release gating, held keyboard movement, device-aware touch controls, settings and native fullscreen ownership. The edition adapter owns menu hit targets, controller navigation, controls help, focus-loss pause and the main-menu exit to its Torbware edition.

Only production Vite builds are used for this publication. No tests, typecheck, browser review or physical-controller validation were run. Build with a versioned `/releases/controls-<commit>/` base. Publish a staged immutable directory, retain existing assets and activate only index.html after checksum verification. Preserve the Remastered scoreboard server and its database.
