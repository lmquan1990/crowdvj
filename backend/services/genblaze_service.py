import os
import json
import time
import hashlib
import uuid
from datetime import datetime, timezone
import boto3
import asyncio
from fastapi import HTTPException
from pydantic import BaseModel

from genblaze_s3 import S3StorageBackend
from google import genai
from google.genai import types

B2_PUBLIC_BASE = f"{os.getenv('B2_ENDPOINT')}/file/{os.getenv('B2_BUCKET')}/tracks"

# Fixed model: verified working with this API key
GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"

AUDIO_LIBRARY = {
    "cyberpunk": f"{B2_PUBLIC_BASE}/cyberpunk-synthwave.mp3",
    "neon": f"{B2_PUBLIC_BASE}/cyberpunk-synthwave.mp3",
    "lofi": f"{B2_PUBLIC_BASE}/lofi-chill-hop.mp3",
    "coffee": f"{B2_PUBLIC_BASE}/lofi-chill-hop.mp3",
    "space": f"{B2_PUBLIC_BASE}/space-ambient-techno.mp3",
    "station": f"{B2_PUBLIC_BASE}/space-ambient-techno.mp3",
    "underwater": f"{B2_PUBLIC_BASE}/underwater-deep-house.mp3",
    "ocean": f"{B2_PUBLIC_BASE}/underwater-deep-house.mp3",
    "forest": f"{B2_PUBLIC_BASE}/lofi-chill-hop.mp3",
    "default": f"{B2_PUBLIC_BASE}/cyberpunk-synthwave.mp3"
}

def match_audio_from_prompt(prompt: str) -> str:
    """Khớp nhạc theo từ khóa trong Prompt"""
    prompt_lower = prompt.lower()
    for keyword, audio_url in AUDIO_LIBRARY.items():
        if keyword in prompt_lower:
            return audio_url
    return AUDIO_LIBRARY["default"]

# DynamicAudioProvider is handled directly (not as a pipeline step)
# to avoid Genblaze family validation issues with custom audio providers

class GenerateRequest(BaseModel):
    prompt: str

class GenerateResponse(BaseModel):
    sceneId: str
    imageUrl: str
    audioUrl: str
    provider: str
    latency: float

class GenblazeService:
    def __init__(self, manager):
        self.manager = manager
        self.use_mock = os.getenv("USE_MOCK_GENBLAZE", "false").lower() == "true"
        
        b2_ep = os.getenv("B2_ENDPOINT")
        if b2_ep and not b2_ep.startswith("http"):
            b2_ep = f"https://{b2_ep}"
        self.b2_endpoint = b2_ep
        
        self.b2_bucket = os.getenv("B2_BUCKET")
        self.b2_key_id = os.getenv("B2_KEY_ID")
        self.b2_application_key = os.getenv("B2_APPLICATION_KEY")
        self.b2_public_cdn = os.getenv("B2_PUBLIC_CDN_URL")
        self.gmi_key = os.getenv("GEMINI_API_KEY")

        self.s3_sink = S3StorageBackend(
            bucket=self.b2_bucket,
            endpoint_url=self.b2_endpoint,
            aws_access_key_id=self.b2_key_id,
            aws_secret_access_key=self.b2_application_key,
            public_url_base=self.b2_public_cdn
        )

        if not self.use_mock:
            self.genai_client = genai.Client(api_key=self.gmi_key)

    def _get_s3_client(self):
        return self.s3_sink._client
            
    async def upload_to_b2(self, file_bytes: bytes, key: str, content_type: str) -> str:
        def do_upload():
            s3 = self._get_s3_client()
            s3.put_object(
                Bucket=self.b2_bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type
            )
        await asyncio.to_thread(do_upload)
        return f"{self.b2_public_cdn}/{key}"

    async def get_b2_sessions(self):
        def do_get():
            s3 = self._get_s3_client()
            sessions = set()
            paginator = s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=self.b2_bucket, Prefix="sessions/"):
                for obj in page.get('Contents', []):
                    parts = obj['Key'].split('/')
                    if len(parts) >= 2:
                        sessions.add(parts[1])
            return list(sessions)
        return await asyncio.to_thread(do_get)

    async def get_scene_data(self, scene_id: str):
        def do_get_data():
            s3 = self._get_s3_client()
            paginator = s3.get_paginator('list_objects_v2')
            target_prefix = None
            for page in paginator.paginate(Bucket=self.b2_bucket, Prefix="sessions/"):
                for obj in page.get('Contents', []):
                    # Support both old path format (/scene-{scene_id}/) and Genblaze path format (/{scene_id}/)
                    if f"/scene-{scene_id}/" in obj['Key'] or f"/{scene_id}/" in obj['Key']:
                        # Determine which separator was matched
                        sep = f"/scene-{scene_id}/" if f"/scene-{scene_id}/" in obj['Key'] else f"/{scene_id}/"
                        parts = obj['Key'].split(sep)
                        target_prefix = f"{parts[0]}{sep}"
                        break
                if target_prefix:
                    break
            
            if not target_prefix:
                raise Exception("Scene not found")
            
            result = {}
            try:
                meta_obj = s3.get_object(Bucket=self.b2_bucket, Key=f"{target_prefix}metadata.json")
                result['metadata'] = json.loads(meta_obj['Body'].read().decode('utf-8'))
            except Exception:
                pass
                
            try:
                # Try getting old provenance.json or new manifest.json
                prov_key = f"{target_prefix}provenance.json"
                try:
                    prov_obj = s3.get_object(Bucket=self.b2_bucket, Key=prov_key)
                except Exception:
                    prov_key = f"{target_prefix}manifest.json"
                    prov_obj = s3.get_object(Bucket=self.b2_bucket, Key=prov_key)
                result['provenance'] = json.loads(prov_obj['Body'].read().decode('utf-8'))
            except Exception:
                pass
            
            return result

        try:
            return await asyncio.to_thread(do_get_data)
        except Exception as e:
            if str(e) == "Scene not found":
                raise HTTPException(status_code=404, detail="Scene not found")
            raise HTTPException(status_code=500, detail=str(e))

    async def generate(self, request: GenerateRequest, session_id: str) -> GenerateResponse:
        start_time = time.time()
        scene_id = str(uuid.uuid4())
        
        if self.use_mock:
            await asyncio.sleep(1.0)
            latency = time.time() - start_time
            image_url = "https://placehold.co/1024x1024/png?text=Mock+Genblaze+Image"
            provider = "mock-provider"
            
            response = GenerateResponse(
                sceneId=scene_id,
                imageUrl=image_url,
                audioUrl=match_audio_from_prompt(request.prompt),
                provider=provider,
                latency=latency
            )
        else:
            # Determine matching audio from prompt keywords
            audio_url = match_audio_from_prompt(request.prompt)

            # Generate image directly via Google AI SDK (bypassing Genblaze model registry)
            def generate_image_sync():
                response = self.genai_client.models.generate_content(
                    model=GEMINI_IMAGE_MODEL,
                    contents=f"{request.prompt}, cinematic, highly detailed, vibrant colors",
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE", "TEXT"]
                    )
                )
                parts = response.candidates[0].content.parts
                img_parts = [p for p in parts if hasattr(p, "inline_data") and p.inline_data]
                if not img_parts:
                    raise Exception("No image returned from Gemini")
                return img_parts[0].inline_data

            inline_data = await asyncio.to_thread(generate_image_sync)
            img_bytes = inline_data.data
            mime_type = inline_data.mime_type or "image/png"
            ext = mime_type.split("/")[-1].replace("jpeg", "jpg")

            # Upload to B2 via genblaze S3 sink's underlying client
            img_key = f"sessions/{session_id}/{scene_id}/image.{ext}"
            def upload_image():
                s3 = self._get_s3_client()
                s3.put_object(
                    Bucket=self.b2_bucket,
                    Key=img_key,
                    Body=img_bytes,
                    ContentType=mime_type
                )
            await asyncio.to_thread(upload_image)

            latency = time.time() - start_time
            image_url = f"{self.b2_public_cdn}/{img_key}"

            response = GenerateResponse(
                sceneId=scene_id,
                imageUrl=image_url,
                audioUrl=audio_url,
                provider=f"google-gemini/{GEMINI_IMAGE_MODEL}",
                latency=latency
            )
            
        await self.manager.broadcast({
            "type": "scene_created",
            "data": {
                "sceneId": response.sceneId,
                "sessionId": session_id,
                "imageUrl": response.imageUrl,
                "audioUrl": response.audioUrl,
                "prompt": request.prompt,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        })
        
        return response
