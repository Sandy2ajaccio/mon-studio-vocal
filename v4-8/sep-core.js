// Séparation voix / musique par analyse du centre stéréo (aucune bibliothèque externe).
// Principe : dans un mixage, la voix principale est presque toujours placée au centre
// (identique à gauche et à droite). On repère, fréquence par fréquence, ce qui est
// commun aux deux canaux dans la zone de la voix ; le reste devient « la musique ».
// Musique = original − voix : à volumes égaux, on retrouve exactement l’original.
// v4.6 : fenêtres plus longues (4096), masque lissé en fréquence et relâché lentement
// dans le temps, pour éviter les petites coupures (« euh, euh, euh ») sur les notes tenues.
(function(g){
function makeFFT(N){const lv=Math.log2(N),rev=new Uint32Array(N),cs=new Float64Array(N/2),sn=new Float64Array(N/2);
 for(let i=0;i<N;i++){let r=0;for(let b=0;b<lv;b++)r|=((i>>b)&1)<<(lv-1-b);rev[i]=r}
 for(let i=0;i<N/2;i++){cs[i]=Math.cos(2*Math.PI*i/N);sn[i]=-Math.sin(2*Math.PI*i/N)}
 return function(re,im){for(let i=0;i<N;i++){const j=rev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let size=2;size<=N;size<<=1){const h=size>>1,st=N/size;for(let i=0;i<N;i+=size)for(let k=0;k<h;k++){const a=i+k,b=a+h,wr=cs[k*st],wi=sn[k*st],
   xr=re[b]*wr-im[b]*wi,xi=re[b]*wi+im[b]*wr;re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi}}}}
// L, R : Float32Array de même longueur. Renvoie {voice: Float32Array mono, mono: bool}
async function separateCenter(L,R,sr,onProgress,O){O=Object.assign({N:4096,th:.7,up:.3,dn:.1,fw:3},O||{});
 const len=L.length;
 // Fichier mono ou « faux stéréo » : impossible de séparer par le centre
 let se=0,me=0;for(let i=0;i<len;i+=7){const m=L[i]+R[i],s=L[i]-R[i];me+=m*m;se+=s*s}
 if(me===0||se/me<1e-4)return{voice:null,mono:true};
 const N=O.N,H=N/4,fft=makeFFT(N),win=new Float64Array(N);for(let i=0;i<N;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
 const K=N/2,wf=new Float64Array(K+1);
 for(let k=0;k<=K;k++){const f=k*sr/N;wf[k]=f<90?0:f<160?(f-90)/70:f<8000?1:f<12000?(12000-f)/4000*0.6:0}
 const cm=new Float64Array(N/2+1),mr=new Float64Array(N/2+1),mi=new Float64Array(N/2+1),re=new Float64Array(N),im=new Float64Array(N),vr=new Float64Array(N),vi=new Float64Array(N),ms=new Float64Array(K+1);
 const out=new Float32Array(len),norm=1/1.5;let frames=0;const total=Math.ceil((len+N)/H);
 for(let s=-N+H;s<len;s+=H){
  for(let i=0;i<N;i++){const p=s+i,w=win[i];if(p>=0&&p<len){re[i]=L[p]*w;im[i]=R[p]*w}else{re[i]=0;im[i]=0}}
  fft(re,im);
  for(let k=0;k<=K;k++){const j=(N-k)%N,
   Lr=(re[k]+re[j])/2,Li=(im[k]-im[j])/2,Rr=(im[k]+im[j])/2,Ri=-(re[k]-re[j])/2,
   pL=Lr*Lr+Li*Li,pR=Rr*Rr+Ri*Ri,c=2*(Lr*Rr+Li*Ri)/(pL+pR+1e-20);
   let m=(c-O.th)/(0.97-O.th);m=m<0?0:m>1?1:m;m=m*m*(3-2*m);
   cm[k]=m;mr[k]=(Lr+Rr)/2;mi[k]=(Li+Ri)/2;}
  for(let k=0;k<=K;k++){let m=0,ww=0;const F=O.fw;for(let q=-F;q<=F;q++){const kk=k+q;if(kk<0||kk>K)continue;const wq=1/(1+Math.abs(q));m+=cm[kk]*wq;ww+=wq}m/=ww;
   const up=O.up,dn=O.dn;ms[k]+= (m-ms[k])*(m>ms[k]?up:dn);
   const g=ms[k]*wf[k],Vr=g*mr[k],Vi=g*mi[k];
   vr[k]=Vr;vi[k]=-Vi; // conjugué pour la FFT inverse
   if(k>0&&k<K){vr[N-k]=Vr;vi[N-k]=Vi}}
  fft(vr,vi); // FFT inverse = conj(FFT(conj X)) / N ; la partie réelle suffit
  for(let i=0;i<N;i++){const p=s+i;if(p>=0&&p<len)out[p]+=vr[i]/N*win[i]*norm}
  if(++frames%300===0&&onProgress)await onProgress(frames/total)}
 return{voice:out,mono:false}}
g.separateCenter=separateCenter;
})(typeof self!=="undefined"?self:globalThis);
