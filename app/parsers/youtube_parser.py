import re
import requests
from youtube_transcript_api import YouTubeTranscriptApi

def extract_youtube_video_id(url: str) -> str:
    """Extracts YouTube video ID from various URL patterns."""
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})',
        r'(?:embed\/)([0-9A-Za-z_-]{11})',
        r'(?:shorts\/)([0-9A-Za-z_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    # If raw 11 chars
    if len(url.strip()) == 11:
        return url.strip()
    return ""

def extract_text_from_youtube(url: str) -> dict:
    """Fetches video title and transcript for a given YouTube URL."""
    video_id = extract_youtube_video_id(url)
    if not video_id:
        raise ValueError(f"URL de YouTube inválida: {url}")

    # Fetch title via oEmbed
    title = f"Vídeo YouTube ({video_id})"
    author = ""
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        res = requests.get(oembed_url, timeout=10)
        if res.status_code == 200:
            data = res.json()
            title = data.get("title", title)
            author = data.get("author_name", "")
    except Exception:
        pass

    # Fetch transcript
    transcript_text = ""
    try:
        # Try fetching transcript in Portuguese or English or auto-generated
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['pt', 'pt-BR', 'en', 'en-US', 'es'])
        formatted_lines = []
        for entry in transcript_list:
            start_sec = int(entry.get('start', 0))
            mins, secs = divmod(start_sec, 60)
            timestamp = f"[{mins:02d}:{secs:02d}]"
            text = entry.get('text', '').strip()
            formatted_lines.append(f"{timestamp} {text}")
        transcript_text = "\n".join(formatted_lines)
    except Exception as e:
        # Fallback if transcript disabled or unavailable
        transcript_text = f"Nota: A transcrição automática deste vídeo não pôde ser obtida diretamente ({str(e)}). Título do vídeo: {title} por {author}."

    header = f"# {title}\nCanal/Autor: {author}\nLink Original: https://www.youtube.com/watch?v={video_id}\n\n---\n\n"
    full_content = header + transcript_text

    return {
        "title": title,
        "video_id": video_id,
        "author": author,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "content": full_content
    }
