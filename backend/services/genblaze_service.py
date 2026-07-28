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
from genblaze_gmicloud import GMICloudImageProvider

class GenerateRequest(BaseModel):
    prompt: str

class GenerateResponse(BaseModel):
    sceneId: str
    imageUrl: str
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
        self.gmi_key = os.getenv("GMICLOUD_API_KEY")

        if not self.use_mock:
            self.provider = GMICloudImageProvider(api_key=self.gmi_key)
            self.model_name = "Flux2-Dev"

    def _get_s3_client(self):
        return boto3.client(
            's3',
            endpoint_url=self.b2_endpoint,
            aws_access_key_id=self.b2_key_id,
            aws_secret_access_key=self.b2_application_key,
        )
            
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
                    if f"/scene-{scene_id}/" in obj['Key']:
                        parts = obj['Key'].split('/')
                        target_prefix = f"sessions/{parts[1]}/scene-{scene_id}/"
                        break
                if target_prefix:
                    break
            
            if not target_prefix:
                raise Exception("Scene not found")
            
            result = {}
            try:
                meta_obj = s3.get_object(Bucket=self.b2_bucket, Key=f"{target_prefix}metadata.json")
                result['metadata'] = json.loads(meta_obj['Body'].read().decode('utf-8'))
                
                prov_obj = s3.get_object(Bucket=self.b2_bucket, Key=f"{target_prefix}provenance.json")
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
                provider=provider,
                latency=latency
            )
        else:
            pipeline = Pipeline("crowdvj-generate")
            pipeline.step(
                self.provider, 
                model=self.model_name, 
                prompt=request.prompt,
                modality=Modality.IMAGE,
                num_candidates=2
            )
            
            pipeline_result = await pipeline.arun()
            latency = time.time() - start_time
            
            steps = pipeline_result.run.steps
            if not steps or not steps[0].assets:
                raise HTTPException(status_code=500, detail="Generation failed or returned no assets.")
            
            all_assets = steps[0].assets
            winner_asset = all_assets[0]
            
            async with httpx.AsyncClient() as client:
                resp = await client.get(winner_asset.url)
                resp.raise_for_status()
                winner_bytes = resp.content
            
            winner_hash = hashlib.sha256(winner_bytes).hexdigest()
            content_type = getattr(winner_asset, 'media_type', "image/webp") or "image/webp"
            ext = content_type.split('/')[-1] if '/' in content_type else "webp"
            if ext == "jpeg": ext = "jpg"
            
            winner_key = f"sessions/{session_id}/scene-{scene_id}/winner.{ext}"
            winner_url = await self.upload_to_b2(winner_bytes, winner_key, content_type)
            
            hashes = {winner_key: winner_hash}
            
            candidates = all_assets[1:]
            for i, cand in enumerate(candidates):
                async with httpx.AsyncClient() as client:
                    c_resp = await client.get(cand.url)
                    c_resp.raise_for_status()
                    c_bytes = c_resp.content
                    c_hash = hashlib.sha256(c_bytes).hexdigest()
                    c_ct = getattr(cand, 'media_type', "image/webp") or "image/webp"
                    c_ext = c_ct.split('/')[-1] if '/' in c_ct else "webp"
                    if c_ext == "jpeg": c_ext = "jpg"
                    
                    c_key = f"sessions/{session_id}/scene-{scene_id}/candidates/cand_{i}.{c_ext}"
                    await self.upload_to_b2(c_bytes, c_key, c_ct)
                    hashes[c_key] = c_hash
            
            metadata = {
                "run_id": pipeline_result.run.run_id,
                "manifest_hash": getattr(pipeline_result.manifest, 'canonical_hash', None)
            }
            meta_bytes = json.dumps(metadata).encode('utf-8')
            meta_key = f"sessions/{session_id}/scene-{scene_id}/metadata.json"
            await self.upload_to_b2(meta_bytes, meta_key, "application/json")
            hashes[meta_key] = hashlib.sha256(meta_bytes).hexdigest()
            
            provenance = {
                "prompt": request.prompt,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "provider": "gmicloud",
                "model": self.model_name,
                "latency": latency,
                "hashes": hashes
            }
            prov_bytes = json.dumps(provenance).encode('utf-8')
            prov_key = f"sessions/{session_id}/scene-{scene_id}/provenance.json"
            await self.upload_to_b2(prov_bytes, prov_key, "application/json")
            
            response = GenerateResponse(
                sceneId=scene_id,
                imageUrl=winner_url,
                provider="gmicloud",
                latency=latency
            )
            
        await self.manager.broadcast({
            "type": "scene_created",
            "data": {
                "sceneId": response.sceneId,
                "imageUrl": response.imageUrl,
                "prompt": request.prompt,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        })
        
        return response
