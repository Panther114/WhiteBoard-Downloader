# WhiteBoard Downloader Features

## User workflow and setup

- ✅ One-click setup/start workflow (single launcher flow)
- ✅ Setup wizard for credentials and preferences
- ✅ Doctor command for diagnostics (`doctor`, `doctor --login`)
- ✅ Cross-platform launchers (`start.bat`, `start.ps1`, `start.sh`)

## Interactive usage

- ✅ Interactive course selection (checkbox UI)
- ✅ Interactive file selection (checkbox UI)

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
