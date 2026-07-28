import asyncio
import os
import random
import time
import httpx
from services.genblaze_service import GenerateRequest, GenblazeService

class LiveChatWorker:
    def __init__(self, manager):
        self.manager = manager
        self.use_mock = os.getenv("USE_MOCK_GENBLAZE", "false").lower() == "true"
        self.youtube_api_key = os.getenv("YOUTUBE_API_KEY")
        self.active_video_id = os.getenv("YOUTUBE_VIDEO_ID")
        self.running = False
        
        self.mock_themes = [
            "A cyberpunk city with neon lights raining",
            "A futuristic space station orbiting a ringed planet",
            "An underwater temple glowing with bioluminescence",
            "A serene lofi coffee shop in the rain",
            "A vast desert with giant floating crystals",
            "A neon forest with glowing mushrooms"
        ]

    async def start(self):
        self.running = True
        print("LiveChatWorker started.")
        while self.running:
            await asyncio.sleep(20) # Poll every 20 seconds
            await self._poll_and_generate()
            
    def stop(self):
        self.running = False

    async def _poll_and_generate(self):
        # 1. Collect messages
        messages = await self._fetch_messages()
        
        # 2. Extract theme (Simulated summarization for now)
        if not messages:
            prompt = random.choice(self.mock_themes)
        else:
            # Just grab the latest message as the "dominant" theme for the demo
            prompt = f"{messages[-1]} in a highly detailed, cinematic style"
            
        print(f"[ChatWorker] Generating based on chat: {prompt}")
        
        # 3. Submit to Genblaze Pipeline
        service = GenblazeService(self.manager)
        request = GenerateRequest(prompt=prompt)
        session_id = "live-chat-session"
        try:
            await service.generate(request, session_id)
        except Exception as e:
            print(f"[ChatWorker] Error generating image: {e}")

    async def _fetch_messages(self) -> list[str]:
        if self.use_mock or not self.youtube_api_key or not self.active_video_id:
            # Simulate some user messages
            mock_inputs = [
                "make it cyberpunk",
                "more neon!",
                "add a glowing forest",
                "spaceship",
                "underwater ruins",
                "synthwave sunset"
            ]
            return [random.choice(mock_inputs)]
            
        # In a real scenario, call YouTube LiveChatMessages API
        # We would need to resolve video_id -> liveChatId first.
        # For hackathon demo, if key is provided but we don't have chat ID, fallback to mock.
        return [random.choice(self.mock_themes)]
