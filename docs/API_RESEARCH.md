# API research: real travel data for TripMate

**Purpose.** TripMate's plans use estimated prices today, and its exact-prices step returns sample data. This document lists the options for real data (flights, stays, trains, places, attractions, weather and currency) with the pros and cons of each, so the team can decide what to integrate.

**This is a menu, not a decision.** The person integrating the APIs makes the call. Where options combine well, they're grouped in [Combinations to consider](#9-combinations-to-consider), with trade-offs rather than a recommendation.

**Research date:** 8–9 October 2026. Prices, free tiers and access rules change often, and many figures below come from third-party summaries rather than the providers' own pages. **Confirm anything you rely on with the provider before building.** Each option is marked:

- ✅ **Verified**: checked in this research (sources at the end)
- ⚠️ **Partly verified**: some details unconfirmed or sources disagree
- ❓ **Not researched**: listed for completeness; check it yourself

---

## Contents

1. [How an API plugs into TripMate](#1-how-an-api-plugs-into-tripmate)
2. [What to weigh up](#2-what-to-weigh-up)
3. [Flights](#3-flights)
4. [Stays (hotels)](#4-stays-hotels)
5. [Trains (India)](#5-trains-india)
6. [Places and geocoding](#6-places-and-geocoding)
7. [Attractions and things to do](#7-attractions-and-things-to-do)
8. [Weather and currency (nice to have)](#8-weather-and-currency-nice-to-have)
9. [Combinations to consider](#9-combinations-to-consider)
10. [Questions to settle before building](#10-questions-to-settle-before-building)
11. [Sources](#11-sources)

---

## 1. How an API plugs into TripMate

The backend is built so that **no planner or page talks to a vendor directly**. Vendors sit behind small interfaces in `backend/app/providers/`:

```
backend/app/providers/
  base.py        interfaces: TransportPricer, StayPricer (more to add: places, attractions…)
  registry.py    picks the implementation named in .env (PRICING_PROVIDER=…)
  sample.py      development-only made-up prices — the reference implementation to copy
```

To add a vendor:

1. **Create** `providers/<vendor>.py` with a class that has `name`, `is_sample = False` and `async def quote(request) -> list[PriceQuote]`. It should call the vendor and **translate the response into our `PriceQuote` shape** (`kind`, `name`, `detail`, `price` in INR for the whole group).
2. **Register** it in `registry.py`, e.g. `_TRANSPORT["travelpayouts"] = TravelpayoutsTransportPricer`.
3. **Configure** it in `backend/.env`: `PRICING_PROVIDER=travelpayouts` plus any API keys. Never commit keys.
4. **Test** it against a saved sample response. Tests shouldn't call the real API.

What the app already does around a provider:

- **Inputs are ready.** Each request carries the destination, start/end dates, number of travelers and origin city (`PriceRequest` in `backend/app/schemas/pricing.py`). Rooms are derived as one per two travelers.
- **Failures are handled.** If a provider times out (20 seconds) or errors, the API returns `status: "unavailable"` and the website shows a clear message. Nothing breaks.
- **Plans stay estimates.** Only the separate exact-prices step uses providers, so a slow or rate-limited provider never blocks planning.

Gaps a real integration will need to fill:

- **City → code mapping.** Flight APIs want **IATA airport/city codes** (DEL, GOI), and hotel APIs often want a city ID or coordinates. TripMate only has city names today, so we need a lookup: a static airport list, a geocoding API, or the provider's own search.
- **Caching.** To protect free quotas and stay fast, cache identical requests for a while (minutes for live prices, hours or days for cached fares).
- **Currency.** Some providers quote in USD or EUR, so they need conversion to INR (see [section 8](#8-weather-and-currency-nice-to-have)).

## 2. What to weigh up

| Question | Why it matters |
|---|---|
| **Show prices, or let users book?** | The biggest fork. Booking brings payments, customer service, cancellations and stricter contracts. Price-only is far simpler. |
| **Self-serve or contract?** | Some APIs give you a key in minutes; others need a partnership agreement and an account manager first. |
| **India coverage** | Most trips are domestic. IndiGo carries about 57% of Indian domestic flyers, so a flight source without IndiGo is a big gap. |
| **Cost model** | Free tier, pay-per-call, per-booking fee, or commission/affiliate revenue. |
| **Commercial-use terms** | Several "free" tiers are **non-commercial only**. A public product needs commercial terms. |
| **Freshness** | Live prices vs cached prices from earlier searches. Both are useful at different steps. |
| **Terms-of-service risk** | Scraping-based APIs and unofficial wrappers can break or breach the source's terms. |
| **Effort** | SDKs, documentation quality, sandbox availability. |

---

## 3. Flights

> **Important context.** **Amadeus Self-Service**, the default "free flight API" in most tutorials, **was shut down on 17 July 2026**. Its keys were disabled and new developers can't sign up. Only Amadeus's enterprise contracts remain. ✅

| Option | Type | Access | Cost | Status |
|---|---|---|---|---|
| [Travelpayouts / Aviasales Data API](#travelpayouts--aviasales-data-api) | Cached prices (estimates) | Self-serve after partner sign-up | Free for partners | ⚠️ |
| [Duffel](#duffel) | Live, bookable offers | Self-serve; free test environment | ~$3 per booking + 1% on some fares | ⚠️ |
| [Amadeus Enterprise](#amadeus-enterprise) | Live, bookable | Contract | Negotiated | ✅ (self-serve gone) |
| [Kiwi.com Tequila](#kiwicom-tequila) | Search, booking | Reportedly partner-only since 2024 | Commercial agreement | ⚠️ |
| [SerpApi / Bright Data "Google Flights"](#serpapi--bright-data-google-flights) | Scraped Google Flights results | Self-serve | Paid plans; Bright Data has a small free tier | ⚠️ |
| Skyscanner partner API | Search | Partner programme | — | ❓ |

### Travelpayouts / Aviasales Data API
Prices come from a cache of what other Aviasales users searched in roughly the last 7 days.

**Pros**
- Free once you join the Travelpayouts partner programme. A token is available right after sign-up.
- Simple token in a header; fast responses.
- Good for "about ₹X" price trends and cheapest-date ideas.
- Earns affiliate commission if users click through to book.

**Cons**
- Not live prices: data can be days old, and routes nobody searched may have no data at all.
- Can't book through it.
- India coverage unconfirmed. Results are organised by "market", which defaults by origin, so check Indian routes return data.
- Has rate limits (documented separately by Travelpayouts).

**Fits TripMate as:** a `TransportPricer` for flights, or as better estimates in the planning step itself.

### Duffel
A modern self-serve API for searching and booking flights (300+ airlines) and stays.

**Pros**
- Live, bookable offers with official Python, Node and Ruby SDKs.
- Free test environment using a fictional airline ("Duffel Airways").
- Clear published pricing: about $3 per confirmed booking, 1% on "managed content", about $1–2 per paid extra. Searching is free up to a search-to-booking ratio (about 1,500:1), then $0.005 per search.
- Also covers stays, so one vendor could serve both.

**Cons**
- **Indian airline coverage unverified.** Confirm IndiGo, Air India and Akasa are available before committing; this decides it.
- Test-environment prices and schedules aren't realistic, so you can't judge real fares until you go live.
- Fees only make sense if users actually book; it's not ideal for price-only browsing at scale (see the search ratio).
- Booking means handling payments, passenger details and cancellations.

**Fits TripMate as:** a `TransportPricer` (and a `StayPricer` via Duffel Stays), plus a future booking flow.

### Amadeus Enterprise
**Pros:** broad global content from one of the main airline booking systems; enterprise reliability.
**Cons:** contract and commercial negotiation only; heavy for an early-stage project; no self-serve route since July 2026.

### Kiwi.com Tequila
**Pros:** historically strong for budget combinations across airlines; search and booking in one place.
**Cons:** a third-party source says public self-serve access closed in 2024 and new integrations go through a business partner channel (needs confirming); its SDKs are reportedly unmaintained.

### SerpApi / Bright Data "Google Flights"
These services scrape Google Flights results and return them as data.
**Pros:** Google's broad fare coverage, including Indian low-cost airlines; quick to start.
**Cons:** **scraping carries terms-of-service and reliability risk** for a product; paid plans (SerpApi's 2026 plan list changed several times, so check current pricing); results can change shape without notice; no booking.

---

## 4. Stays (hotels)

| Option | Type | Access | Cost | Status |
|---|---|---|---|---|
| [LiteAPI (Nuitée)](#liteapi-nuitée) | Live rates, bookable | Self-serve; free test environment | Core search and booking free; revenue from commission | ✅ |
| [Duffel Stays](#duffel-stays) | Live rates, bookable | Self-serve | Profit share on bookings | ⚠️ |
| [Booking.com Demand API](#bookingcom-demand-api) | Content, search, booking | **Contract** (Managed Affiliate Partner) | Affiliate commission | ⚠️ |
| [SerpApi "Google Hotels"](#serpapi-google-hotels) | Scraped Google Hotels results | Self-serve | Paid plans | ⚠️ |
| Expedia Rapid, Hotelbeds | Wholesale and affiliate supply | Partner programmes | — | ❓ |

### LiteAPI (Nuitée)
**Pros**
- Free test environment with no minimum volume. The core flow (search rates → hold → book) costs nothing; they earn through commission or markup.
- Over 2M properties worldwide, with SDKs in several languages.
- Search by city and country, which fits our `PriceRequest`.

**Cons**
- Extras cost money: their "Places" endpoints are about $0.01 per request and the price index about $0.05 per request.
- Going live needs a card on file and a funded wallet.
- India coverage and price accuracy unconfirmed. Run test searches for Goa, Manali and Jaipur.
- They expect a reasonable ratio of searches to bookings; heavy price-only browsing may conflict with their terms.

**Fits TripMate as:** a `StayPricer`.

### Duffel Stays
**Pros:** same vendor and SDK as Duffel flights; earns a profit share on bookings.
**Cons:** India hotel coverage unverified; mainly designed for booking, not browsing.

### Booking.com Demand API
**Pros:** huge inventory and strong India presence; trusted brand; affiliate commission.
**Cons:**
- **No open sign-up.** Booking's own docs require being a Managed Affiliate Partner with a signed contract and an account manager before you get keys. Booking from the app needs separate approval.
- A third-party guide reports restrictions on AI systems without written approval (unverified against Booking's own terms; ask your account manager).
- No published price list or rate limits.

### SerpApi "Google Hotels"
**Pros:** broad coverage including Indian properties; quick to start.
**Cons:** the same scraping risks as SerpApi for flights; paid; no booking.

---

## 5. Trains (India)

Trains matter a lot for Indian domestic trips, but **there's no official public IRCTC API**. ✅

| Option | Notes | Status |
|---|---|---|
| [Unofficial wrappers](#unofficial-wrappers) (e.g. RapidAPI "IRCTC" listings, indianrailapi.com, parse.bot) | Trains between stations, fares and seat availability | ⚠️ |
| [B2B booking agents](#b2b-booking-agents) (e.g. AOPAY, ZuelPay) | Search, availability and booking for travel businesses | ⚠️ |
| [Keep estimates](#keep-estimates) | TripMate's current behaviour | ✅ |

### Unofficial wrappers
**Pros:** cheap or free to start; cover what we'd show (trains, fares, availability).
**Cons:** not affiliated with IRCTC; **can break without notice**; some scrape public enquiry sites, which may breach their terms; one RapidAPI listing calls itself "official" but this couldn't be confirmed.

### B2B booking agents
**Pros:** built for travel businesses; some claim a direct link to IRCTC's booking system; support booking.
**Cons:** aimed at registered businesses, so they need onboarding and contracts; pricing not public.

### Keep estimates
**Pros:** no risk, no cost; the plan already estimates train or bus costs.
**Cons:** not exact; no seat availability.

---

## 6. Places and geocoding

Geocoding turns "Manali" into coordinates, a country and an ID that other APIs understand. Autocomplete would also help the "Travelling from" field.

| Option | Free allowance | Paid | Status |
|---|---|---|---|
| [Geoapify](#geoapify) | 3,000 credits/day (1 credit per simple call) | From $59/month for 10,000/day | ✅ |
| [Google Places API (New)](#google-places-api-new) | Per type of request each month: ~10,000 basic, ~5,000 "Pro", ~1,000 "Enterprise" | ~$5–40 per 1,000 calls depending on type | ⚠️ |
| [Foursquare Places](#foursquare-places) | Free allowance; sources disagree on size | Pay as you go (~$15 per 1,000 "Pro" calls reported) | ⚠️ |
| OpenStreetMap Nominatim | Free public server with a strict usage policy | Self-host | ❓ |

### Geoapify
**Pros:** generous free tier; one key covers geocoding, places, routing and more; simple REST.
**Cons:** the free plan allows only **limited commercial use** with best-effort support; built on OpenStreetMap data, so it's less rich than Google for businesses.

### Google Places API (New)
**Pros:** the most complete and up-to-date place data, including Indian businesses; excellent autocomplete.
**Cons:** costs climb quickly beyond the free amounts. Since March 2025 each type of request has its own monthly free allowance (the old $200 credit is gone). Rich fields like ratings and photos are in the dearer tiers. Display and attribution rules apply.

### Foursquare Places
**Pros:** good restaurant and venue data; pay-as-you-go.
**Cons:** sources disagree on the free allowance (500 vs 10,000 calls a month); photos and tips cost more; pricing reportedly changed 1 June 2026, so check the current page.

---

## 7. Attractions and things to do

Today the "Things to do" section uses generic names ("Local viewpoint / landmark"). These options give real ones.

| Option | Cost | Status |
|---|---|---|
| [OpenTripMap](#opentripmap) | Free, openly licensed (ODbL) data | ⚠️ (current rate limits unconfirmed) |
| Google Places / Foursquare | See [section 6](#6-places-and-geocoding) | ⚠️ |

### OpenTripMap
**Pros:** over 10 million attractions built from OpenStreetMap, Wikidata and Wikipedia; the licence allows **storing and reusing** the data; well suited to "top sights near X".
**Cons:** current rate limits and terms not confirmed; descriptions and photos vary in quality by place; needs coordinates first (from geocoding).

---

## 8. Weather and currency (nice to have)

| Option | Notes | Status |
|---|---|---|
| **Open-Meteo** (weather) | No key needed. **Free only for non-commercial use** (under 10,000 calls a day). Commercial plans start around $29/month. Data is CC-BY 4.0. | ✅ |
| **Frankfurter** (exchange rates) | A free, open-source API for official exchange rates; useful if a provider quotes in USD or EUR. | ❓ |

---

## 9. Combinations to consider

These are starting points to compare, not recommendations.

| Combination | Pieces | Good for | Trade-offs |
|---|---|---|---|
| **A. Price-only, lowest cost** | Travelpayouts (flights) + LiteAPI (stays) + Geoapify (places) + OpenTripMap (attractions) | Real numbers quickly with free tiers; no booking or payments | Flight prices are cached, not live; check India coverage; free tiers limit commercial use |
| **B. One vendor, bookable** | Duffel flights + Duffel Stays (+ Geoapify, OpenTripMap) | A future "book this trip" button; one SDK and contract | Indian airline coverage unverified; per-booking fees; payments and cancellations to handle |
| **C. Best data quality** | A flight source of choice + LiteAPI + Google Places | The richest place data and autocomplete | Google costs grow with traffic; billing account needed |
| **D. Big-brand stays** | Booking.com Demand + a flight source | Trusted hotel brand, strong in India | Contract and approval first; AI-use terms to clarify |

All combinations can keep **trains on estimates** until a trustworthy source exists.

## 10. Questions to settle before building

1. **Prices only, or booking too?** (This decides between combinations A and B.)
2. **Is IndiGo available** in the chosen flight source? Run real test searches: DEL→GOI, BOM→IXL, BLR→JAI.
3. **Which test environments return realistic Indian results?** Run 3–5 sample trips through each shortlisted API.
4. **Commercial terms:** which free tiers allow a public, commercial product?
5. **Monthly cost at expected traffic:** e.g. 1,000 trips planned and 200 exact-price checks a month.
6. **Who owns the API accounts and keys?** Use a shared team account, not a personal one.
7. **How long can prices be cached** under each provider's terms?

## 11. Sources

**Amadeus shutdown**
- [PhocusWire: Amadeus to shut down self-service APIs portal](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers)
- [GitHub issue quoting the Amadeus decommission notice](https://github.com/abhinavmathur-atlan/mcp-travel-assistant/issues/4)
- [AirLabs: Amadeus Self-Service shutdown](https://airlabs.co/amadeus-self-service-api-shutdown)
- [Tripgic: Amadeus Self-Service alternatives 2026](https://www.tripgic.com/playbook/amadeus-self-service-api-alternatives/)
- [Tripgic: Free travel APIs in 2026](https://www.tripgic.com/playbook/free-travel-api/)

**Flights**
- [Duffel changelog](https://changelog.duffel.com/)
- [Thunderbit: Best flight APIs in 2026](https://thunderbit.com/blog/best-flight-api-with-free-tiers)
- [API Evangelist: Duffel profile](https://github.com/api-evangelist/duffel)
- [Travelpayouts: Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163)
- [Vervotech: Tequila API by Kiwi.com](https://www.vervotech.com/hub/integrations/tequila-api/)
- [Supergood: Kiwi API report card](https://supergood.ai/api-report-card/kiwi)
- [CostBench: SerpApi pricing changes 2026](https://costbench.com/changelog/serpapi-search-plan-added-2026-09/)
- [Bright Data: Google Flights API](https://brightdata.com/products/serp-api/google-search/flights)
- [AirInsight: IndiGo's domestic share](https://airinsight.com/indias-airlines-indigo-soars-rivals-in-turbulence/)

**Stays**
- [LiteAPI: pricing and usage costs](https://docs.liteapi.travel/reference/api-pricing-usage-costs)
- [LiteAPI: FAQ](https://docs.liteapi.travel/docs/faq)
- [LiteAPI homepage](https://liteapi.travel/)
- [Booking.com Demand API: prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites)
- [Vorp Labs: Booking Demand API guide](https://vorplabs.com/agent-tools/booking-demand-api)

**Trains**
- [Indian Railways MCP server (unofficial sources)](https://github.com/RishiMaddheshiya/indian_railway_mcp-server)
- [Indian Rail API: seat availability](https://indianrailapi.com/api-collection/seat-availability-in-trains)
- [AOPAY Train Booking API](https://aopay.in/train-api)
- [ZuelPay Train Booking API](https://zuelpay.in/Train_Booking_API)

**Places, attractions, weather**
- [Woosmap: Google Places API pricing 2026](https://www.woosmap.com/blog/google-places-api-pricing)
- [Geoapify pricing](https://geoapify.com/pricing)
- [PricingSaaS: Foursquare pricing](https://pricingsaas.com/companies/foursquare)
- [OpenTripMap API](https://dev.opentripmap.com)
- [Open-Meteo terms](https://open-meteo.com/en/terms)
- [Open-Meteo: API subscriptions for commercial use](https://openmeteo.substack.com/p/api-subscriptions-for-commercial)
