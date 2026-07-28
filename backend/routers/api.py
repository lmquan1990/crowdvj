from fastapi import APIRouter, Request, Depends
from services.genblaze_service import GenerateRequest, GenblazeService
import uuid

router = APIRouter(prefix="/api")

def get_service(request: Request) -> GenblazeService:
    # Get the manager from app state, initialized in main.py
    manager = request.app.state.manager
    return GenblazeService(manager=manager)

@router.post("/generate")
async def generate_scene(
    body: GenerateRequest, 
    service: GenblazeService = Depends(get_service)
):
    # In a real app session_id would come from auth/cookies, we'll generate one for simplicity
    session_id = "default-session" 
    return await service.generate(body, session_id)

@router.get("/archive")
async def list_archive(service: GenblazeService = Depends(get_service)):
    if service.use_mock:
        return {"sessions": ["mock-session"]}
    sessions = await service.get_b2_sessions()
    return {"sessions": sessions}

@router.get("/archive/{sceneId}")
async def get_archive_scene(
    sceneId: str, 
    service: GenblazeService = Depends(get_service)
):
    if service.use_mock:
        return {
            "metadata": {"mock": True},
            "provenance": {
                "prompt": "Mock prompt",
                "model": "mock-model"
            }
        }
    return await service.get_scene_data(sceneId)
