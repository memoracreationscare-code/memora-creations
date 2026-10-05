const {api,$,toast}=window.MC;

$('#adminLogin')?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    await api('/admin/login',{
      method:'POST',
      body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))
    });
    location.href='/memora-creations/admin/dashboard.html';
  }catch(x){
    toast(x.message,'error');
  }
});

async function requireAdmin(){
  try{
    return (await api('/admin/dashboard')).dashboard;
  }catch(e){
    location.href='/memora-creations/admin/index.html';
    return null;
  }
}

$('#logout')?.addEventListener('click',async()=>{
  await api('/admin/logout',{method:'POST'});
  location.href='/memora-creations/admin/index.html';
});

window.requireAdmin=requireAdmin;
