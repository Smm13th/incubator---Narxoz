/* ========= Скины ========= */
export let SKINS = {
  saka: 'gold',
  ground: 'sand',
  owned: ['saka_gold', 'ground_sand']
};
try { const savedSkins = localStorage.getItem('asyq_skins'); if(savedSkins) SKINS = JSON.parse(savedSkins); } catch(e){}
export const saveSkins = () => { try{ localStorage.setItem('asyq_skins', JSON.stringify(SKINS)); }catch(e){} };



export let SAVE={};try{SAVE=JSON.parse(localStorage.getItem('asyq')||'{}')}catch(e){}
export const persist=()=>{try{localStorage.setItem('asyq',JSON.stringify(SAVE))}catch(e){}};

