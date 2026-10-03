# Subida da Vazão: service crossing

The introductory inspection plank and elevator retain their native bodies, timings,
boarding lips and recovery routes. After the lift, a solid maintenance landing earns
a second attempt-local checkpoint. A final carriage asks the player to apply the
boarding/waiting/disembarking lesson before reaching the Casa da Vazão.

The final crossing is 208 pixels across, with an 80-pixel carriage moving 96 pixels.
The receiving bank is at the same elevation as the boarding bank: a higher
receiving bank was rejected because its jump framing conflicted with the HUD.
There are no new enemies, engine mechanics, required pickups or persistent gates.

The dry inspection gallery below the carriage is optional. Its three coins join
the original three recovery-route coins (six total). Missed transfers land here;
two ordinary jumps via the left board return to the safe landing. The attempt's
collected coins survive automatic death. Explicit retry clears coins and both
checkpoints. The upper checkpoint reconstructs the carriage at its starting pose.

The existing facade, closed public branch and flowing private tank now mark the
arrival after the service crossing. Scene-local framing previews the gallery when
waiting and keeps the helmet below the fixed HUD during upper-route jumps. Framing
only advances with native simulation, so pause, focus loss and respawn hold still.

## Verification

- `node --import tsx --test tests/guaira-ascent.test.ts`: 17 focused tests.
- Native keyboard and touch input replay from spawn: 1,339 frames at 60 Hz,
  three moving bodies, both checkpoints, no damage or mandatory coins.
- Every upper-route replay frame checks helmet/HUD clearance; settled boarding
  and transfer frames check visibility of the dry gallery before a fall.
- Native optional-gallery path collects three coins, returns by two jumps,
  dies, respawns at the upper checkpoint and completes the reconstructed crossing.
- Native carry is checked for two complete cycles on all three moving bodies.
- An ordinary jump back toward the lift keeps helmet headroom across the bank boundary.
- Pause/focus loss on the upper landing freezes camera, player and mechanism clocks.
- Both TypeScript project configurations pass.

Actual production canvas painters were also inspected using raster captures from
native input replay, including boarding, jump apex, gallery and arrival. These are
offline engine/render proofs, not browser or device gameplay evidence. Cloud
browser navigation to the local preview was blocked by its client; no live browser
completion is claimed. Integration must still run its aggregate and viewport gates.
