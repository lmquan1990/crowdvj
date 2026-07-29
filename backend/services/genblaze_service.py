import os
import json
import time
import hashlib
import httpx
import uuid
from datetime import datetime, timezone
import boto3
import asyncio
from fastapi import HTTPException
from pydantic import BaseModel

from genblaze_core.pipeline import Pipeline
from genblaze_core.models.enums import Modality
from genblaze_google import ImagenProvider
from genblaze_s3 import S3StorageBackend
from genblaze_core.providers.base import BaseProvider
from genblaze_core.models.step import Step
from genblaze_core.models.asset import Asset

B2_PUBLIC_BASE = f"{os.getenv('B2_ENDPOINT')}/file/{os.getenv('B2_BUCKET')}/tracks"

AUDIO_LIBRARY = {
    "cyberpunk": f"{B2_PUBLIC_BASE}/cyberpunk-synthwave.mp3",
    "neon": f"{B2_PUBLIC_BASE}/cyberpunk-synthwave.mp3",
    "lofi": f"{B2_PUBLIC_BASE}/lofi-chill-hop.mp3",
    "coffee": f"{B2_PUBLIC_BASE}/lofi-chill-hop.mp3",
    "space": f"{B2_PUBLIC_BASE}/space-ambient-techno.mp3",
    "station": f"{B2_PUBLIC_BASE}/space-ambient-techno.mp3",
    "underwater": f"{B2_PUBLIC_BASE}/underwater-deep-house.mp3",
    "ocean": f"{B2_PUBLIC_BASE}/underwater-deep-house.mp3",
    "default": f"{B2_PUBLIC_BASE}/cyberpunk-synthwave.mp3"
}

def match_audio_from_prompt(prompt: str) -> str:
    """Khớp nhạc theo từ khóa trong Prompt"""
    prompt_lower = prompt.lower()
    for keyword, audio_url in AUDIO_LIBRARY.items():
        if keyword in prompt_lower:
            return audio_url
    return AUDIO_LIBRARY["default"]

class DynamicAudioProvider(BaseProvider):
    name = "dynamic-audio-provider"

    def submit(self, step: Step, config=None):
        # Mô phỏng quá trình gọi API (vd: Pixabay/Freesound) để tìm mp3 từ prompt
        audio_url = match_audio_from_prompt(step.prompt)
        return audio_url
        
    def poll(self, prediction_id, config=None) -> bool:
        return True
        
    def fetch_output(self, prediction_id, step: Step) -> Step:
        # prediction_id ở đây chính là audio_url
        # Tải file MP3 vào RAM để đẩy cho Genblaze Sink upload
        with httpx.Client(follow_redirects=True) as client:
            resp = client.get(prediction_id)
            resp.raise_for_status()
            step.assets = [Asset(bytes=resp.content, media_type="audio/mp3")]
        return step

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
        self.gmi_key = os.getenv("GEMINI_API_KEY") # We use GEMINI_API_KEY mapped to this property

        self.s3_sink = S3StorageBackend(
            bucket=self.b2_bucket,
            endpoint_url=self.b2_endpoint,
            aws_access_key_id=self.b2_key_id,
            aws_secret_access_key=self.b2_application_key,
            public_url_base=self.b2_public_cdn
        )

        if not self.use_mock:
            self.provider = ImagenProvider(api_key=self.gmi_key)
            self.model_name = "imagen-3.0-generate-002"

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
            # We use sessions/session_id as tenant_id so Genblaze puts files under sessions/session_id/run_id/
            pipeline = Pipeline("crowdvj-generate", tenant_id=f"sessions/{session_id}")
            
            # Step 1: Image Generation
            pipeline.step(
                self.provider, 
                model=self.model_name, 
                prompt=request.prompt,
                modality=Modality.IMAGE,
                num_candidates=1
            )
            
            # Step 2: Dynamic Audio Search
            audio_provider = DynamicAudioProvider()
            pipeline.step(
                audio_provider,
                model="dynamic-search",
                prompt=request.prompt,
                modality=Modality.AUDIO
            )
            
            pipeline_result = await pipeline.arun(sink=self.s3_sink)
            latency = time.time() - start_time
            
            steps = pipeline_result.run.steps
            if not steps or len(steps) < 2 or not steps[0].assets or not steps[1].assets:
                raise HTTPException(status_code=500, detail="Generation failed or returned missing assets.")
            
            # The run_id is the unique scene_id generated by Genblaze
            scene_id = pipeline_result.run.run_id
            winner_asset = steps[0].assets[0]
            audio_asset = steps[1].assets[0]
            
            response = GenerateResponse(
                sceneId=scene_id,
                imageUrl=winner_asset.url,
                audioUrl=audio_asset.url,
                provider="google",
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
