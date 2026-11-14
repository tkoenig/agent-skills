#!/usr/bin/env python3
"""Query the public AnachB web planners without browser/session storage."""

import argparse
from datetime import datetime
import json
import re
import sys
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

VIENNA = ZoneInfo("Europe/Vienna")
GENERAL = "https://anachb.vor.at/"
RAD = "https://rad.anachb.at/"


def fetch(url, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {"User-Agent": "anachb-skill/1.0", "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    with urlopen(Request(url, data=data, headers=headers), timeout=30) as response:
        return response.read().decode()


class Planner:
    def __init__(self, mode):
        self.mode = mode
        if mode == "bike":
            config = fetch(RAD + "webapp/customer/vs_its/js/hafas_webapp_config.js")
            match = re.search(
                r"config\.hciAuth\s*=\s*\{.*?aid:\s*['\"]([^'\"]+)",
                config, re.S,
            )
            if not match:
                raise ValueError("Rad AnachB configuration changed: cannot find client AID")
            self.endpoint = RAD + "hamm/radrouter/gate"
            self.base = {
                "ver": "1.20", "ext": "VAO.21", "lang": "deu",
                "auth": {"type": "AID", "aid": match.group(1)},
                "client": {"id": "VAO", "type": "WEB", "name": "radrouter",
                           "l": "vs_radrouter_its"},
            }
        else:
            config = json.loads(fetch(GENERAL + "webcomponent/config/webapp.config.json"))
            # Never follow a changed configuration to an arbitrary credential recipient.
            if config.get("hciEndpoint") != GENERAL + "hamm/gate/":
                raise ValueError("AnachB endpoint changed; review configuration first")
            self.endpoint = config["hciEndpoint"]
            self.base = {
                "ver": "1.96", "lang": "deu",
                "auth": {**config["hciAuth"], "type": "AID"},
                "client": {"id": "HAFAS", "type": "WEB",
                           "name": "Routenplaner VOR AnachB", "l": "vs_anachb"},
            }

    def call(self, method, request):
        payload = {**self.base, "svcReqL": [{"meth": method, "req": request, "id": "0"}]}
        result = json.loads(fetch(self.endpoint, payload))
        if result.get("err") != "OK":
            raise ValueError(f"AnachB request failed ({result.get('err', 'missing status')})")
        services = result.get("svcResL", [])
        if len(services) != 1 or services[0].get("err") != "OK":
            code = services[0].get("err") if services else "no result"
            raise ValueError(f"AnachB {method} failed ({code})")
        return services[0]["res"]

    def location(self, query):
        if not tokens(query):
            raise ValueError("Address must not be empty")
        result = self.call("LocMatch", {
            "input": {"loc": {"name": query, "type": "A"}, "field": "S"},
        })
        candidates = result.get("match", {}).get("locL", [])
        wanted = tokens(query)
        matches = {}
        for loc in candidates:
            if loc.get("type") != "A" or not loc.get("crd"):
                continue
            if wanted <= tokens(loc.get("name", "")):
                crd = loc["crd"]
                matches.setdefault((crd["x"], crd["y"]), loc)
        if len(matches) != 1:
            names = "; ".join(loc.get("name", "?") for loc in candidates[:5])
            raise ValueError(
                f"Address not uniquely resolved: {query!r}. "
                f"Use street, house number, postcode and city. Candidates: {names or 'none'}"
            )
        loc = next(iter(matches.values()))
        return {key: loc[key] for key in ("type", "name", "lid", "crd") if key in loc}

    def routes(self, origin, destination, when):
        group = {"bike": "RQ_NORMALBIKE", "car": "CAR",
                 "transit": "OEV", "walk": "WALK"}[self.mode]
        filters = [{"type": "GROUP", "mode": "INC", "value": group}]
        request = {
            "depLocL": [origin], "arrLocL": [destination],
            "outFrwd": True, "outDate": when.strftime("%Y%m%d"),
            "outTime": when.strftime("%H%M%S"),
            "getPasslist": True, "getPolyline": False, "jnyFltrL": filters,
        }
        if self.mode == "bike":
            request.update({
                "getIV": True, "getConGroups": True,
                "gisFltrL": [
                    {"type": "M", "mode": "T", "meta": "bike_preferbikeroute"},
                    {"type": "M", "mode": "T", "meta": "bike_speed_15"},
                ],
            })
            filters.append({"type": "PROD", "mode": "INC", "value": 4087})
        elif self.mode == "car":
            filters.append({"type": "META", "mode": "INC", "value": "disable_ecar"})
        result = self.call("TripSearch", request)
        routes, seen = [], set()
        products = result.get("common", {}).get("prodL", [])
        for connection in result.get("outConL", []):
            sections = connection.get("secL", [])
            modes = [section.get("type") for section in sections]
            expected = {"bike": {"BIKE"}, "car": {"KISS", "CAR"},
                        "transit": {"JNY"}, "walk": {"WALK"}}[self.mode]
            if not expected.intersection(modes):
                raise ValueError("Unexpected transport mode in AnachB result")
            lines = []
            for section in sections:
                index = section.get("jny", {}).get("prodX")
                if isinstance(index, int) and 0 <= index < len(products):
                    lines.append(products[index].get("name"))
            route = {
                "date": connection.get("date"),
                "departure": connection.get("dep", {}).get("dTimeS"),
                "arrival": connection.get("arr", {}).get("aTimeS"),
                "duration_minutes": duration_minutes(connection.get("dur")),
                "distance_metres": connection.get("dist"),
                "changes": connection.get("chg", 0),
                "lines": lines,
            }
            key = json.dumps(route, sort_keys=True)
            if key not in seen:
                seen.add(key)
                routes.append(route)
        if not routes:
            raise ValueError("No routes returned")
        return routes


def tokens(value):
    value = unicodedata.normalize("NFKC", value).casefold()
    return set(re.findall(r"\w+", value))


def duration_minutes(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{6}", value):
        raise ValueError("Missing or unexpected duration format")
    return round(int(value[:2]) * 60 + int(value[2:4]) + int(value[4:]) / 60, 2)


def route_url(mode, origin, destination):
    params = {"P": "BikeRouter" if mode == "bike" else "TP",
              "S": origin, "Z": destination, "start": "1"}
    if mode == "bike":
        params = {"L": "vs_its", **params}
    base = RAD + "webapp/index.html" if mode == "bike" else GENERAL
    return base + "?" + urlencode(params)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("origin", help="Full start address")
    parser.add_argument("destination", help="Full destination address")
    parser.add_argument("--mode", choices=("bike", "car", "transit", "walk"), default="bike")
    args = parser.parse_args()
    try:
        when = datetime.now(VIENNA)
        planner = Planner(args.mode)
        origin = planner.location(args.origin)
        destination = planner.location(args.destination)
        result = {
            "planner": "Rad AnachB" if args.mode == "bike" else "VOR AnachB",
            "profile": "Alltagsrad, prefer bike routes, 15 km/h" if args.mode == "bike" else args.mode,
            "origin": origin["name"], "destination": destination["name"],
            "queried_at": datetime.now(VIENNA).isoformat(timespec="seconds"),
            "time_basis": "departure",
            "requested_time": when.isoformat(timespec="seconds"),
            "routes": planner.routes(origin, destination, when),
            "url": route_url(args.mode, origin["name"], destination["name"]),
            "notes": ["Undocumented web interface; no availability guarantee."],
        }
        if args.mode != "bike":
            result["notes"].append("The general-planner link offers mode tabs; select the requested mode.")
        if args.mode == "car":
            result["notes"].append("Duration may include parking/walking allowances, as in the web planner.")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, KeyError, TypeError, HTTPError, URLError, TimeoutError) as error:
        # Do not print raw responses, request payloads, public client AIDs or headers.
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
