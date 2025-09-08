# Whiteboard Automation Tool (V0.3.5)

Published by Gavania
Automates downloading course materials from Blackboard using Selenium and Requests.

---

## Prerequisites

- **Operating System:** Windows 10/11
- **Python:** 3.10 or higher
- **Chrome Browser:** Installed (for now, only supports default install location)
- **ChromeDriver:** Compatible with your Chrome version
- **Python Packages:** `selenium`, `requests`, `tkinter` (usually included with Python)

---

## Installation

1. **Install Python Dependencies**

```bash
pip install selenium requests
```

2. **Download ChromeDriver**

* Check your Chrome version:
  Open Chrome → Menu → Help → About Google Chrome
* Download matching ChromeDriver: [https://googlechromelabs.github.io/chrome-for-testing/#stable](https://googlechromelabs.github.io/chrome-for-testing/#stable)
* Download ChromeDriver for win64 version, by pasting and opening the url from the Chromedriver Page
* Unzip the download, and place the folder `chromedriver-win64` in the same directory as the python file

3. **Verify Chrome Path (optional)**

Make sure the `chrome_path` variable in the script points to your Chrome executable, e.g.:

```python
chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

---

## Usage

1. **Run the Script**

```bash
python whiteboard_downloader.py
```

2. **Login GUI**

* Enter your **G-Number** and **Password** in the Tkinter popup.
* Click **Start**.

3. **Downloading Process**

* The script will open Chrome, log into Blackboard, and fetch courses starting with "2025I". This means that the code is only suitable for 10th grade students this year. This issue will be addressed in the near future.
* It automatically navigates course menus and downloads all available materials into the `downloads` folder.
* Folder structure mirrors Blackboard course organization.

---

## File Handling

* **Sanitization:** Filenames are cleaned to remove invalid characters.

---

## Notes

* Avoid closing the Chrome window during operation. You can do it, but it will cause errors.
* Ensure a stable internet connection; requests may timeout otherwise.
* Sidebar links like "Home Page", "Discussions", "Groups", "Tools", and "Help" are skipped automatically.

---

## Troubleshooting

* **ChromeDriver mismatch:** Update ChromeDriver to match your Chrome version.
* **Timeouts:** Increase `WebDriverWait` durations if pages load slowly, but mostly thats because abnormal internet connection (turn off VPN).
* **Tkinter GUI issues:** Ensure Python is installed with Tkinter support.

---

## Author

Developed and maintained by **Gavania**
Please contact me for any issues with the code.

```
```
