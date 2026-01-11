const API='https://wedding-recommender.onrender.com';
const params=new URLSearchParams(window.location.search);
const slug=params.get('slug')||'sarah-and-john';
let weddingData=null;

async function loadWeddingData(){
try{
console.log('Loading wedding data for slug:', slug);
const r=await fetch(`${API}/wedding-site/${slug}`);
if(!r.ok){
  console.error('API response not ok:', r.status, r.statusText);
  throw new Error('Not found');
}
weddingData=await r.json();
console.log('Wedding data loaded successfully:', weddingData);
return weddingData;
}catch(e){
console.error('Error in loadWeddingData:', e);
document.body.innerHTML='<div style="text-align:center;padding:2rem"><h1>Error loading wedding</h1><p style="color:#666;margin-top:1rem">'+e.message+'</p></div>';
throw e;
}
}

function fmt(d){
if(!d)return'';
return new Date(d).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
}

function toggleMobile(){
document.querySelector('.nav-links').classList.toggle('open');
}

function renderEvents(events){
if(!events||!events.length)return'<p style="text-align:center;color:#666">Details coming soon</p>';
return events.map(e=>`
<div class="event-card">
<h3 style="color:var(--primary);margin-bottom:1rem;font-size:1.5rem">${e.name}</h3>
<p style="margin-bottom:.5rem"><strong>Date:</strong> ${fmt(e.date)} ${e.time||''}</p>
${e.venue?`<p style="margin-bottom:.5rem"><strong>Venue:</strong> ${e.venue}</p>`:''}
${e.dress_code?`<p><strong>Dress Code:</strong> ${e.dress_code}</p>`:''}
</div>
`).join('');
}

function renderGallery(images){
const imgs=images&&images.length?images.map(i=>i.url||i.thumbnail):['https://images.unsplash.com/photo-1606800052052-a08af7148866?w=400','https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=400','https://images.unsplash.com/photo-1519741497674-611481863552?w=400','https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400','https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=400','https://images.unsplash.com/photo-1529636798458-92182e662485?w=400'];
return imgs.map(u=>`<div class="gallery-item"><img src="${u}" alt="Gallery"></div>`).join('');
}