
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# print(pwd_context.hash("H@nnib@l924802"))  
print(pwd_context.hash("hello@123"))  


"""
INSERT INTO users (user_id, username, email, password_hash, global_role_id)
VALUES (
    1,
    'root',
    'sys@gmail.com',
    '$2b$12$2L5cm8TqOicuGcFFEDw.ouU5EZ5wFGsk6DP5TOD.aceaucPOSYZra',
    1
);

"""
"""
{
  "hospital_name": "City Care Hospital",
  "hospital_email": "contact@citycare.com",
  "admin_email": "admin@citycare.com",
  "admin_password": "StrongPass123!",
  "admin_username": "city_admin",
  "admin_first_name": "Aarav",
  "admin_last_name": "Sharma",
  "admin_phone": "+919876543210",
  "auto_login": true
}
"""
