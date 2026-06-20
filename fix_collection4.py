with open('app/collection/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "      return (\n                \n                  key={t.collection_id}"
new = "      return (\n                <a\n                  key={t.collection_id}"

count = content.count(old)
print(f"Occurrences found: {count}")

if count == 1:
    content = content.replace(old, new)
    with open('app/collection/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS - file updated")
else:
    print("FAILED")