f = open('app/species/[sp_no]/page.tsx', encoding='utf-8')
content = f.read()
f.close()

# Remove the broken select block entirely and replace with clean version
old = '<div><label className="block text-sm font-medium mb-1">Research status</label><select value={species.research_status || \'Not Started\'} onChange={e => updateSpecies(\'research_status\', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-base"><option>Not Started</option><option>In Progress</option><option>Complete</option></select></div>'

new = """<div>
          <label className="block text-sm font-medium mb-1">Research status</label>
          <select
            value={species.research_status || "Not Started"}
            onChange={e => updateSpecies("research_status", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          >
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Complete">Complete</option>
          </select>
        </div>"""

content = content.replace(old, new)
f = open('app/species/[sp_no]/page.tsx', 'w', encoding='utf-8')
f.write(content)
f.close()
print('Done')