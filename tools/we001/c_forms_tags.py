import glob
for f in ['contact/index.html','index.html']:
    s=open(f).read()
    if '_honey' not in s:
        for q in ['"/>','">']:
            s=s.replace('name="_next" value="https://elevencoatspainting.com/contact'+q,'name="_next" value="https://elevencoatspainting.com/thank-you/'+q+'\n<input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true"'+('/>' if q=='"/>' else '>'))
        open(f,'w').write(s)
TAG='''<!-- Google tag (gtag.js): Google Ads AW-10855930192 + GA4 G-SL8F1V0E9D -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-SL8F1V0E9D"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-10855930192');
  gtag('config', 'G-SL8F1V0E9D');
</script>
'''
for f in glob.glob('**/index.html',recursive=True):
    s=open(f).read()
    if 'G-SL8F1V0E9D' in s: continue
    s=s.replace('</head>',TAG+'</head>',1); open(f,'w').write(s)
