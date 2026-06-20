with open('app/collection/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """              return (
                
                  key={t.collection_id}"""

new = """              return (
                
                  key={t.collection_id}"""

if old in content:
    content = content.replace(old, new)
    with open('app/collection/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed - <a tag added")
else:
    print("Pattern not found - checking actual content...")
    idx = content.find("return (")
    print(repr(content[idx:idx+100]))