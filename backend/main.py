from __future__ import annotations

import contextlib
import logging
import math
import os
import time
from pathlib import Path
from typing import Any, Literal

import psycopg
from dotenv import load_dotenv
from psycopg.types.json import Jsonb
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Local runs read backend/.env; deployments (Render) supply the real environment,
# which always wins because load_dotenv never overrides variables already set.
load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://aram:aram-local-only@localhost:5432/aram",
)
# Comma-separated so production can list the Vercel domain alongside localhost.
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
ALLOWED_ORIGINS = [origin.strip() for origin in FRONTEND_ORIGIN.split(",") if origin.strip()]
# Vercel preview deployments get a fresh subdomain per push, so match them by pattern.
PREVIEW_ORIGIN_REGEX = os.getenv("FRONTEND_ORIGIN_REGEX") or None
FACE_MATCH_THRESHOLD = 0.6

# Anything slower than this is logged at WARNING so it stands out in the Render log.
SLOW_REQUEST_MS = 2000.0
# Wall-clock at import. A request arriving when this process is only a few seconds old
# was served by a container that had just booted — i.e. a cold start, which on Render's
# free plan happens after ~15 minutes of no traffic and costs the caller 30-60 seconds.
PROCESS_STARTED_AT = time.time()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("aram.api")


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    """Marks the boot in the Render log, so a cold start shows up as an event rather
    than having to be inferred from a gap in the timestamps."""
    logger.info("ARAM API started (cold start) - pid %s", os.getpid())
    yield


app = FastAPI(title="ARAM API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=PREVIEW_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    # Without this the browser hides Server-Timing from the page's own scripts, so the
    # client-side log below could only ever measure the round trip, never the split.
    expose_headers=["Server-Timing"],
)


@app.middleware("http")
async def record_timing(request: Request, call_next):
    """Times every request and hands the number back to the browser.

    `Server-Timing` is rendered natively by Chrome DevTools (Network > Timing), so this
    turns "the app feels slow" into a server-vs-network split with nothing to install.
    `uptime` is the useful one for this deployment: if it reads a few seconds while the
    request was slow, the container had just cold-started and the code is not at fault.
    """
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    uptime_s = time.time() - PROCESS_STARTED_AT

    response.headers["Server-Timing"] = (
        f'app;dur={elapsed_ms:.1f};desc="handler", uptime;dur={uptime_s * 1000:.0f};desc="process age"'
    )
    # Cross-origin callers (Vercel -> Render) only get detailed Resource Timing, and a
    # readable Server-Timing in DevTools, when the server allows it.
    response.headers["Timing-Allow-Origin"] = "*"

    line = "%s %s -> %s in %.0fms (uptime %.0fs)"
    args = (request.method, request.url.path, response.status_code, elapsed_ms, uptime_s)
    if elapsed_ms >= SLOW_REQUEST_MS:
        logger.warning(line + " SLOW", *args)
    else:
        logger.info(line, *args)
    return response


Role = Literal["parent", "headmaster", "counsellor", "admin"]


class StudentCreate(BaseModel):
    emis: str = ""
    language: str = Field(pattern=r"^(en|hi|ta|te|ml)$")
    nickname: str = Field(min_length=1, max_length=80)
    age_group: str = Field(min_length=1, max_length=20)
    pin: str = Field(pattern=r"^\d{4}$")


class ConsentInput(BaseModel):
    parent_consent: bool
    child_assent: bool
    camera_opt_in: bool
    voice_opt_in: bool


class PinInput(BaseModel):
    pin: str = Field(pattern=r"^\d{4}$")


class FaceInput(BaseModel):
    descriptor: list[float] = Field(min_length=128, max_length=128)


class ChildPinLogin(BaseModel):
    nickname: str = Field(min_length=1, max_length=80)
    pin: str = Field(pattern=r"^\d{4}$")
    emis: str = ""


class ChildFaceLogin(BaseModel):
    descriptor: list[float] = Field(min_length=128, max_length=128)
    emis: str = ""


class ClusterFlagItem(BaseModel):
    """One confirmed basket item. `issue_id` is the CANONICAL taxonomy id, so a
    cross-listed item cannot produce two rows; `entry_sub_id` records where the
    child actually tapped it, for browse-path analysis only."""

    issue_id: str = Field(min_length=1, max_length=64)
    cluster_id: str = Field(min_length=1, max_length=64)
    sub_id: str = Field(min_length=1, max_length=64)
    entry_sub_id: str | None = Field(default=None, max_length=64)
    feeling_tags: list[str] = Field(default_factory=list, max_length=20)
    flag: Literal["amber", "red"] | None = None
    free_text: str | None = Field(default=None, max_length=2000)
    priority_rank: int = Field(ge=1, le=10)


class ClusterSelection(BaseModel):
    items: list[ClusterFlagItem] = Field(min_length=1, max_length=10)


class SafeguardFlagInput(BaseModel):
    issue_id: str = Field(min_length=1, max_length=64)
    severity: Literal["amber", "red"]
    cluster_id: str | None = Field(default=None, max_length=64)
    sub_id: str | None = Field(default=None, max_length=64)


class StaffCreate(BaseModel):
    role: Role
    display_name: str = Field(min_length=1, max_length=120)
    language: str = Field(pattern=r"^(en|hi|ta|te|ml)$")
    face_descriptor: list[float] = Field(min_length=128, max_length=128)


class AdminLogin(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)


def db() -> psycopg.Connection[Any]:
    try:
        return psycopg.connect(DATABASE_URL)
    except psycopg.Error as error:
        raise HTTPException(status_code=503, detail="Database unavailable") from error


def descriptor_distance(first: list[float], second: list[float]) -> float:
    return math.sqrt(sum((left - right) ** 2 for left, right in zip(first, second)))


@app.get("/health")
def health() -> dict[str, str]:
    with db() as connection:
        connection.execute("SELECT 1")
    return {"status": "ok"}


@app.post("/api/students")
def create_student(payload: StudentCreate) -> dict[str, str]:
    with db() as connection:
        row = connection.execute(
            "SELECT create_child(%s, %s, %s, %s, %s)",
            (payload.emis, payload.language, payload.nickname, payload.age_group, payload.pin),
        ).fetchone()
    return {"child_id": str(row[0])}


@app.post("/api/students/{child_id}/finalize")
def finalize_student(child_id: str, payload: ConsentInput) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute(
            "SELECT finalize_onboarding(%s, %s, %s, %s, %s)",
            (child_id, payload.parent_consent, payload.child_assent, payload.camera_opt_in, payload.voice_opt_in),
        ).fetchone()
    result = row[0]
    return {"session_id": result["session_id"], "session_number": result["session_number"]}


@app.post("/api/students/{child_id}/verify-pin")
def verify_pin(child_id: str, payload: PinInput) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT verify_pin(%s, %s)", (child_id, payload.pin)).fetchone()
    return row[0]


@app.post("/api/students/{child_id}/face")
def register_student_face(child_id: str, payload: FaceInput) -> dict[str, Any]:
    """Stores the descriptor unless it already belongs to another active account.

    A duplicate comes back as an ordinary 200 with ok=false, not an error status: the
    child-facing screen has to explain it gently and offer a way forward, and a 4xx
    would reach the client as a thrown exception with no structure to branch on.
    """
    with db() as connection:
        row = connection.execute(
            "SELECT register_face(%s, %s::jsonb)", (child_id, Jsonb(payload.descriptor))
        ).fetchone()
    return row[0]


@app.post("/api/students/{child_id}/face-override")
def override_face_step(child_id: str, payload: FaceInput) -> dict[str, Any]:
    """Lets a headmaster, counsellor or admin authorise a child past the mandatory face
    step — for a camera that will not start, or a child the matcher wrongly refuses.
    The descriptor is the STAFF member's, matched at the strict block threshold; nothing
    is stored against the child except an audit row naming who authorised it."""
    with db() as connection:
        row = connection.execute(
            "SELECT authorise_face_skip(%s, %s::jsonb)", (child_id, Jsonb(payload.descriptor))
        ).fetchone()
    return row[0]


@app.post("/api/students/{child_id}/discard")
def discard_student(child_id: str) -> dict[str, Any]:
    """Removes an onboarding record that never completed — used when the face check
    finds the child already has an account. The RPC refuses to touch anything that has
    consent on record or any session history, whatever id is passed in."""
    with db() as connection:
        row = connection.execute("SELECT discard_unfinished_child(%s)", (child_id,)).fetchone()
    return row[0]


@app.post("/api/students/{child_id}/verify-face")
def verify_student_face(child_id: str, payload: FaceInput) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute(
            "SELECT verify_face(%s, %s::jsonb)", (child_id, Jsonb(payload.descriptor))
        ).fetchone()
    return row[0]


@app.get("/api/students/{child_id}/context")
def student_context(child_id: str) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT get_returning_context(%s)", (child_id,)).fetchone()
    return row[0]


@app.post("/api/students/{child_id}/clear-alert")
def clear_alert(child_id: str) -> dict[str, bool]:
    with db() as connection:
        connection.execute("SELECT clear_clinician_alert(%s)", (child_id,))
    return {"ok": True}


@app.post("/api/students/login")
def login_student(payload: ChildPinLogin) -> dict[str, Any]:
    """Finds the child a nickname + PIN belongs to, for a device with no stored id."""
    with db() as connection:
        row = connection.execute(
            "SELECT login_child_by_pin(%s, %s, %s)", (payload.nickname, payload.pin, payload.emis)
        ).fetchone()
    return row[0]


@app.post("/api/students/login-face")
def login_student_by_face(payload: ChildFaceLogin) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute(
            "SELECT login_child_by_face(%s::jsonb, %s)", (Jsonb(payload.descriptor), payload.emis)
        ).fetchone()
    return row[0]


@app.post("/api/students/{child_id}/sessions")
def start_session(child_id: str) -> dict[str, Any]:
    """Opens a SESSION for this sitting — the child has just entered C01."""
    with db() as connection:
        row = connection.execute("SELECT start_session(%s)", (child_id,)).fetchone()
    result = row[0]
    return {"session_id": result["session_id"], "session_number": result["session_number"]}


@app.post("/api/sessions/{session_id}/safeguard-flag")
def raise_safeguard_flag(session_id: str, payload: SafeguardFlagInput) -> dict[str, Any]:
    """Amber and red disclosures are written the moment they are made, never batched
    with the basket — a child who then backs out has still disclosed."""
    with db() as connection:
        row = connection.execute(
            "SELECT raise_safeguard_flag(%s, %s, %s, %s, %s)",
            (session_id, payload.issue_id, payload.severity, payload.cluster_id, payload.sub_id),
        ).fetchone()
    return {"flag_id": str(row[0])}


@app.post("/api/sessions/{session_id}/cluster-flags")
def save_cluster_selection(session_id: str, payload: ClusterSelection) -> dict[str, Any]:
    """The confirmed basket, written as one CLUSTER_FLAG row per canonical issue id."""
    items = [item.model_dump() for item in payload.items]
    with db() as connection:
        row = connection.execute(
            "SELECT save_cluster_selection(%s, %s::jsonb)", (session_id, Jsonb(items))
        ).fetchone()
    return row[0]


@app.post("/api/staff/register")
def register_staff(payload: StaffCreate) -> dict[str, Any]:
    if payload.role == "admin":
        raise HTTPException(status_code=400, detail="Use admin login for admin accounts")
    try:
        with db() as connection:
            row = connection.execute(
                "SELECT create_staff_user(%s::app_user_role, %s, %s, NULL, NULL, %s::jsonb)",
                (payload.role, payload.display_name, payload.language, Jsonb(payload.face_descriptor)),
            ).fetchone()
    except psycopg.errors.UniqueViolation as error:
        # create_staff_user raises 23505 when the face already belongs to an account,
        # in any role — including a student one.
        raise HTTPException(
            status_code=409, detail="That face is already registered to another account"
        ) from error
    return {"user_id": str(row[0]), "display_name": payload.display_name}


@app.post("/api/staff/verify-face")
def verify_staff_face(payload: StaffCreate) -> dict[str, Any]:
    if payload.role == "admin":
        raise HTTPException(status_code=400, detail="Use admin login for admin accounts")
    with db() as connection:
        rows = connection.execute(
            "SELECT id, display_name, preferred_language, face_template "
            "FROM app_user WHERE role = %s::app_user_role AND is_active AND face_template IS NOT NULL",
            (payload.role,),
        ).fetchall()
    best = min(
        ((descriptor_distance(template, payload.face_descriptor), user_id, name, language) for user_id, name, language, template in rows),
        default=None,
        key=lambda match: match[0],
    )
    if best and best[0] < FACE_MATCH_THRESHOLD:
        distance, user_id, name, language = best
        return {"ok": True, "user_id": str(user_id), "display_name": name, "language": language, "distance": distance}
    return {"ok": False, "distance": math.inf}


@app.post("/api/admin/login")
def login_admin(payload: AdminLogin) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT verify_admin(%s, %s)", (payload.username, payload.password)).fetchone()
    result = row[0]
    if not result.get("ok"):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return result


@app.get("/api/users/{user_id}/dashboard")
def dashboard(user_id: str) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT get_user_dashboard_summary(%s)", (user_id,)).fetchone()
    return row[0]
