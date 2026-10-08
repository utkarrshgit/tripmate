# TripMate Architecture

The Supervisor owns the workflow and passes a shared AgentState to every agent.

The first implementation intentionally keeps the agent interface simple:

```text
Agent.run(state) -> state
```

This gives us a stable contract. Later, LangGraph can replace the supervisor workflow
without requiring a rewrite of every specialist agent.
