import re,glob
for f in glob.glob('**/*.html',recursive=True)+['llms.txt']:
    s=open(f).read();o=s
    s=re.sub(r',?\s*"aggregateRating": \{[^}]*\}','',s)
    s=s.replace(', 131 reviews','').replace(' and 131 real reviews','')
    s=s.replace("That's how we've maintained a <strong>4.7-star rating across 131 reviews</strong> and backed","That's how we've built our reputation and backed")
    s=s.replace(': listing checked October 12, 2026 showed 4.8 out of 5 from 139 reviews"','"').replace('<span class="google-rating">4.8 / 5 · 139 reviews</span><span class="google-read">Checked Oct 12</span>','<span class="google-rating">Read our reviews on Google</span>').replace(' title="Google listing checked October 12, 2026"','')
    s=s.replace('4.7 · 131 Reviews &nbsp;·&nbsp; 9-Year','9-Year')
    s=re.sub(r'<div class="card"><div class="icon">⭐</div><h3>4.7 Stars · 131 Reviews</h3><p>[^<]*</p></div>','<div class="card"><div class="icon">⭐</div><h3>Reviewed on Google</h3><p>Read what Valley homeowners say about us on our <a href="https://share.google/AYmL3OWAoF9nvvpef" target="_blank" rel="noopener" style="color:var(--orange)">Google listing</a>.</p></div>',s)
    s=s.replace('<div><div class="stat-number">4.7★</div><div class="stat-label">Google Rating · 131 Reviews</div></div>','<div><div class="stat-number">ROC</div><div class="stat-label">#360099 Licensed</div></div>')
    if s!=o: open(f,'w').write(s)
