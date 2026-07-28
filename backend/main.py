import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json

from routers import api

app = FastAPI(title="CrowdVJ Backend")

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error sending message: {e}")

manager = ConnectionManager()
app.state.manager = manager

app.include_router(api.router)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed, e.g., prompt generation requests
            print(f"Received: {data}")
            # Echo or process data
            await manager.broadcast({"type": "ack", "message": "Received"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

from services.chat_worker import LiveChatWorker
chat_worker = LiveChatWorker(manager)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(chat_worker.start())

@app.on_event("shutdown")
async def shutdown_event():
    chat_worker.stop()
