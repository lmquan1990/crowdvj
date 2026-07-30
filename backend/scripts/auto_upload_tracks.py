import os
import httpx
import asyncio
import boto3
from dotenv import load_dotenv

# Load biến môi trường từ file .env
load_dotenv()

B2_ENDPOINT = os.getenv("B2_ENDPOINT")
if B2_ENDPOINT and not B2_ENDPOINT.startswith("http"):
    B2_ENDPOINT = f"https://{B2_ENDPOINT}"

B2_BUCKET = os.getenv("B2_BUCKET")
B2_KEY_ID = os.getenv("B2_KEY_ID")
B2_APPLICATION_KEY = os.getenv("B2_APPLICATION_KEY")

# Danh sách các link nhạc Royalty-Free (Miễn phí bản quyền) để tải về
# Đây là các link direct demo. Trong thực tế, bạn có thể thay bằng file cục bộ hoặc link khác.
TRACKS = {
    "cyberpunk-synthwave.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "lofi-chill-hop.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "space-ambient-techno.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    "underwater-deep-house.mp3": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
}

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=B2_ENDPOINT,
        aws_access_key_id=B2_KEY_ID,
        aws_secret_access_key=B2_APPLICATION_KEY,
    )

async def download_and_upload(filename: str, url: str):
    print(f"[{filename}] Downloading from {url} ...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    async with httpx.AsyncClient(follow_redirects=True, headers=headers) as client:
        response = await client.get(url)
        response.raise_for_status()
        audio_data = response.content
        print(f"[{filename}] Downloaded {len(audio_data)} bytes. Uploading to B2...")

        def do_upload():
            s3 = get_s3_client()
            s3.put_object(
                Bucket=B2_BUCKET,
                Key=f"tracks/{filename}",
                Body=audio_data,
                ContentType="audio/mpeg"
            )

        await asyncio.to_thread(do_upload)
        print(f"[{filename}] ✅ Upload thành công lên tracks/{filename}")

async def main():
    if not all([B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APPLICATION_KEY]):
        print("❌ Thiếu thông tin B2 Credentials trong biến môi trường (hoặc file .env)")
        return

    print("🚀 Bắt đầu tiến trình Auto Fetch & Upload Tracks...")
    tasks = []
    for filename, url in TRACKS.items():
        tasks.append(download_and_upload(filename, url))
    
    await asyncio.gather(*tasks)
    print("🎉 Hoàn tất toàn bộ!")

if __name__ == "__main__":
    asyncio.run(main())
