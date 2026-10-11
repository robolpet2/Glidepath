import numpy as np,wave
SR=44100;T=30;n=SR*T;L=np.zeros(n);Rr=np.zeros(n);t=np.arange(n)/SR;B=0.5
rs=np.random.RandomState(1)
def add(sig,at,pan=0,g=1):
    i=int(at*SR);e=min(n,i+len(sig));s=sig[:e-i]*g;L[i:e]+=s*(1-pan)/1;Rr[i:e]+=s*(1+pan)/1
def kick():
    tt=np.arange(int(.35*SR))/SR;f=45+120*np.exp(-tt*30);return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*9)
def hat():
    tt=np.arange(int(.05*SR))/SR;x=rs.randn(len(tt));x=np.diff(x,prepend=0);return x*np.exp(-tt*80)*.25
def snare():
    tt=np.arange(int(.25*SR))/SR;return (rs.randn(len(tt))*.6+np.sin(2*np.pi*190*tt))*np.exp(-tt*18)
def saw(f,d,dec=6):
    tt=np.arange(int(d*SR))/SR;x=sum(np.sin(2*np.pi*f*k*tt)/k for k in range(1,8));return x*np.exp(-tt*dec)*.2
def impact():
    tt=np.arange(int(1.5*SR))/SR;f=60*np.exp(-tt*2)+30;return (np.sin(2*np.pi*np.cumsum(f)/SR)*1.2+rs.randn(len(tt))*np.exp(-tt*6)*.5)*np.exp(-tt*2.5)
roots=[57,53,48,55]  # Am F C G
mid=lambda m:440*2**((m-69)/12)
for b in range(int(T/B)):
    at=b*B;bar=b//4;r=roots[bar%4]
    if at<2.5: continue
    if at<26 or at>=27:
        add(kick(),at,0,.9)
        if b%2: add(snare(),at,0,.35)
    for h in range(2): add(hat(),at+h*B/2,.4*(-1)**h,.8 if at<21 else 1)
    for s in range(4):
        st=[0,12,7,15][s];add(saw(mid(r-12+st+12),B/4*.9,14),at+s*B/4,.3*(-1)**s,.45)
    if b%4==0:
        for iv in [0,3,7]: add(saw(mid(r+iv+(4 if r in(53,48) and iv==3 else 0)),B*4,.6),at,0,.18)
# intro riser 0-3 and 21-26
for a,bb in[(0,3),(21,25.9)]:
    i0,i1=int(a*SR),int(bb*SR);tt=np.arange(i1-i0)/SR;p=tt/tt[-1]
    sig=(rs.randn(len(tt))*.3*p**2+np.sin(2*np.pi*np.cumsum(200+1800*p**2)/SR)*.15*p);L[i0:i1]+=sig;Rr[i0:i1]+=sig
for at in[3,15,21,26.2]: add(impact(),at,0,.9)
x=np.stack([L,Rr],1);x=np.tanh(x*1.3);fade=np.ones(n);fo=int(1.2*SR);fade[-fo:]=np.linspace(1,0,fo);x*=fade[:,None];x/=np.abs(x).max()*1.05
w=wave.open('music.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((x*32767).astype('<i2').tobytes());w.close()
