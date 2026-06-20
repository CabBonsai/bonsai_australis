import csv

with open('powo_results.csv', newline='', encoding='utf-8') as infile:
    reader = csv.DictReader(infile)
    rows = list(reader)
    fieldnames = reader.fieldnames

# Adjust this column name if it's different in your actual CSV
uncertain_col = 'powo_native'

uncertain_rows = [r for r in rows if r.get(uncertain_col, '').strip() in ('', 'None', 'Uncertain')]

with open('uncertain_for_review.csv', 'w', newline='', encoding='utf-8') as outfile:
    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(uncertain_rows)

print(f"Found {len(uncertain_rows)} uncertain rows, saved to uncertain_for_review.csv")