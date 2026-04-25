# WhiteBoard Downloader Features

## User workflow and setup

- ✅ One-click setup/start workflow (single launcher flow)
- ✅ Setup wizard for credentials and preferences
- ✅ Doctor command for diagnostics (`doctor`, `doctor --login`)
- ✅ Cross-platform launchers (`start.bat`, `start.ps1`, `start.sh`)
- ✅ Desktop GUI flow (Electron + React) with setup, doctor, course/file selection, progress, summary
- ✅ Separate GUI launchers (`start-gui.bat`, `start-gui.ps1`, `start-gui.sh`)

## Interactive usage

- ✅ Interactive course selection (checkbox UI)
- ✅ Interactive file selection (checkbox UI)
- ✅ Full discovered-course list shown before selection (no silent hiding in normal interactive mode)

## Download and validation behavior

- ✅ Strict document allowlist (`pdf`, `ppt`, `pptx`, `doc`, `docx`, `xls`, `xlsx`)
- ✅ File extension normalization from MIME when needed (including Blackboard weird extensions like `.aspx`/`.do`)
- ✅ Blocked-extension rejection (archives/images/media/plain-data) even when MIME looks document-like
- ✅ Duplicate prevention (database + file tree cache + disk fallback)
- ✅ Resume behavior across runs
- ✅ Byte-based progress percentage when known sizes exist, with secondary file-count display
- ✅ File-count fallback mode when no known sizes are available
- ✅ Run summary report output (`logs/latest-summary.txt` + JSON report)

## Reliability

- ✅ Resilient course discovery with fallback selectors
- ✅ Friendly user-facing error mapping with next actions
- ✅ Launchers always run from their own folder for reliable ZIP double-click usage
- ✅ Setup login test respects preserved saved password when password input is left blank
