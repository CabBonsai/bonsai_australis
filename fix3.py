f = open('app/species/[sp_no]/page.tsx', encoding='utf-8')
content = f.read()
f.close()

content = content.replace(
    "value={species.research_status || 'Not Started'}",
    'value={species.research_status || "Not Started"}'
)
content = content.replace(
    "onChange={e => updateSpecies('research_status', e.target.value)}",
    'onChange={e => updateSpecies("research_status", e.target.value)}'
)

f = open('app/species/[sp_no]/page.tsx', 'w', encoding='utf-8')
f.write(content)
f.close()
print('Done')