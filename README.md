
**Es lebe der Arbeiterklasse! 工人阶级万岁! Long Live the Working Class!**
# Whiteboard Downloader
Whiteboard is
a Python-based automation tool to download course materials from **SHSID Blackboard China**. \
 Using a variety of python modules, mostly selenium and requests, this project greatly saves time and effort during the preserving of course materials, and lays as the foundation for furthur, scaled extraction of data from **Blackboard**.

---

## Table of Contents

1. [Overview](#overview)  
2. [Features](#features)  
3. [Prerequisites](#prerequisites)  
4. [Installation](#installation)  
5. [Configuration](#configuration)  
6. [Running the Tool](#running-the-tool)  
7. [Troubleshooting](#troubleshooting)  
8. [Known Issues](#known-issues)  
9. [License](#license)  

---

## Overview

This tool automates downloading materials from Blackboard China. It uses:

- `requests` and `urllib3` for HTTP requests.  
- `selenium` for browser automation where required.  
- SSL/TLS handling to ensure secure connections with older servers.

Unfortuately, this tool is **very picky** with versions of various libararies. For exact information, please refer to [Prerequisites](#prerequisites)  

---

## Features

- Automatically logs into Blackboard
- Uses a fixed algorithm to navigate through the blackboard file structure, detecting downloadable files.
- Automatically organizes downloaded files into structured directories.  

---

## Prerequisites

Before running the tool, ensure your system meets the following:

1. **Python**: Version **3.10 or 3.11** recommended. Python **3.12+** MAY have TLS/OpenSSL issues with legacy servers.  
   To check your version, type in Command Prompt:
   ```bash
   python --version
   ```
Note: We are currently not sure if python 3.12 is compatible. If you're using Python 3.12+ and an error occured, please notify me.

2. **OpenSSL**: Version **1.1.1** (or **3.x.**  Maybe.).\
   To check your OpenSSL version:
   (This should come with the python installation, theres no need to download it seperately.)

   ```bash
   python -c "import ssl; print(ssl.OPENSSL_VERSION)"
   ```
Note: We are currently unsure if **3.x** versions of OpenSSL is supported. If you're using **3.x** versions of OpenSSL and an error occured, please notify me.

3. **Required Python Packages**:

   ```bash
   pip install selenium requests==2.28.2 urllib3==1.26.14
   ```
Note: Through numerous tests we infered that the latest versions of `requests` and `urllibs3` will result in compatibility issues. Therefore, please install past versions, as in the previous command line.

4. **Chrome Browser & ChromeDriver**:

   * Latest verion of Chrome Browser (Version 140.0.7339.81) in the default installation location. You can verify this by going to Chrome --> Settings --> About Chrome.
   * Chromedriver-win64 folder, placed in the exact same directory as the `whiteboard_download_V.0.3.6.py`.
   * Immediately inside the ChromeDriver folder should contain the `chromedriver.exe` and two other files. A common mistake when unzipping the `chromedriver-win64` folder is having an additional layer of folder.
Note: The customization of `Chrome`/`Chromedriver` Path in the code is an upcoming feature. For those familiar with python, you can also edit it through lines 87-88 (for V.0.3.6): 
   ```bash
chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
chromedriver_path = "chromedriver-win64/chromedriver.exe"
   ```

5. **Internet Connection**: Required to download content from Blackboard. Dont use hotspot as the total download file size often exceeds 100MB.

---

## Installation
Note: This installation guide is designed for those lacking any previous coding skills, so it will not involve git cloning.

1. **Download the Release**
You can do this by downloading the project as a .zip:
\
This is equivalent to copying the following link in a browser tab:
   ```bash
   https://github.com/Panther114/WhiteBoard-Downloader/archive/refs/heads/main.zip
   ```

2. **Unzip the zip**
If you are downloading directly from github, all you have to do is unzip the file. The relative locations of the folders & files are already in correct order.

3. **Check Prerequisites**
Now you want to make sure that you have done everything in the [Prerequisites](#prerequisites)  part. \
This includes: \
   1.Python 3.10+ \
   2.Chrome Browser & Matching ChromeDriver \
   3.Required libraries. (Run `
   pip install selenium requests==2.28.2 urllib3==1.26.14
   ` in the command prompt.)\
   4.Unwavering Determination.

4. **Verify Installation**
   Run a simple test, by pasting the following code in IDLE and executing it, to ensure your connnection works:
This is crucial. 75% of errors are due to connection issues.

   ```python
   import requests
   r = requests.get("https://shs.blackboardchina.cn")
   print(r.status_code)
   ```

   Expected result: `200`\
    \
   If the result is not 200, or if an error occured, this is **likely** due to incompatible library versions. (See [Prerequisites](#prerequisites) part 3)\
   - Make sure you have ran in command prompt  `pip install selenium requests==2.28.2 urllib3==1.26.14`.\
   - If the error persists, please contact me.

---

## Configuration (Not recommended for V0.3.6 and older!)

1. **ChromeDriver Path**

   * By default, the script searches for `chromedriver` in the project folder.
   * To specify a path manually, update the script:

   ```python
   driver = webdriver.Chrome(executable_path="C:/path/to/chromedriver.exe", options=options)
   ```
2. **Chrome Path**

   * By default, the script searches for `Google Chrome` in the default installation location.
   * To specify a path manually, update the script:

   ```python
   chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
   ```

3. **Download Folder**

   * The default download directory is `downloads/`. (relative to the main python script)
   * You can change it by editing:

   ```python
   base_download = "downloads" # change this part
   os.makedirs(base_download, exist_ok=True)
   ```

---

## Running the Tool

1. Run the main script: (preferbly with a debugger so you can send me the error msg if something goes wrong)

   ```bash
   python     whiteboard_download_XXversioN.py
   ```

3. Enter your Gnumber and Password in the GUI pop-up.

4. Files will be downloaded into structured folders automatically.

---

## Troubleshooting
Note: If anything goes wrong, first prioritize reporting the error and sending to me the error log! This will help a ton in future development, and potentially allow me realize flaws. I can also provide fast feedback, as I'm the one most familiar with the code.
### SSL/TLS Errors

* If you get:

  ```
  SSLError: [SSL: SSLV3_ALERT_HANDSHAKE_FAILURE] (followed by a long piece of info)
  ```

  Ensure:
  * **Check this first!** `requests` and `urllib3` are in the correct versions. (See [Prerequisites](#prerequisites) part 3)
  * Python is version 3.10 or 3.11. (Maybe causing the issue)
  * OpenSSL is 1.1.1. (Maybe causing the issue)


### ChromeDriver Errors
This one is a lot less trickly than the previous one :)

* If you see:

  ```
  ValueError: The path is not a valid file
  ```

  Ensure:

  * ChromeDriver executable exists and matches your Chrome version.
  * The path is correctly set in the script.

### Module Errors

* If a module is missing:

  ```bash
  pip install module_name
  ```

  Example:

  ```bash
  pip install selenium requests==2.28.2 urllib3==1.26.14
  ```

---

## Known Issues

* **Python 3.12**: May not work due to OpenSSL 3.x incompatibilities with legacy TLS servers.
* **Some legacy Blackboard servers**: Might still reject TLS connections; upgrading Python and OpenSSL is required.
* **Deprecation warnings**: Python may show warnings for `ssl.PROTOCOL_TLSv1_2` or `cgi`. These do not break functionality.

---

## License

This project is licensed under the MIT License.

---

**Note:** Always ensure your testing environment has the correct Python, OpenSSL, and module versions for consistent results. This guide is intended for internal testing and controlled environments.

Special thanks to **@AquaVision** and **@MaxShuang** for helping me during the testing process.

**Es lebe der Arbeiterklasse! 工人阶级万岁! Long Live the Working Class!**