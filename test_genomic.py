import requests

payload = {
    "gene": "CYP1A2",
    "genotype_data": {"genotype": "AA"},
    "phenotype_data": {
        "gene": "CYP1A2",
        "responses": {
            "cyp1a2_dose_threshold": 1,
            "cyp1a2_duration_effect": 1,
            "cyp1a2_time_of_day_tolerance": 1
        }
    },
    "lifestyle_context": {"user_type": "explorer"}
}

try:
    res = requests.post("http://localhost:8000/analyze-genomic", json=payload)
    print("Status:", res.status_code)
    print("Response:", res.text)
except Exception as e:
    print("Error:", e)
