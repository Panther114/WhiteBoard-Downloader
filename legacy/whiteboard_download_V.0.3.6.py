import os, re, time, cgi, mimetypes, unicodedata, requests, sys, importlib.util, shutil
from urllib.parse import unquote, urlparse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import tkinter as tk

version = "V0.3.6"

# Chapter 1 Checking the environment

def check_module(module_name):
    if importlib.util.find_spec(module_name) is None:
        print(f"[Error][02] Missing required Python module: {module_name}")
        print(f"→ Install it with: pip install {module_name}")
        sys.exit(1)

def check_chrome_install(chrome_path):
    if not os.path.exists(chrome_path):
        print(f"[Error][02] Google Chrome not found at: {chrome_path}")
        print("→ Please install Chrome or update the 'chrome_path' in the script.")
        sys.exit(1)

def check_chromedriver(chromedriver_path):
    if not os.path.exists(chromedriver_path):
        print(f"[Error][02] ChromeDriver not found at: {chromedriver_path}")
        print("→ Download the correct version from https://chromedriver.chromium.org/downloads")
        sys.exit(1)

for mod in ["selenium", "requests", "tkinter"]:
    check_module(mod)

# Chapter 2 tkinter GUI setup

def get_user_input():
    result = {}
    def on_close():
        print("[Process exited]")
        result["closed"] = True
        root.destroy()
    root = tk.Tk()
    root.title("Whiteboard " + version)
    root.configure(bg="#f0f0f0")
    root.geometry("400x220")
    root.resizable(False, False)
    root.eval('tk::PlaceWindow . center')
    header_font = ("Helvetica", 12, "bold")
    label_font = ("Helvetica", 10)
    entry_font = ("Helvetica", 10)
    
    tk.Label(root, text="Enter your Blackboard credentials:", font=header_font, bg="#f0f0f0").grid(row=0, column=0, columnspan=2, pady=(10, 15))
    tk.Label(root, text="G-Number:", font=label_font, bg="#f0f0f0").grid(row=1, column=0, sticky="e", padx=(10,5), pady=5)
    gnum_entry = tk.Entry(root, width=30, font=entry_font)
    gnum_entry.grid(row=1, column=1, padx=(5,10), pady=5)
    tk.Label(root, text="Password:", font=label_font, bg="#f0f0f0").grid(row=2, column=0, sticky="e", padx=(10,5), pady=5)
    pass_entry = tk.Entry(root, width=30, show="*", font=entry_font)
    pass_entry.grid(row=2, column=1, padx=(5,10), pady=5)

    tk.Label(root, text="Selenium & Requests based BB automation tool \n developed and designed by Gavania", font=("Helvetica", 9, "italic"), fg="#555555", bg="#f0f0f0").grid(row=3, column=0, columnspan=2, pady=(10, 5))

    start_btn = tk.Button(root, text="Start", font=("Helvetica", 10, "bold"), bg="#4CAF50", fg="white", activebackground="#45a049", width=15, height=1)
    start_btn.grid(row=4, column=0, columnspan=2, pady=(10, 10))

    def submit():
        result["username"] = gnum_entry.get().strip()
        result["password"] = pass_entry.get().strip()
        root.destroy()

    start_btn.config(command=submit)
    root.protocol("WM_DELETE_WINDOW", on_close)

    root.mainloop()
    return result


# Chapter 3 Main Plot

user_input_data = get_user_input()
if "closed" in user_input_data:
    sys.exit(0)
USERNAME = user_input_data["username"]
PASSWORD = user_input_data["password"]

BLACKBOARD_LOGIN = "https://shs.blackboardchina.cn/webapps/login/"
chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
chromedriver_path = "chromedriver-win64/chromedriver.exe"

check_chrome_install(chrome_path)
check_chromedriver(chromedriver_path)

base_download = "downloads"
os.makedirs(base_download, exist_ok=True)

options = webdriver.ChromeOptions()
options.binary_location = chrome_path
options.add_argument("--start-maximized")

try:
    driver = webdriver.Chrome(service=Service(chromedriver_path), options=options)
except Exception as e:
    print(f"[Error][01] Failed to launch ChromeDriver: {e}")
    print("→ Make sure Chrome and ChromeDriver versions match.")
    sys.exit(1)

wait = WebDriverWait(driver, 10)

try:
    driver.get(BLACKBOARD_LOGIN)
except Exception as e:
    print(f"[Error][03] Failed to open Blackboard login page: {e}")
    sys.exit(1)

try:
    cookie_btn = wait.until(EC.element_to_be_clickable((By.ID, "agree_button")))
    cookie_btn.click()
except:
    pass

try:
    user_input_el = wait.until(EC.presence_of_element_located((By.ID, "user_id")))
    pass_input_el = driver.find_element(By.ID, "password")
    login_button_el = driver.find_element(By.ID, "entry-login")
except Exception as e:
    print(f"[Error][03] Could not locate login form elements: {e}")
    sys.exit(1)

try:
    user_input_el.send_keys(USERNAME)
    pass_input_el.send_keys(PASSWORD)
    login_button_el.click()
except Exception as e:
    print(f"[Error][03] Failed during login process: {e}")
    sys.exit(1)

try:
    course_elements = WebDriverWait(driver, 5).until(
        EC.presence_of_all_elements_located((By.CSS_SELECTOR, "ul.portletList-img.courseListing.coursefakeclass li a"))
    )
except Exception as e:
    print(f"[Error][03] Could not load course list: {e}")
    sys.exit(1)

course_urls = [(c.get_attribute("href"), c.text.strip().replace("/", "_").replace("\\", "_")) for c in course_elements if c.text.startswith("2025I")]

# Chapter 4 Preparing the Download
def sanitize_filename(name: str) -> str:
    if not name:
        return "file"
    name = unicodedata.normalize("NFKC", name)
    name = "".join(ch for ch in name if ch.isprintable())
    name = name.replace(":", " - ")
    name = re.sub(r'[<>\"/\\|?*\x00-\x1f]', "", name)
    name = re.sub(r'\s+', " ", name).strip()
    name = name.rstrip(". ")
    if not name:
        name = "file"
    return name[:200]


def derive_name_from_href(href: str) -> str:
    parsed = urlparse(href)
    base = os.path.basename(parsed.path)
    base = unquote(base)
    return base or "file"


def ensure_extension(name: str, content_type: str) -> str:
    root, ext = os.path.splitext(name)
    if ext:
        return name
    guessed_ext = None
    if content_type:
        guessed_ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
    if not guessed_ext:
        guessed_ext = ".bin"
    return root + guessed_ext


def unique_path(folder: str, filename: str) -> str:
    path = os.path.join(folder, filename)
    if not os.path.exists(path):
        return path
    root, ext = os.path.splitext(filename)
    i = 1
    while True:
        candidate = f"{root} ({i}){ext}"
        path = os.path.join(folder, candidate)
        if not os.path.exists(path):
            return path
        i += 1

def download_files(folder_path):
    try:
        content_links = WebDriverWait(driver, 2).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#content_listContainer a[target='_blank']"))
        )
    except Exception as e:
        print(f"[Warning] No downloadable links found in {folder_path} ({e})")
        content_links = []

    for content in content_links:
        href = content.get_attribute("href")
        if not href:
            print("[Skipped] Found a link without href attribute.")
            continue
        if "listContent.jsp" in href:
            print(f"[Skipped] Ignored Blackboard navigation link: {href}")
            continue

        displayed = content.text.strip()
        candidate = displayed if displayed else derive_name_from_href(href)
        download_url = href if href.startswith("http") else "https://shs.blackboardchina.cn" + href

        try:
            r = requests.get(download_url, stream=True, auth=(USERNAME, PASSWORD), timeout=30, allow_redirects=True)
        except Exception as e:
            print(f"[Error][04] Failed to request {download_url}: {e}")
            continue

        if r.status_code != 200:
            print(f"[Skipped] {candidate} → HTTP status {r.status_code}")
            continue

        cd = r.headers.get("content-disposition")
        fname_from_cd = None
        if cd:
            _, params = cgi.parse_header(cd)
            fname_from_cd = params.get("filename") or params.get("filename*")
            if isinstance(fname_from_cd, bytes):
                try:
                    fname_from_cd = fname_from_cd.decode("utf-8", errors="ignore")
                except Exception:
                    fname_from_cd = None

        if fname_from_cd:
            candidate = fname_from_cd

        candidate = sanitize_filename(candidate)
        candidate = ensure_extension(candidate, r.headers.get("content-type", ""))
        path = unique_path(folder_path, candidate)

        try:
            with open(path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            print(f"[Saved] {candidate} → {path}")
        except Exception as e:
            print(f"[Error][05] Could not save file '{candidate}' to {path}: {e}")


def iterate_subfolders(current_path):
    try:
        subfolder_elements = driver.find_elements(By.CSS_SELECTOR, "div.item.clearfix a")
        subfolder_info = []
        for el in subfolder_elements:
            href = el.get_attribute("href")
            if href and "listContent.jsp" in href:
                name = el.text.strip().replace("/", "_").replace("\\", "_")
                subfolder_info.append((name, href))
    except Exception as e:
        print(f"[Warning] Failed to locate subfolders in {current_path}: {e}")
        subfolder_info = []

    for folder_name, href in subfolder_info:
        folder_path = os.path.join(current_path, sanitize_filename(folder_name))
        try:
            os.makedirs(folder_path, exist_ok=True)
        except Exception as e:
            print(f"[Warning] Could not create folder {folder_path}: {e}")
        try:
            driver.get(href)
            download_files(folder_path)
            iterate_subfolders(folder_path)
            driver.back()
        except Exception as e:
            print(f"[Error][05] Could not process subfolder '{folder_name}' ({href}): {e}")


# Chapter 5 The Final Download
for course_url, course_name in course_urls:
    course_path = os.path.join(base_download, sanitize_filename(course_name))
    try:
        os.makedirs(course_path, exist_ok=True)
    except Exception as e:
        print(f"[Warning] Could not create course folder {course_path}: {e}")

    try:
        driver.get(course_url)
    except Exception as e:
        print(f"[Error][03] Could not open course page {course_url}: {e}")
        continue

    try:
        sidebar_links = WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#courseMenuPalette_contents li a"))
        )
    except Exception as e:
        print(f"[Error][03] Could not load sidebar for {course_name}: {e}")
        continue

    for i in range(len(sidebar_links)):
        try:
            sidebar_links = WebDriverWait(driver, 5).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#courseMenuPalette_contents li a"))
            )
            link = sidebar_links[i]
            title = link.find_element(By.TAG_NAME, "span").get_attribute("title").strip()
            title_s = sanitize_filename(title.replace("/", "_").replace("\\", "_"))
        except Exception as e:
            print(f"[Error][03] Failed to process sidebar link {i+1} in {course_name}: {e}")
            continue

        if title.lower() not in ["home page", "discussions", "groups", "tools", "help"]:
            sidebar_path = os.path.join(course_path, title_s)
            try:
                os.makedirs(sidebar_path, exist_ok=True)
            except Exception as e:
                print(f"[Warning] Could not create sidebar folder {sidebar_path}: {e}")

            try:
                link.click()
                download_files(sidebar_path)
                iterate_subfolders(sidebar_path)
            except Exception as e:
                print(f"[Error][03] Could not process sidebar '{title}' in {course_name}: {e}")

    try:
        my_institution = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "td[id='MyInstitution.label'] a"))
        )
        my_institution.click()
    except Exception as e:
        print(f"[Warning] Could not return to My Institution page after {course_name}: {e}")
