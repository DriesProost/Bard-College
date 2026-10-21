# Download Bard’s College for Windows

Version **1.4.0**, Windows 10/11 x64. Includes 38 Writing lessons and the first nine Music lessons, with a simple five-step lesson page, one answer editor, teacher reviews and optional extras. The installer is unsigned; native Windows acceptance remains pending. See [the latest validation report](../../SIMPLE_LESSONS_VALIDATION.md).

1. [Download the complete repository ZIP](https://github.com/DriesProost/Bard-College/archive/refs/heads/main.zip).
2. Right-click the ZIP → **Extract All**. Open the extracted `downloads/windows` folder.
3. Double-click **Assemble-Windows-Installer.cmd**. It joins the three installer parts and verifies SHA-256. It needs no development tools and does not change PowerShell execution policy.
4. When it says **Checksum verified**, open **Bards-College-Setup-1.4.0-x64.exe** in the same folder. The helper does not run it automatically.

Keep all three `.part` files together until assembly finishes. Assembly works offline using built-in Windows tools. GitHub limits ordinary files to 100 MB, so the approximately 134 MiB installer is split for distribution. `installer-manifest.json` records part sizes and hashes; the `.sha256` sidecar records the final installer hash. The helper overwrites only the generated installer file in this folder. It does not alter your app profile.

Private books, API keys and student recordings are not included. AI requires your own key and a network connection; new lesson introductions and reviews require the Professor; drafts, saved musical sketches and recordings remain local.
