with open('app/collection/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find("key={t.collection_id}")
print("Context (50 chars before to 20 after):")
print(repr(content[idx-50:idx+20]))