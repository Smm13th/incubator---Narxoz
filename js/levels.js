import {ZONE} from './config.js';

const row=(n,cx,y,g)=>[...Array(n)].map((_,i)=>[cx+(i-(n-1)/2)*g,y]);
const ring=(n,cx,cy,r)=>[...Array(n)].map((_,i)=>[cx+r*Math.cos(i/n*6.2832),cy+r*Math.sin(i/n*6.2832)]);
const LEVELS=[
 {id:'train',name:'Тренировка',throws:5,a:row(3,240,200,52),tip:'Потяни назад от сақа и отпусти.'},
 {id:'line',name:'Қатар (ряд)',throws:5,a:row(6,240,200,46),tip:'Бей вдоль ряда: точный бросок выбивает несколько.'},
 {id:'tri',name:'Үшбұрыш',throws:6,a:[...row(4,240,150,42),...row(3,240,186,42),...row(2,240,222,42),...row(1,240,258,42)],tip:'Целься в верхушку.'},
 {id:'ring',name:'Шеңбер (круг)',throws:6,a:[...ring(8,240,200,72),[240,200]],tip:'Центральный асык защищён.'},
 {id:'two',name:'Екі қатар',throws:6,a:[...row(5,240,130,52),...row(5,240,250,52)],tip:'Выбирай, какой ряд бить первым.'},
 {id:'far',name:'Алыс (далеко)',throws:5,a:[...row(4,240,95,70),...row(3,240,140,70),[150,290],[330,290]],tip:'Дальний кон: нужна полная сила.'}
];
function mulberry(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function today(){return new Date().toLocaleDateString('sv',{timeZone:'Asia/Almaty'})}
function dailyLevel(){
  const d=today(),r=mulberry([...d].reduce((h,c)=>h*31+c.charCodeAt(0)|0,7)),a=[];
  for(let n=0;a.length<9&&n<500;n++){
    const p=[ZONE.x+25+r()*(ZONE.w-50),ZONE.y+25+r()*(ZONE.h-50)];
    if(a.every(q=>Math.hypot(q[0]-p[0],q[1]-p[1])>36))a.push(p);
  }
  return{id:'daily-'+d,name:'Испытание '+d,throws:6,a,tip:'Одинаковая расстановка для всех сегодня.'};
}
export {LEVELS,dailyLevel,today,mulberry};
