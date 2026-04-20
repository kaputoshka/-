
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
API_HEALTH_URL = "http://localhost:8000/api/health"
UI_HEALTH_URL = "http://localhost:5173/api/health"
LOGIN_URL = "http://localhost:8000/api/auth/login"
SEED_URL = "http://localhost:8000/api/admin/seed"


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=ROOT_DIR, check=check)


def run_capture(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=ROOT_DIR, check=True, capture_output=True, text=True)


def ensure_docker_available() -> None:
    if shutil.which("docker") is None:
        print("Docker is not installed or not in PATH.", file=sys.stderr)
        print("Install Docker Desktop and retry.", file=sys.stderr)
        sys.exit(1)

    try:
        run_capture(["docker", "compose", "version"])
    except Exception:
        print("Docker Compose is not available. Update Docker Desktop.", file=sys.stderr)
        sys.exit(1)


def http_json(
    url: str,
    method: str = "GET",
    data: dict | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 3.0,
) -> dict:
    body = None
    req_headers = dict(headers or {})
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def wait_for_health(url: str, timeout_sec: int = 120) -> bool:
    started = time.time()
    while time.time() - started < timeout_sec:
        try:
            data = http_json(url, timeout=2.0)
            if data.get("status") == "ok":
                return True
        except Exception:
            pass
        time.sleep(2)
    return False


def seed_data() -> None:
    try:
        login = http_json(LOGIN_URL, method="POST", data={"username": "admin", "password": "admin"})
        token = login.get("access_token")
        if not token:
            print("Seed skipped: failed to get admin token.", file=sys.stderr)
            return
        res = http_json(SEED_URL, method="POST", headers={"Authorization": f"Bearer {token}"})
        print("Seed completed.")
        print(f"Users: {res.get('users')}")
    except urllib.error.HTTPError as exc:
        try:
            payload = exc.read().decode("utf-8")
        except Exception:
            payload = str(exc)
        print(f"Seed failed: HTTP {exc.code}: {payload}", file=sys.stderr)
    except Exception as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)


def start_stack(*, build: bool, seed: bool) -> None:
    cmd = ["docker", "compose", "up"]
    if build:
        cmd.append("--build")
    cmd.append("-d")
    run(cmd)

    print("Waiting for backend health...")
    if not wait_for_health(API_HEALTH_URL, timeout_sec=120):
        print("Backend did not become healthy in time.", file=sys.stderr)
        sys.exit(1)

    print("Waiting for UI health...")
    if not wait_for_health(UI_HEALTH_URL, timeout_sec=120):
        print("UI did not become healthy in time.", file=sys.stderr)
        sys.exit(1)

    if seed:
        seed_data()

    print("\nStack is ready:")
    print("UI:        http://localhost:5173")
    print("API docs:  http://localhost:8000/docs")
    print("Login:     admin / admin")


def down_stack(*, remove_volumes: bool) -> None:
    cmd = ["docker", "compose", "down"]
    if remove_volumes:
        cmd.append("-v")
    run(cmd)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start/stop the full car-sales-deals stack.")
    parser.add_argument("--no-build", action="store_true", help="Use docker compose up -d without --build.")
    parser.add_argument("--seed", action="store_true", help="Run /api/admin/seed after startup.")
    parser.add_argument("--down", action="store_true", help="Stop and remove containers.")
    parser.add_argument("--reset", action="store_true", help="docker compose down -v then start fresh.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_docker_available()

    if args.down and args.reset:
        print("Use either --down or --reset, not both.", file=sys.stderr)
        return 2

    if args.down:
        down_stack(remove_volumes=False)
        return 0

    if args.reset:
        down_stack(remove_volumes=True)
        start_stack(build=not args.no_build, seed=args.seed)
        return 0

    start_stack(build=not args.no_build, seed=args.seed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
