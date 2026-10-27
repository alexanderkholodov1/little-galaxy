# Frozen fair reader

This directory preserves the final fair release, commit
`9ccf27d` (`1.0.0-alpha.8`). BAD 2026 retained the persisted identity
`proto3-ed2f1b0ac6cdf637229711dc5c1b94e3645a4d18eea47786082e1393b50bf30e`
through the fair releases; the alpha.8 source is the implementation last served for it.

The simulation, homes and names modules are copied byte for byte. Replay changes only its
relative simulation import and replaces the shared current-kernel import with the historical
literal. `manifest.json` records original and packaged SHA-256 values; suite tests enforce
these bytes and the unchanged shared name table. Shared canonical byte serialization remains
the data protocol, not a physics implementation.

The dispatcher permits this implementation only for frozen/archived records with frozen
write policy. Replay applies accepted facts with `Sim.add`; none of the archived admission
limits can admit or reject a player's launch. Current galaxies retain the current simulation
and admission path. Live snapshots are restricted to the current kernel. Optional keeper
certifications retain the record's historical identity.

The historical implementation retains its native JavaScript mathematics and original motion.
A-open's deterministic math and equilibrium changes apply to new galaxies. Do not update this
archive in place, apply current physics to its state, or relabel its stored generation.
