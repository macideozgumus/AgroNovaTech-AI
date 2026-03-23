from __future__ import annotations

from typing import TypedDict

from fastapi import HTTPException


class UserRecord(TypedDict):
    password: str
    province: str
    district: str
    village: str


USERS: dict[str, UserRecord] = {
    "demo": {"password": "demo123", "province": "Sakarya", "district": "Serdivan", "village": "Kazimpasa Koyu"},
    "oguz": {"password": "123456", "province": "Istanbul", "district": "Pendik", "village": "Kurna Koyu"},
    "zeynep": {"password": "123456", "province": "Ankara", "district": "Polatli", "village": "Basri Koyu"},
    "mehmet": {"password": "123456", "province": "Konya", "district": "Selcuklu", "village": "Tepekent Koyu"},
}


def authenticate_user(username: str, password: str) -> tuple[str, UserRecord]:
    normalized = username.strip().lower()
    user = USERS.get(normalized)
    if user is None or user["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return normalized, user


def register_user(username: str, password: str, province: str, district: str, village: str) -> tuple[str, UserRecord]:
    normalized = username.strip().lower()
    cleaned_password = password.strip()
    cleaned_province = province.strip()
    cleaned_district = district.strip()
    cleaned_village = village.strip()

    if len(normalized) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(cleaned_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if len(cleaned_province) < 2:
        raise HTTPException(status_code=400, detail="Province is required")
    if len(cleaned_district) < 2:
        raise HTTPException(status_code=400, detail="District is required")
    if len(cleaned_village) < 2:
        raise HTTPException(status_code=400, detail="Village is required")
    if normalized in USERS:
        raise HTTPException(status_code=409, detail="Username already exists")

    user: UserRecord = {
        "password": cleaned_password,
        "province": cleaned_province,
        "district": cleaned_district,
        "village": cleaned_village,
    }
    USERS[normalized] = user
    return normalized, user


def list_users() -> list[dict[str, str]]:
    return [
        {
            "username": username,
            "province": data["province"],
            "district": data["district"],
            "village": data["village"],
        }
        for username, data in sorted(USERS.items())
    ]
