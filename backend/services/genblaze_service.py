import os
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import asyncio
from fastapi import HTTPException
from pydantic import BaseModel

from genblaze_core import Pipeline, Modality, Step
from genblaze_google import GeminiImageProvider
from genblaze_s3 import S3StorageBackend

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

B2_PUBLIC_BASE = f"{os.getenv('B2_ENDPOINT')}/file/{os.getenv('B2_BUCKET')}/tracks"

# Target model: Gemini 2.5 Flash Image (Nano Banana 2 Lite)
# Routed through GCP Agent Platform (Vertex AI) when GCP_PROJECT_ID is set.
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"

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
    "default": f"{B2_PUBLIC_BASE}/cyberpunk-synthwave.mp3",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def match_audio_from_prompt(prompt: str) -> str:
    """Khớp nhạc theo từ khóa trong Prompt"""
    prompt_lower = prompt.lower()
    for keyword, audio_url in AUDIO_LIBRARY.items():
        if keyword in prompt_lower:
            return audio_url
    return AUDIO_LIBRARY["default"]


def _build_provider() -> GeminiImageProvider:
    """
    Construct a GeminiImageProvider configured for GCP Agent Platform (Vertex AI).

    Auth strategy (in priority order):
      1. If GCP_PROJECT_ID is set → Vertex AI mode is activated automatically.
         GoogleClientMixin._get_client() builds:
           genai.Client(vertexai=True, project=GCP_PROJECT_ID, location=GCP_LOCATION)
         Billing/quota are routed through the GCP project (Agent Platform API).
      2. If GCP_PROJECT_ID is NOT set → falls back to Gemini AI Studio mode
         using GCP_API_KEY or GEMINI_API_KEY.

    Note: api_key= is only used in AI Studio fallback mode. In Vertex AI mode
    the SDK ignores it and uses Application Default Credentials (ADC) instead.
    """
    return GeminiImageProvider(
        api_key=os.getenv("GCP_API_KEY") or os.getenv("GEMINI_API_KEY"),
        project=os.getenv("GCP_PROJECT_ID"),   # None → AI Studio fallback
        location=os.getenv("GCP_LOCATION", "us-central1"),
    )

# DynamicAudioProvider is handled directly (not as a pipeline step)
# to avoid Genblaze family validation issues with custom audio providers

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    prompt: str

class GenerateResponse(BaseModel):
    sceneId: str
    imageUrl: str
    audioUrl: str
    provider: str
    latency: float

# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

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

        self.s3_sink = S3StorageBackend(
            bucket=self.b2_bucket,
            endpoint_url=self.b2_endpoint,
            aws_access_key_id=self.b2_key_id,
            aws_secret_access_key=self.b2_application_key,
            public_url_base=self.b2_public_cdn,
        )

    def _get_s3_client(self):
        return self.s3_sink._client

    async def upload_to_b2(self, file_bytes: bytes, key: str, content_type: str) -> str:
        def do_upload():
            s3 = self._get_s3_client()
            s3.put_object(
                Bucket=self.b2_bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
        await asyncio.to_thread(do_upload)
        return f"{self.b2_public_cdn}/{key}"

    async def get_b2_sessions(self):
        def do_get():
            s3 = self._get_s3_client()
            sessions = set()
            paginator = s3.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.b2_bucket, Prefix="sessions/"):
                for obj in page.get("Contents", []):
                    parts = obj["Key"].split("/")
                    if len(parts) >= 2:
                        sessions.add(parts[1])
            return list(sessions)
        return await asyncio.to_thread(do_get)

    async def get_scene_data(self, scene_id: str):
        def do_get_data():
            s3 = self._get_s3_client()
            paginator = s3.get_paginator("list_objects_v2")
            target_prefix = None
            for page in paginator.paginate(Bucket=self.b2_bucket, Prefix="sessions/"):
                for obj in page.get("Contents", []):
                    # Support both old path format (/scene-{scene_id}/) and Genblaze path format (/{scene_id}/)
                    if f"/scene-{scene_id}/" in obj["Key"] or f"/{scene_id}/" in obj["Key"]:
                        # Determine which separator was matched
                        sep = f"/scene-{scene_id}/" if f"/scene-{scene_id}/" in obj["Key"] else f"/{scene_id}/"
                        parts = obj["Key"].split(sep)
                        target_prefix = f"{parts[0]}{sep}"
                        break
                if target_prefix:
                    break

            if not target_prefix:
                raise Exception("Scene not found")

            result = {}
            try:
                meta_obj = s3.get_object(Bucket=self.b2_bucket, Key=f"{target_prefix}metadata.json")
                result["metadata"] = json.loads(meta_obj["Body"].read().decode("utf-8"))
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
                result["provenance"] = json.loads(prov_obj["Body"].read().decode("utf-8"))
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
            provider_str = "mock-provider"

            response = GenerateResponse(
                sceneId=scene_id,
                imageUrl=image_url,
                audioUrl=match_audio_from_prompt(request.prompt),
                provider=provider_str,
                latency=latency,
            )
        else:
            # Determine matching audio from prompt keywords
            audio_url = match_audio_from_prompt(request.prompt)

            # ------------------------------------------------------------------
            # Generate image via GCP Agent Platform (Vertex AI) using the
            # Genblaze Pipeline + GeminiImageProvider.
            #
            # GeminiImageProvider.generate() internally builds:
            #   genai.Client(vertexai=True, project=GCP_PROJECT_ID, location=GCP_LOCATION)
            # when project= is supplied — routing billing/quota through the GCP project.
            # Without project=, it falls back to AI Studio (GEMINI_API_KEY) mode.
            #
            # The provider enforces response_modalities=["IMAGE"] and writes image
            # bytes to a temp file, appending an Asset(url="file://...") to step.assets.
            # We read those bytes and upload to Backblaze B2, preserving the existing
            # path structure used by the rest of the app.
            #
            # STREAM SAFETY: This is strictly on-demand (per user click) — not looped.
            # ------------------------------------------------------------------
            provider = _build_provider()

            enriched_prompt = (
                f"{request.prompt}, cinematic, highly detailed, vibrant colors"
            )

            def run_pipeline() -> Step:
                """
                Execute the Genblaze pipeline synchronously inside a thread.

                Pipeline.arun() is async; we spin up a fresh event loop here so
                asyncio.to_thread can wrap the sync boundary without conflicting
                with FastAPI's running event loop.
                """
                import asyncio as _asyncio

                pipeline = (
                    Pipeline(
                        f"crowdvj-{scene_id}",
                        # preflight=False: skip the upstream model-catalog probe.
                        # The probe calls client.models.get() against the AI Studio
                        # endpoint, which returns NOT_FOUND for gemini-2.5-flash-image
                        # when credentials are Vertex AI-only (no fallback key).
                        # The model is valid on GCP Agent Platform; any real errors
                        # (auth, region, quota) will surface from generate() itself.
                        preflight=False,
                    )
                    .step(
                        provider,
                        model=GEMINI_IMAGE_MODEL,
                        prompt=enriched_prompt,
                        modality=Modality.IMAGE,
                        # num_candidates=1: generate exactly 1 image candidate to
                        # minimise latency and prevent duplicate billing.
                        params={"num_candidates": 1},
                    )
                )

                loop = _asyncio.new_event_loop()
                try:
                    result = loop.run_until_complete(pipeline.arun())
                finally:
                    loop.close()

                succeeded = result.succeeded_steps()
                if not succeeded:
                    summary = result.error_summary() or "Unknown pipeline error"
                    raise Exception(f"Image pipeline failed: {summary}")

                return succeeded[0]

            step: Step = await asyncio.to_thread(run_pipeline)

            if not step.assets:
                raise Exception("Pipeline returned no image assets")

            # Read the first image asset written to local temp file by the provider
            first_asset = step.assets[0]
            asset_path = Path(urlparse(first_asset.url).path)
            img_bytes = asset_path.read_bytes()
            mime_type = first_asset.media_type or "image/png"
            ext = mime_type.split("/")[-1].replace("jpeg", "jpg")

            # Upload to B2 via genblaze S3 sink's underlying client
            img_key = f"sessions/{session_id}/{scene_id}/image.{ext}"
            def upload_image():
                s3 = self._get_s3_client()
                s3.put_object(
                    Bucket=self.b2_bucket,
                    Key=img_key,
                    Body=img_bytes,
                    ContentType=mime_type,
                )
            await asyncio.to_thread(upload_image)

            latency = time.time() - start_time
            image_url = f"{self.b2_public_cdn}/{img_key}"

            # Provider label reflects actual auth route used
            _vertex_active = bool(os.getenv("GCP_PROJECT_ID"))
            provider_str = (
                f"gcp-agent-platform/{GEMINI_IMAGE_MODEL}"
                if _vertex_active
                else f"google-gemini/{GEMINI_IMAGE_MODEL}"
            )

            response = GenerateResponse(
                sceneId=scene_id,
                imageUrl=image_url,
                audioUrl=audio_url,
                provider=provider_str,
                latency=latency,
            )

        await self.manager.broadcast({
            "type": "scene_created",
            "data": {
                "sceneId": response.sceneId,
                "sessionId": session_id,
                "imageUrl": response.imageUrl,
                "audioUrl": response.audioUrl,
                "prompt": request.prompt,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        })

        return response
