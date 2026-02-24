from pydantic import BaseModel, EmailStr

from app.core.enums import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    ok: bool = True
    access_token: str
    token_type: str = "bearer"
    role: UserRole

