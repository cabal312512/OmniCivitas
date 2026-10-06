# Station

Dormant desktop application source: shelf/editor, undo/redo, JSON cabinet, piano-roll recorder, room map and animated board. This application is not built, installed, tested or launched by OmniCivitas. Its piano records notes but has no audio driver. Compatibility with the declared egui versions is unverified.

The website treats `src/rooms.rs` as a read-only data source. The gateway extracts exactly thirty `slot!` records using a bounded regular expression. This does **not** execute Rust and is not evidence of an active Rust desktop runtime. Keep those records and their IDs stable; editing display phrases does not change browser collection IDs.
