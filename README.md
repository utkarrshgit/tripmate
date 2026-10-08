# TripMate

**Describe a trip in one sentence and get back a day-by-day plan with the costs worked out.**

> *"5 days in Manali, 12–16 Dec, under ₹30,000 for 3 people, nature and adventure"*

From that one line, TripMate works out where you're going, when, for how long, with how many people and on what budget. It then builds an itinerary and a cost breakdown, and shows whether the trip fits your budget.

> **Getting it running:** `./run.sh` sets up and starts everything. See [SETUP.md](SETUP.md) for details.

---

## What it does

- **Understands plain language.** You type a request the way you'd say it. TripMate picks out the destination, travel dates, group size, budget and interests. As you type, the form shows what it has understood and what's still missing.
- **Plans the whole trip.** You get a day-by-day itinerary with morning, afternoon and evening plans, a cost breakdown (travel, stays, food, activities), and options for getting there and where to stay.
- **Shows the numbers.** The total cost is compared against your budget, with cost per day and per person.
- **Estimates first, exact prices on request.** Every plan uses **estimated** prices so you can shape the trip quickly. When the trip looks right, **Get exact prices** checks real fares and rooms for your dates and compares them with the estimate.
- **Shows the AI at work.** While a trip is being planned, animated indicators show which planner is working and what it's doing.
- **Saves trips.** Create an account to save plans, along with any exact-price checks, and come back to them later.

## How it works

A request goes through **nine specialist planners**, one after another. Each one handles a single part of the trip and passes what it learns to the next:

```
Request reader → Destination → Transport → Stays → Activities → Food → Budget → Itinerary → Final review
```

| Planner | What it does |
|---|---|
| Request reader | Picks out destination, dates, group size, budget and interests |
| Destination | Sizes up what the place is best for |
| Transport | Estimates getting there and back |
| Stays | Works out rooms for the group and prices nights |
| Activities | Picks things to do around your interests |
| Food | Budgets daily meals |
| Budget | Adds it all up and checks it against your limit |
| Itinerary | Lays out each day |
| Final review | Flags anything that needs your attention |

**Estimates vs exact prices.** Planning always produces estimates. Exact pricing is a separate step that asks a pricing provider for real quotes. The providers are swappable: the app can use a *sample* provider for development (clearly labelled made-up prices), or run with exact pricing switched off. Real flight and hotel data sources are still being chosen. See [docs/API_RESEARCH.md](docs/API_RESEARCH.md).

## Where things stand

TripMate is an early-stage project. Today:

| Area | Status |
|---|---|
| Planning from a sentence (with dates) | ✅ Working |
| Itinerary, cost breakdown, budget check | ✅ Working, using **estimated** prices |
| Exact prices step | ✅ Flow works, but uses **sample prices** until real providers are connected |
| Real flight / hotel / place data | 🔍 Being evaluated ([API research](docs/API_RESEARCH.md)) |
| Accounts and saved trips | ⚠️ Saved **in the browser only** for now (no server-side accounts yet) |
| AI language model in the planners | ⚠️ Planners use fixed rules today; a local model (Ollama) is wired in but not used yet |
| Privacy Policy and Terms | ⚠️ Drafts with placeholders, pending legal review |
| Photos | ⚠️ Image slots are in place; photos to be added |

## What it's built with

| Part | Technology |
|---|---|
| Website | React 19 and Vite, styled from a Pinterest-inspired design system ([DESIGN.md](DESIGN.md)) |
| API and planners | Python with FastAPI; one agent class per planner |
| AI activity indicators | [Thinking Orbs](https://thinkingorbs.com) |
| Optional language model | [Ollama](https://ollama.com) (local) |

## What's in this repository

```
backend/     The API and the nine planners (Python / FastAPI)
  app/agents/      one file per planner, plus the supervisor that runs them in order
  app/providers/   pluggable data sources (pricing today; more to come)
frontend/    The website (React) — see frontend/README.md for how it's organised
tests/       Automated tests for the backend
docs/        Architecture notes and API research
DESIGN.md    The visual design system the website follows
SETUP.md     How to run it on your own machine
run.sh       One command to set up and start everything
```

## Further reading

- [SETUP.md](SETUP.md): run TripMate on your laptop
- [docs/API_RESEARCH.md](docs/API_RESEARCH.md): options for real flight, hotel and place data
- [docs/architecture.md](docs/architecture.md): how the planners share work
- [frontend/README.md](frontend/README.md): how the website code is organised
- [DESIGN.md](DESIGN.md): the design system

## What's next

1. Connect real data for flights, stays and places (choices in [API research](docs/API_RESEARCH.md))
2. Server-side accounts and saved trips (a database)
3. Use the language model inside the planners, with knowledge of each destination
4. Maps and route planning between activities
5. A review step that can send a plan back for another pass when something's off
6. Automated testing and deployment
