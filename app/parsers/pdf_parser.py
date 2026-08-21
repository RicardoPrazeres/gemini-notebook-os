import os
from pypdf import PdfReader

def extract_text_from_pdf(file_path: str) -> str:
    """Extracts text from PDF file with page markers."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    reader = PdfReader(file_path)
    extracted_text_parts = []

    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            extracted_text_parts.append(f"--- [Página {i + 1}] ---\n{text.strip()}")

    full_text = "\n\n".join(extracted_text_parts)
    return full_text.strip()
