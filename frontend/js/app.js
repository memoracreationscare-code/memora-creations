const API='https://memora-creations.onrender.com/api';
const BASE='/memora-creations';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

async function api(path,options={}){
  const res=await fetch(API+path,{
    credentials:'include',
    headers:{
      'Content-Type':'application/json',
      ...(options.headers||{})
    },
    ...options
  });

  let data={};

  try{
    data=await res.json();
  }catch{}

  if(!res.ok){
    throw new Error(data.message||'Request failed.');
  }

  return data;
}

function money(n){
  return `₹${Number(n||0).toLocaleString('en-IN',{
    maximumFractionDigits:2
  })}`;
}

function esc(s){
  return String(s??'').replace(/[&<>'"]/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[c]));
}

function toast(msg,type='message'){
  const el=document.createElement('div');

  el.className=`message ${type}`;
  el.textContent=msg;

  document.body.prepend(el);

  setTimeout(()=>{
    el.remove();
  },3500);
}

async function currentUser(){
  try{
    return (await api('/auth/me')).user;
  }catch{
    return null;
  }
}

async function requireLogin(){
  const user=await currentUser();

  if(!user){
    location.href=
      BASE+
      '/frontend/login.html?next='+
      encodeURIComponent(
        location.pathname+location.search
      );

    return null;
  }

  return user;
}

function nav(){
  const el=$('#nav');

  if(!el) return;

  el.innerHTML=`
    <div class="container nav">

      <a
        class="brand"
        href="${BASE}/frontend/index.html"
      >
        MEMORA CREATIONS
      </a>

      <form
        class="search"
        id="globalSearch"
      >
        <input
          class="input"
          placeholder="Search products..."
          name="q"
        >

        <button
          class="btn"
          type="submit"
        >
          Search
        </button>
      </form>

      <div class="navlinks">

        <a href="${BASE}/frontend/index.html">
          Home
        </a>

        <a href="${BASE}/frontend/products.html">
          Products
        </a>

        <a href="${BASE}/frontend/orders.html">
          Orders
        </a>

        <a href="${BASE}/frontend/profile.html">
          Profile
        </a>

        <a href="${BASE}/frontend/cart.html">
          Cart (<span id="cartCount">0</span>)
        </a>

        <button
          class="btn secondary"
          id="logoutBtn"
          type="button"
        >
          Logout
        </button>

      </div>

    </div>
  `;

  const searchForm=$('#globalSearch');

  if(searchForm){
    searchForm.addEventListener(
      'submit',
      event=>{
        event.preventDefault();

        const q=
          new FormData(
            event.currentTarget
          ).get('q')||'';

        location.href=
          BASE+
          '/frontend/products.html?q='+
          encodeURIComponent(q);
      }
    );
  }

  const logoutButton=$('#logoutBtn');

  if(logoutButton){
    logoutButton.addEventListener(
      'click',
      async()=>{
        try{
          await api(
            '/auth/logout',
            {method:'POST'}
          );
        }catch{}

        location.href=
          BASE+
          '/frontend/login.html';
      }
    );
  }

  updateCartCount();
}

async function updateCartCount(){
  const el=$('#cartCount');

  if(!el) return;

  try{
    const d=await api('/cart');

    el.textContent=
      (d.cart?.items||[])
        .reduce(
          (sum,item)=>
            sum+Number(item.quantity||0),
          0
        );

  }catch{
    el.textContent='0';
  }
}

function bottomNav(){
  const el=$('#bottomNav');

  if(!el) return;

  el.innerHTML=`
    <a href="${BASE}/frontend/index.html">
      HOME
    </a>

    <a href="${BASE}/frontend/products.html">
      PRODUCTS
    </a>

    <a href="${BASE}/frontend/cart.html">
      CART
    </a>

    <a href="${BASE}/frontend/orders.html">
      ORDERS
    </a>

    <a href="${BASE}/frontend/profile.html">
      PROFILE
    </a>
  `;
}

document.addEventListener(
  'DOMContentLoaded',
  ()=>{
    nav();
    bottomNav();
  }
);

window.MC={
  api,
  $,
  $$,
  money,
  esc,
  toast,
  currentUser,
  requireLogin,
  updateCartCount
};
