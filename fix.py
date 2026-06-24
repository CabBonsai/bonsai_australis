f = open('app/species/[sp_no]/page.tsx', encoding='utf-8')
content = f.read()
f.close()

# Fix curly quotes in research_status select
content = content.replace(
    "species.research_status || \u2018Not Started\u2019}",
    "species.research_status || 'Not Started'}"
)
content = content.replace(
    "updateSpecies(\u2018research_status\u2019,",
    "updateSpecies('research_status',"
)

f = open('app/species/[sp_no]/page.tsx', 'w', encoding='utf-8')
f.write(content)
f.close()
print('Done')[print(i+1, l.rstrip()) for i, l in enumerate(f[85:98])] 
