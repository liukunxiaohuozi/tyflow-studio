# v0.1.8 — Bug description screenshot paste

The Bug fix “Problem and reproduction steps” input accepts image clipboard items through Ctrl+V / Command+V. Screenshots appear as thumbnail cards inside the description area, beneath the text, with full-size preview and removal. This is a text field with associated screenshots, not a rich-text editor that interleaves images between paragraphs. Ordinary text pasting stays native; mixed clipboard text is preserved when images are imported. Existing image attachments imported through the picker or drag/drop appear in the same gallery for Bug tasks; logs remain in the attachment list.

Images are sent as bounded byte arrays through the trusted main-window IPC, decoded with Electron nativeImage, normalized to PNG and stored by the asset manager. They do not require a filesystem clipboard path. Each image is limited to 20 MB, each paste to ten images, and a task to thirty total files. Invalid image data is rejected. Hash deduplication prevents repeated copies. Images persist with the task's asset IDs and enter the assessment prompt through the existing evidence-file pipeline. Editing evidence invalidates the previous plan. Run/record details show the screenshots in the execution snapshot section. Demo mode continues to reject real image imports.

Validation on Windows:

- TypeScript, ESLint, production build and localization scan passed (382 keys).
- Import, demo and core suites: 29 tests passed, including clipboard-image persistence, concurrent deduplication, reopen and invalid/oversize rejection.
- Added service test passed: Bug draft read-back includes screenshot metadata; the fake assessment receives its stored file path/hash; removing the image persists and invalidates the plan. This verifies orchestration, not an actual AI model's image interpretation.
- Real Electron native-image smoke passed for PNG/JPEG decoding, invalid input rejection, asset persistence/deduplication and correctly sized thumbnail read-back.
- Packaged Windows startup passed with ready/bootstrapServed/visible true and minimized false. Evidence: D:\UserData\tingyun\Temp\tyflow-visible-smoke-035526d4-ec33-47f9-a6be-255d5b301a40\smoke.json. Desktop shortcut now points to release/0.1.8/win-unpacked/Tyflow Studio.exe; installer is release/0.1.8/Tyflow-Studio-0.1.8-Windows-x64.exe.
- Browser connector was unavailable. Actual keyboard paste, thumbnail appearance and click/remove interactions were not verified through UI automation in this turn. macOS execution was not tested on this Windows host.

Native image API reference: https://www.electronjs.org/docs/latest/api/native-image
