import os, re, time, cgi, mimetypes, unicodedata, requests
from urllib.parse import unquote, urlparse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import tkinter as tk
from tkinter import ttk

version = "V0.3.5"

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

    result = {}
    def submit():
        result["username"] = gnum_entry.get().strip()
        result["password"] = pass_entry.get().strip()
        root.destroy()

    start_btn.config(command=submit)
    root.protocol("WM_DELETE_WINDOW", on_close)

    root.mainloop()
    return result


user_input_data = get_user_input()
if "closed" in user_input_data:
    exit()
USERNAME = user_input_data["username"]
PASSWORD = user_input_data["password"]

BLACKBOARD_LOGIN = "https://shs.blackboardchina.cn/webapps/login/"
chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
chromedriver_path = "chromedriver-win64/chromedriver.exe"

base_download = "downloads"
os.makedirs(base_download, exist_ok=True)

options = webdriver.ChromeOptions()
options.binary_location = chrome_path
options.add_argument("--start-maximized")
driver = webdriver.Chrome(service=Service(chromedriver_path), options=options)
wait = WebDriverWait(driver, 10)

driver.get(BLACKBOARD_LOGIN)
try:
    cookie_btn = wait.until(EC.element_to_be_clickable((By.ID, "agree_button")))
    cookie_btn.click()
except: pass

user_input_el = wait.until(EC.presence_of_element_located((By.ID, "user_id")))
pass_input_el = driver.find_element(By.ID, "password")
login_button_el = driver.find_element(By.ID, "entry-login")
user_input_el.send_keys(USERNAME)
pass_input_el.send_keys(PASSWORD)
login_button_el.click()

course_elements = WebDriverWait(driver, 5).until(
    EC.presence_of_all_elements_located((By.CSS_SELECTOR, "ul.portletList-img.courseListing.coursefakeclass li a"))
)
course_urls = [(c.get_attribute("href"), c.text.strip().replace("/", "_").replace("\\", "_")) for c in course_elements if c.text.startswith("2025I")]

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
    ext = None
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
    if not ext:
        ext = ".bin"
    return root + ext

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
    except:
        content_links = []

    for content in content_links:
        href = content.get_attribute("href")
        if not href:
            continue
        if "listContent.jsp" in href:
            continue
        displayed = content.text.strip()
        candidate = displayed if displayed else derive_name_from_href(href)
        download_url = href if href.startswith("http") else "https://shs.blackboardchina.cn" + href
        try:
            r = requests.get(download_url, stream=True, auth=(USERNAME, PASSWORD), timeout=30, allow_redirects=True)
        except Exception as e:
            print(f"Failed to request {download_url}: {e}")
            continue
        if r.status_code != 200:
            print(f"Skipped {candidate}: status {r.status_code}")
            continue
        cd = r.headers.get("content-disposition")
        fname_from_cd = None
        if cd:
            _, params = cgi.parse_header(cd)
            fname_from_cd = params.get("filename") or params.get("filename*")
            if isinstance(fname_from_cd, bytes):
                try:
                    fname_from_cd = fname_from_cd.decode("utf-8", errors="ignore")
                except:
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
        except Exception as e:
            print(f"Failed to save {candidate}: {e}")

def iterate_subfolders(current_path):
    try:
        subfolder_elements = driver.find_elements(By.CSS_SELECTOR, "div.item.clearfix a")
        subfolder_info = []
        for el in subfolder_elements:
            href = el.get_attribute("href")
            if href and "listContent.jsp" in href:
                name = el.text.strip().replace("/", "_").replace("\\", "_")
                subfolder_info.append((name, href))
    except:
        subfolder_info = []

    for folder_name, href in subfolder_info:
        folder_path = os.path.join(current_path, sanitize_filename(folder_name))
        try:
            os.makedirs(folder_path, exist_ok=True)
        except:
            pass
        driver.get(href)
        download_files(folder_path)
        iterate_subfolders(folder_path)
        driver.back()

for course_url, course_name in course_urls:
    course_path = os.path.join(base_download, sanitize_filename(course_name))
    try:
        os.makedirs(course_path, exist_ok=True)
    except:
        pass

    driver.get(course_url)
    sidebar_links = WebDriverWait(driver, 5).until(
        EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#courseMenuPalette_contents li a"))
    )

    for i in range(len(sidebar_links)):
        sidebar_links = WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#courseMenuPalette_contents li a"))
        )
        link = sidebar_links[i]
        title = link.find_element(By.TAG_NAME, "span").get_attribute("title").strip()
        title_s = sanitize_filename(title.replace("/", "_").replace("\\", "_"))
        if title.lower() not in ["home page", "discussions", "groups", "tools", "help"]:
            sidebar_path = os.path.join(course_path, title_s)
            try:
                os.makedirs(sidebar_path, exist_ok=True)
            except:
                pass

            link.click()
            download_files(sidebar_path)
            iterate_subfolders(sidebar_path)

    my_institution = WebDriverWait(driver, 5).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "td[id='MyInstitution.label'] a"))
    )
    my_institution.click()
