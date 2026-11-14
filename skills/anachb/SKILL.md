---
name: anachb
description: Build AnachB route links and check travel times in Austria for cycling, driving, public transport and walking. Use for directions, travel-time estimates, Rad AnachB or VAO routing questions.
---

# AnachB

## Direct links

URL-encode each full address, including city and preferably postcode.

**Cycling (Rad AnachB):**
```text
https://rad.anachb.at/webapp/index.html?L=vs_its&P=BikeRouter&S=START&Z=DESTINATION&start=1
```

**Public transport, car, cycling and walking:**
```text
https://anachb.vor.at/?P=TP&S=START&Z=DESTINATION&start=1
```

`S` = start, `Z` = destination, `start=1` = calculate immediately. The general planner provides mode tabs; do not promise a car-specific deep link. Both URL patterns were browser-tested on 2026-11-14. No API account is needed.

## Script: travel time + map link

Run relative to this skill directory (Python 3.9+, standard library only):
```sh
python3 scripts/anachb.py 'START ADDRESS, POSTCODE CITY' 'DESTINATION ADDRESS, POSTCODE CITY' --mode bike
```
Modes: `bike` (default), `car`, `transit`, `walk`. JSON output includes resolved addresses, durations in minutes, distances in metres when supplied, transit lines and a clickable planner URL. Departure is now, in Europe/Vienna; returned HAFAS times are local `HHMMSS` (hours may exceed 23 for the following day).

The script refuses ambiguous/nonmatching addresses, reports request errors and deduplicates identical routes. Check resolved names before recommending the journey. No login, cookies or persistent credentials: public web-client configuration is fetched each run, kept in memory and never printed. Do not log raw payloads or configuration. Four modes were live-checked on 2026-11-14; these are undocumented web interfaces, not a supported API contract. Keep requests low-volume; on failure, use the web link rather than retrying repeatedly or bypassing restrictions.

## Workflow

- Ask for the origin if unknown; never assume a home address.
- Return a clickable AnachB link. If asked to open it, use the Safari skill; follow its focus-protection rules.
- Use the script for current travel times. Use the browser for other departure/arrival times, options, or verification after a mismatch. A generated link alone is not a verified estimate.
- For cycling, prefer Rad AnachB's Alltagsrad profile. The general planner can choose a different route; label results by planner/profile.
- Report parking/walking allowances when shown for car routes. Time estimates depend on departure time and conditions.
- Keep private addresses and concrete journey records out of this skill and Git. Do not substitute a Google Maps route for an AnachB map.

## API caveat

Official REST access: [VAO Start](https://www.verkehrsauskunft.at/start), limited free access by signed application.

Do not substitute the community OpenClaw skill's `vao.demo.hafas.de/gate`: it returned a different cycling route. This script uses the observed web endpoints: `rad.anachb.at/hamm/radrouter/gate` (Alltagsrad, bike-route preference, 15 km/h) and `anachb.vor.at/hamm/gate/` (other modes). General-planner links open mode tabs, not necessarily the mode queried by the script.
