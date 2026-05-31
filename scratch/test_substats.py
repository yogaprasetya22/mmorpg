import requests
import random
import string
import json

def rand_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

BASE_URL = "http://localhost:8080/api"
username = f"user_{rand_string()}"
password = "password123"

print("--- 1. REGISTERING USER ---")
reg_payload = {"username": username, "password": password}
r = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
print(f"Register status: {r.status_code}")
print(r.text)
assert r.status_code == 200, "Registration failed"

print("\n--- 2. LOGGING IN ---")
login_payload = {"username": username, "password": password}
r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
print(f"Login status: {r.status_code}")
print(r.text)
assert r.status_code == 200, "Login failed"
token = r.json()["token"]

print("\n--- 3. CREATING CHARACTER ---")
headers = {"Authorization": f"Bearer {token}"}
char_payload = {
    "name": f"char_{rand_string(4)}",
    "class": "Warrior",
    "gender": "Male",
    "hair_style": 1,
    "hair_color": "#5A3E2D"
}
r = requests.post(f"{BASE_URL}/player/characters", json=char_payload, headers=headers)
print(f"Create character status: {r.status_code}")
print(r.text)
assert r.status_code == 200, "Character creation failed"
char_id = r.json()["player"]["id"]

print("\n--- 4. FETCHING PROFILE ---")
r = requests.get(f"{BASE_URL}/player/profile?character_id={char_id}", headers=headers)
print(f"Profile status: {r.status_code}")
profile_data = r.json()
print(json.dumps(profile_data, indent=2))

# Verify formulas and properties
player = profile_data["player"]
print("\n--- 5. VERIFYING STATS INTEGRITY ---")
print(f"Class: {player['class']}")
print(f"Level: {player['level']}")
print(f"Base Attributes: STR={player['base_str']}, AGI={player['base_agi']}, VIT={player['base_vit']}, INT={player['base_int']}, DEX={player['base_dex']}, LUK={player['base_luk']}")
print(f"Bonus Attributes: STR={player['bonus_str']}, AGI={player['bonus_agi']}, VIT={player['bonus_vit']}, INT={player['bonus_int']}, DEX={player['bonus_dex']}, LUK={player['bonus_luk']}")
print(f"Total Attributes: STR={player['str']}, AGI={player['agi']}, VIT={player['vit']}, INT={player['int']}, DEX={player['dex']}, LUK={player['luk']}")
print(f"Combat Stats: ATK={player['attack']}, MATK={player['magic_attack']}, DEF={player['defense']}, MDEF={player['magic_defense']}, HIT={player['hit']}, FLEE={player['flee']}, CRIT={player['critical_rate']}, Perfect Dodge={player['perfect_dodge']}, Cast Time={player['cast_time']}")

assert player['base_str'] == 10, "Base STR should be 10"
assert player['bonus_str'] == 5, "Warrior bonus STR should be 5"
assert player['str'] == 15, "Total STR should be 15"
assert player['hit'] == 175 + player['level'] + player['dex'] + (player['luk'] // 3), "HIT calculation is wrong"
assert player['flee'] == 100 + player['level'] + player['agi'] + (player['luk'] // 5), "FLEE calculation is wrong"

print("\n🎉 ALL PROGRAMMATIC CHECKS PASSED SUCCESSFULLY!")
