# TripMate

TripMate is a multi-agent AI travel planning project.

## Architecture

User -> FastAPI -> Supervisor -> Specialized Agents -> Shared AgentState -> Final Itinerary

Agents:
- Planner
- Destination
- Transport
- Hotel
- Activity
- Food
- Budget
- Itinerary
- Critic

## Run backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open:
http://localhost:8000/docs

## Run frontend

```powershell
cd frontend
npm install
npm run dev
```

## Optional Ollama

Install Ollama and pull a model:

```powershell
ollama pull llama3.2
```

The current MVP uses deterministic agents for reliability. Ollama is already wired into
`app/core/llm.py` so the agents can progressively be upgraded to LLM/tool-driven agents.

## Next production upgrades

1. Replace static travel estimates with real APIs.
2. Add PostgreSQL persistence.
3. Add FAISS/RAG for destination knowledge.
4. Add LangGraph orchestration.
5. Add authentication and user preferences.
6. Add map and route optimization.
7. Add critic-driven replanning loops.
8. Add Docker Compose and CI/CD.
