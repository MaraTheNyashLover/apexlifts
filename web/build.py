# Builds the single-file web app. Run from anywhere: python3 web/build.py
# Outputs: index.html (repo root, preview) and ios-app/www/index.html (what the iOS app ships).
import re, os
H=os.path.dirname(os.path.abspath(__file__)); R=os.path.dirname(H)
rd=lambda n: open(os.path.join(H,n)).read()
old_css=rd('base.css'); assert '--bg:#0F1012' in old_css
leaf=re.sub(r'url\(images/[^)]*\)','none',rd('leaflet.css')).replace('url(#default#VML)','none')
extra=rd('extra.css'); js=rd('app.js')
body=('<title>Apex Lifts</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap">\n'
 '<style>\n'+old_css+'\n/* Leaflet 1.9.4 (inlined) */\n'+leaf+'\n'+extra+'</style>\n'
 '<div id="app">\n  <main id="screen" aria-live="polite"></main>\n  <nav id="nav" aria-label="Main"></nav>\n</div>\n'
 '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>\n<script>\n'+js+'\n</script>\n')
html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no"><meta name="theme-color" content="#0F1012"><style>:root{color-scheme:dark}body{margin:0}</style></head><body>\n'+body+'</body></html>'
for p in (os.path.join(R,'index.html'), os.path.join(R,'ios-app','www','index.html')):
    open(p,'w').write(html)
print("built", len(html))
