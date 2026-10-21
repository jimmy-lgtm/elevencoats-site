import re,glob
def ts(m):
    u=m.group(2)
    if not u.endswith('/') and '.' not in u.rsplit('/',1)[-1]: u+='/'
    return m.group(1)+u
for f in glob.glob('**/*.html',recursive=True)+['llms.txt','sitemap.xml']:
    s=open(f).read();o=s
    s=re.sub(r'(rel="canonical" href="|<loc>|"url": ?"|"item": ?"|og:url" content=")(https://elevencoatspainting\.com/[^"<#?]*)',ts,s)
    if s!=o: open(f,'w').write(s)
