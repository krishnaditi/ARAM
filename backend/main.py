from __future__ import annotations

import math
import os
from typing import Any, Literal

import psycopg
from psycopg.types.json import Jsonb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://aram:aram-local-only@localhost:5432/aram",
)
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
FACE_MATCH_THRESHOLD = 0.6

app = FastAPI(title="ARAM API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

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
def register_student_face(child_id: str, payload: FaceInput) -> dict[str, bool]:
    with db() as connection:
        connection.execute("SELECT register_face(%s, %s::jsonb)", (child_id, Jsonb(payload.descriptor)))
    return {"ok": True}


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


@app.post("/api/staff/register")
def register_staff(payload: StaffCreate) -> dict[str, Any]:
    if payload.role == "admin":
        raise HTTPException(status_code=400, detail="Use admin login for admin accounts")
    with db() as connection:
        row = connection.execute(
            "SELECT create_staff_user(%s::app_user_role, %s, %s, NULL, NULL, %s::jsonb)",
            (payload.role, payload.display_name, payload.language, Jsonb(payload.face_descriptor)),
        ).fetchone()
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
    for user_id, name, language, template in rows:
        distance = descriptor_distance(template, payload.face_descriptor)
        if distance < FACE_MATCH_THRESHOLD:
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
