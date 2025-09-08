````markdown
# Whiteboard Automation Tool (V0.3.5)

Automates downloading course materials from Blackboard using Selenium and Requests.

---

## Prerequisites

- **Operating System:** Windows 10/11
- **Python:** 3.10 or higher
- **Chrome Browser:** Installed
- **ChromeDriver:** Compatible with your Chrome version
- **Python Packages:** `selenium`, `requests`, `tkinter` (usually included with Python)

---

## Installation

1. **Clone or Download the Repository**

```bash
git clone <repository_url>
cd <repository_folder>
````

2. **Install Python Dependencies**

```bash
pip install selenium requests
```

3. **Download ChromeDriver**

* Check your Chrome version:
  Open Chrome → Menu → Help → About Google Chrome
* Download matching ChromeDriver: [https://sites.google.com/chromium.org/driver/](https://sites.google.com/chromium.org/driver/)
* Place `chromedriver.exe` in the folder `chromedriver-win64` or update the path in the script.

4. **Verify Chrome Path**

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

* The script will open Chrome, log into Blackboard, and fetch courses starting with "2025I".
* It automatically navigates course menus and downloads all available materials into the `downloads` folder.
* Folder structure mirrors Blackboard course organization.

---

## File Handling

* **Sanitization:** Filenames are cleaned to remove invalid characters.
* **Duplicate Handling:** If a file already exists, a number is appended, e.g., `file (1).pdf`.
* **Unknown Extensions:** Files without extensions are saved as `.bin`.

---

## Notes

* Avoid closing the Chrome window during operation.
* Ensure a stable internet connection; requests may timeout otherwise.
* Sidebar links like "Home Page", "Discussions", "Groups", "Tools", and "Help" are skipped automatically.

---

## Troubleshooting

* **ChromeDriver mismatch:** Update ChromeDriver to match your Chrome version.
* **Timeouts:** Increase `WebDriverWait` durations if pages load slowly.
* **Tkinter GUI issues:** Ensure Python is installed with Tkinter support.

---

## Author

Developed and maintained by **Gavania**

```
```
