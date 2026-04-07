# Quick Start: One-Click Launcher

## 🚀 Easiest Way to Run

After completing the installation (`npm install` and `npm run build`), you can now start the downloader with a single double-click!

### Windows Users

You have two options:

1. **Option 1: Double-click `start.bat`** (Simplest)
   - Just double-click the file
   - A command prompt window will open and run the downloader

2. **Option 2: Double-click `start.ps1`** (PowerShell)
   - Right-click and select "Run with PowerShell"
   - More colorful output

### macOS/Linux Users

1. **Double-click `start.sh`**
   - First time: You may need to run `chmod +x start.sh` in terminal
   - After that, just double-click to run

---

## 🖥️ Want a Desktop Shortcut?

See the full guide: **[LAUNCHER_GUIDE.md](LAUNCHER_GUIDE.md)**

This guide shows you how to:
- Create a desktop shortcut
- Add the launcher to your Start Menu (Windows)
- Add the launcher to your Applications (macOS)
- Add the launcher to your app menu (Linux)
- Customize the icon

---

## ⚙️ How the Launchers Work

The launcher scripts:
1. ✅ Check if Node.js is installed
2. ✅ Check if the project is built (runs `npm run build` if needed)
3. ✅ Start the Whiteboard Downloader with the `download` command
4. ✅ Keep the window open if there's an error so you can see what went wrong

---

## 📝 Notes

- **First time?** Make sure you've run `npm install` first
- **Have credentials ready?** Create a `.env` file with your username and password (see README.md)
- **No `.env` file?** No problem! The launcher will prompt you for credentials interactively

---

## 🐛 Troubleshooting

**Windows: "Cannot run scripts"**
- Open PowerShell as Administrator
- Run: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

**macOS: "Cannot open because it's from an unidentified developer"**
- Right-click on `start.sh` → Open → Open

**Linux: "Permission denied"**
- Run: `chmod +x start.sh`

**Script starts but immediately closes**
- Right-click the launcher and select "Edit"
- Check that the paths are correct for your system
- Make sure you've run `npm install` and the project is in the correct folder

---

## 🎯 What's Next?

Once you've launched the application:
1. Enter your G-Number and password (if you haven't set up `.env`)
2. The browser will launch (headless by default)
3. Course materials will be downloaded to the `./downloads` folder
4. Enjoy your automated downloads! ☕

Happy downloading! 🎓
