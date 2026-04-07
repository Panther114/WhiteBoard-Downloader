# Desktop Shortcut Setup Guide

This guide will help you create a desktop shortcut for one-click launching of the Whiteboard Downloader.

## Windows

### Method 1: Using start.bat (Simplest)

1. **Right-click** on `start.bat` in the project folder
2. Select **"Send to" → "Desktop (create shortcut)"**
3. (Optional) Right-click the desktop shortcut and select **"Properties"** to:
   - Change the icon
   - Set "Run" to "Minimized" if you prefer

### Method 2: Using PowerShell (start.ps1)

1. **Right-click** on `start.ps1` in the project folder
2. Select **"Send to" → "Desktop (create shortcut)"**
3. **Right-click** the desktop shortcut and select **"Properties"**
4. In the **"Target"** field, add PowerShell to the beginning:
   ```
   powershell.exe -ExecutionPolicy Bypass -File "C:\path\to\WhiteBoard-Downloader\start.ps1"
   ```
5. Click **OK**

### Method 3: Create a Custom Shortcut

1. **Right-click** on your desktop
2. Select **"New" → "Shortcut"**
3. Enter the location:
   ```
   "C:\Program Files\nodejs\node.exe" "C:\path\to\WhiteBoard-Downloader\dist\cli.js" download
   ```
   (Replace `C:\path\to\WhiteBoard-Downloader` with your actual path)
4. Click **"Next"**
5. Name it "Whiteboard Downloader"
6. Click **"Finish"**
7. (Optional) Right-click the shortcut, select **"Properties"**, and:
   - Set **"Start in"** to: `C:\path\to\WhiteBoard-Downloader`
   - Change the icon if desired

---

## macOS

### Method 1: Create an Application

1. Open **Automator** (found in Applications/Utilities)
2. Select **"Application"** and click **"Choose"**
3. Search for **"Run Shell Script"** in the actions list and drag it to the workflow
4. In the shell script box, enter:
   ```bash
   cd /path/to/WhiteBoard-Downloader
   /usr/local/bin/node dist/cli.js download
   ```
   (Replace `/path/to/WhiteBoard-Downloader` with your actual path)
5. Click **File → Save** and save it to your Applications folder or Desktop
6. Name it "Whiteboard Downloader"

### Method 2: Make start.sh Executable

1. Open **Terminal**
2. Navigate to the project folder:
   ```bash
   cd /path/to/WhiteBoard-Downloader
   ```
3. Make the script executable:
   ```bash
   chmod +x start.sh
   ```
4. Now you can double-click `start.sh` to run it
5. (Optional) Drag `start.sh` to your Dock for quick access

---

## Linux

### Method 1: Create a Desktop Entry

1. Create a file named `whiteboard-downloader.desktop` in `~/.local/share/applications/`:
   ```bash
   nano ~/.local/share/applications/whiteboard-downloader.desktop
   ```

2. Add the following content:
   ```ini
   [Desktop Entry]
   Version=1.0
   Type=Application
   Name=Whiteboard Downloader
   Comment=Download course materials from Blackboard
   Exec=/path/to/WhiteBoard-Downloader/start.sh
   Icon=utilities-terminal
   Terminal=true
   Categories=Utility;Education;
   ```
   (Replace `/path/to/WhiteBoard-Downloader` with your actual path)

3. Save and close the file (Ctrl+X, then Y, then Enter)

4. Make the desktop entry executable:
   ```bash
   chmod +x ~/.local/share/applications/whiteboard-downloader.desktop
   ```

5. The application should now appear in your application menu

### Method 2: Make start.sh Executable

1. Open a terminal
2. Navigate to the project folder:
   ```bash
   cd /path/to/WhiteBoard-Downloader
   ```
3. Make the script executable:
   ```bash
   chmod +x start.sh
   ```
4. Now you can double-click `start.sh` to run it (make sure your file manager is set to run executable files)

---

## Troubleshooting

### Windows: "Cannot be loaded because running scripts is disabled"

If you get this error with PowerShell:

1. Open **PowerShell as Administrator**
2. Run:
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Type `Y` and press Enter

### macOS: "start.sh cannot be opened because it is from an unidentified developer"

1. **Right-click** (or Ctrl+click) on `start.sh`
2. Select **"Open"**
3. Click **"Open"** in the dialog that appears
4. This only needs to be done once

### Linux: Script doesn't execute when double-clicked

1. Open your file manager's preferences
2. Look for "Executable Text Files" or similar setting
3. Set it to "Ask" or "Execute" instead of "Open in Text Editor"

---

## Tips

- Make sure you have already run `npm install` and `npm run build` before using the launchers
- The launchers will automatically build the project if needed
- If you've set up a `.env` file with credentials, the launcher will use those
- Otherwise, you'll be prompted to enter your credentials interactively
