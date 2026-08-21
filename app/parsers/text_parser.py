import os

def extract_text_from_file(file_path: str) -> str:
    """Reads plain text, markdown, CSV, or code files with fallback encodings."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    encodings = ["utf-8", "latin-1", "cp1252", "iso-8859-1"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    
    # Fallback to binary decode ignoring errors
    with open(file_path, "rb") as f:
        return f.read().decode("utf-8", errors="ignore")
