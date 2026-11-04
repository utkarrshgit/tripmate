# TripMate demo

A walkthrough for showing TripMate, in about 10 minutes. It works in two modes:

| Mode | Start with | What plans | Good for |
|---|---|---|---|
| **Real AI models** | `./run.sh --real` | gemma4:e2b-mlx, tev1:0.8b and qwen3-embedding:0.6b through Ollama, on this computer | Showing the local AI at work. A plan takes 10–25 seconds; a repeated one is instant |
| **Mock data** | `./run.sh --mock` | Rules and TripMate's guide of 12 destinations and 82 places | A fast, predictable demo with no AI needed. Every feature still works |

`./run.sh` on its own asks which mode. Real mode checks for Ollama and the three models first, and asks before downloading anything (Ollama is about 200 MB; the models about 9 GB). If you say no, or something's missing, it runs in mock mode instead.

**Ctrl+C stops everything** the script started: the API, the website and, in real mode, it unloads the models from memory (and stops Ollama if the script started it). `./run.sh stop` cleans up after a run that didn't exit cleanly.

## Before you start

- PostgreSQL is running (`brew services start postgresql@18`).
- For real mode: Ollama is installed, and you've run one plan before the audience arrives, so the model is loaded.
- Each start resets the demo account: **demo@tripmate.local / trip-demo-2026**. It's an admin, with three saved trips (Christmas in Goa, Manali with friends and Hampi), and the Goa one already has a second version.

## The walkthrough

1. **Home.** One sentence is all it takes. Select **Plan a trip**.
2. **Plan a festival trip.** Type: `Christmas in Goa, 24–27 Dec, for 2 people under ₹45,000, beaches and nightlife`.
   - Real mode: watch each planner report as it works ("Read your request · Goa · 4 days · 2 people · with AI").
3. **Read the plan.**
   - **Your days** come from real Goa places.
   - Open **Where the money goes › How we estimated this**: December is peak season, Christmas week adds about 45% to rooms, and weekends add more.
   - At the bottom, the plan says which models helped, or that rules did.
4. **Same trip, different month.** Plan `4 days in Goa 13–16 Jul for 2 people, beaches and food`. The monsoon makes stays less than half the price. That's the calendar at work.
5. **Save it.** Select **Log in** with the demo account, then **Save trip**.
6. **Change it in words.** On the saved trip, type `drop Anjuna Flea Market`, then `swap Palolem Beach for Dudhsagar Falls trip`.
   - Each one becomes a new version, with what changed listed and an **Undo** button.
   - Real mode: try `make day 2 more relaxed`. The model decides what to lighten.
7. **Versions.** Scroll to **Versions**, and restore an earlier one. Nothing is ever lost.
8. **Edit days, Share.**
   - **Edit days:** change one plan by hand, and the total follows.
   - **Share:** make a read-only link, and open it in a private window. It works without an account and never shows your email.
9. **Search.** On **Your trips**, search for `somewhere with sea and sand`.
   - Real mode: Goa comes first by meaning, though no word matches.
   - Mock mode searches by words, so try `goa`.
10. **Similar places.** A saved trip ends with **If you like …**: destinations with a similar feel.
11. **AI activity.** In the account menu, **AI activity** shows every run and model call: success rate, typical and slowest times, and tokens.
12. **It degrades gracefully.** In real mode, quit Ollama and plan again. The plan still comes back, using rules, and it says so.

## Prompts to try

Each prompt shows something specific. In mock mode, the follow-up commands are known to work on the plan the prompt makes; a test checks them (`tests/test_demo.py`).

| Type this | Notice | Then, on the saved trip, Change it in words |
|---|---|---|
| Christmas in Goa, 24–27 Dec, for 2 people under ₹45,000, beaches and nightlife | Festival pricing: rooms about 45% more over Christmas | `drop Anjuna Flea Market` · `swap Palolem Beach for Dudhsagar Falls trip` |
| 4 days in Goa 13–16 Jul for 2 people, beaches and food | Monsoon: stays cost less than half of Christmas week | `drop Fort Aguada` · `swap Palolem Beach for the Basilica of Bom Jesus` |
| 5 days in Manali 10–14 Oct for me and my 2 friends, trekking and mountains | "Me and my 2 friends" is 3 people: one room plus an extra bed | `swap the hot springs for Mall Road` · `drop Solang Valley` |
| Jaipur 22–24 Jan with my wife, history and shopping | Two weekend nights push room prices up | `swap the bazaars for the Hawa Mahal` · `drop the City Palace` |
| 6 days in Andaman 9–14 Mar for 2 people, beaches and adventure | No train or road to the islands: flights only | `drop the scuba dive` · `swap Ross Island for Radhanagar Beach, Havelock` |
| 3 days in Hampi 18–20 Jan for 2 people, history and photography | A small-budget trip with places to eat from the guide | `drop the coracle ride` · `drop Lotus Mahal` |

**With the real models:**

- `weekend in hampi with my wife, love history and photography, budget 15k`: "weekend" becomes 2 days, "15k" becomes ₹15,000, and gemma4 chooses and orders the places.
- `write me a poem about cats`: tev1 flags that it isn't a trip request.
- On a saved trip: `make day 2 more relaxed`, or `swap the market for something outdoors`.

## How the prices are worked out

Estimates, not live fares. Each destination has typical 2026 rates for a return train or bus, a return flight, a budget and a comfort room, local travel and meals. The dates then adjust them:

| When | Effect |
|---|---|
| The destination's peak months | Rooms +20%, flights +15% |
| Off season | Rooms −20%, flights −10% |
| Christmas to New Year | Rooms +45%, flights +30% |
| Diwali or Holi week | Rooms +25%, flights +25% |
| Friday and Saturday nights | Rooms +15% |
| Booked under 2 weeks ahead | Flights +30% (under a month +15%; 2+ months −5%) |
| 4 or more people | Local travel −20% each (shared cabs) |

Two people share a room, and a third takes an extra bed. The plan lists every adjustment it made under **How we estimated this**. The rates are in `backend/app/pricing/heuristics.py`.

## Repeated lookups are instant

A small in-memory cache (`backend/app/core/cache.py`) keeps:

- **Model answers:** the same question to the same model, for 30 minutes.
- **Embeddings:** each text's vector, for 6 hours.
- **Catalog lookups:** for 5 minutes.

The same plan or search a second time takes about a second instead of 20. `/health` shows hit rates, and reloading the catalog clears its cache.

## If something goes wrong

| Problem | Fix |
|---|---|
| "PostgreSQL isn't running" | `brew services start postgresql@18`, then start again. The planner works without it; accounts and saved trips don't |
| A plan takes over 30 seconds in real mode | The model is loading for the first time. Plan once before the demo |
| Real mode switched to mock | The script couldn't use Ollama or a model. Its message says why; `./run.sh --real` asks again |
| Something's still running after a crash | `./run.sh stop` |
