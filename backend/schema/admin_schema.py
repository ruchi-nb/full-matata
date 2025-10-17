from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class PermissionOut(BaseModel):
    permission_id: int
    permission_name: str
    description: Optional[str] = None


class HospitalOut(BaseModel):
    hospital_id: int
    hospital_name: str
    hospital_email: Optional[str] = None
    admin_contact: Optional[str] = None
    address: Optional[str] = None

# Hospital user schemas
class HospitalUserOut(BaseModel):
    user_id: int
    username: str
    email: str
    hospital_role_id: int
    is_active: int

# Role schemas
class HospitalRoleOut(BaseModel):
    hospital_role_id: int
    hospital_id: int
    role_name: str
    description: Optional[str] = None
    is_active: int

class HospitalRoleCreateIn(BaseModel):
    role_name: str = Field(..., min_length=1)
    description: Optional[str] = None
    parent_hospital_role_id: Optional[int] = None

class HospitalRoleUpdateIn(BaseModel):
    role_name: Optional[str] = None
    description: Optional[str] = None
    parent_hospital_role_id: Optional[int] = None
    is_active: Optional[int] = None

class HospitalRoleCreateOut(BaseModel):
    hospital_role_id: int

# Role permission schemas
class RolePermissionOut(BaseModel):
    permission_id: int
    permission_name: str

class SetRolePermissionsIn(BaseModel):
    permission_names: List[str]

# User role assignment schemas
class UserRoleOut(BaseModel):
    hospital_role_id: int
    role_name: str

class AssignUserRoleIn(BaseModel):
    role_id: int

class UpdateUserRoleIn(BaseModel):
    is_active: Optional[int] = 1

class UserWithRoleOut(BaseModel):
    user_id: int
    username: str
    email: str

# Generic response schemas
class StatusResponse(BaseModel):
    status: str

class DeleteResponse(BaseModel):
    status: str = "deleted"

class AssignResponse(BaseModel):
    status: str = "assigned"

class UpdateResponse(BaseModel):
    status: str = "updated"