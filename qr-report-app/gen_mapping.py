import csv
import json

mapping = {}
with open('mathura_2026-02-23.csv', 'r') as f:
    reader = csv.reader(f)
    next(reader) # skip header
    for row in reader:
        if len(row) >= 2:
            ward = row[0].strip()
            route_id = row[1].strip()
            if route_id:
                mapping[route_id] = {"ward": ward, "name": route_id}

print("const ROUTE_WARD_MAPPING: Record<string, { ward: string; name: string }> = {")
for k, v in mapping.items():
    print(f'    "{k}": {{ "ward": "{v["ward"]}", "name": "{v["name"]}" }},')
print("};")
