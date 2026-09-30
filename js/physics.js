import {W,H,K,DT,E,ZONE} from './config.js';

function step(bs){
  const f=Math.exp(-K*DT);
  for(const b of bs){
    b.x+=b.vx*DT;b.y+=b.vy*DT;b.vx*=f;b.vy*=f;
    if(b.x<b.r+6){b.x=b.r+6;b.vx=Math.abs(b.vx)*.5}
    if(b.x>W-b.r-6){b.x=W-b.r-6;b.vx=-Math.abs(b.vx)*.5}
    if(b.y<b.r+6){b.y=b.r+6;b.vy=Math.abs(b.vy)*.5}
    if(b.y>H-b.r-6){b.y=H-b.r-6;b.vy=-Math.abs(b.vy)*.5}
    if(b.vx*b.vx+b.vy*b.vy<25)b.vx=b.vy=0;
  }
  for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++)collide(bs[i],bs[j]);
}
function collide(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),m=a.r+b.r;
  if(d>=m||d===0)return;
  const nx=dx/d,ny=dy/d,ia=1/a.m,ib=1/b.m,ov=m-d,s=ia+ib;
  a.x-=nx*ov*ia/s;a.y-=ny*ov*ia/s;b.x+=nx*ov*ib/s;b.y+=ny*ov*ib/s;
  const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(rv>0)return;
  const j=-(1+E)*rv/s;
  a.vx-=j*nx*ia;a.vy-=j*ny*ia;b.vx+=j*nx*ib;b.vy+=j*ny*ib;
}
const inZone=a=>a.x>=ZONE.x&&a.x<=ZONE.x+ZONE.w&&a.y>=ZONE.y&&a.y<=ZONE.y+ZONE.h;
export {step,collide,inZone};
