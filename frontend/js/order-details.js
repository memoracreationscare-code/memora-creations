const {api,$,money,esc,toast}=window.MC;
let currentOrder=null;
async function loadOrder(){
  if(!await window.MC.requireLogin())return;
  const id=new URLSearchParams(location.search).get('id');
  if(!id)return toast('Order ID is missing.','error');
  const d=await api('/orders/'+encodeURIComponent(id)); currentOrder=d.order;
  $('#order').innerHTML=`<div class="two"><div><h1>Order Success</h1><p><b>${esc(currentOrder.orderId)}</b> · ${new Date(currentOrder.createdAt).toLocaleString('en-IN')}</p><div class="card"><div class="cardbody">${currentOrder.items.map(i=>`<div class="orderrow"><img src="${esc(i.imageUrl||'https://placehold.co/80')}" width="70" alt=""><div>${esc(i.name)} × ${i.quantity}</div><b>${money(i.lineTotal)}</b></div>`).join('')}</div></div><h2>Tracking</h2><div class="timeline">${currentOrder.statusHistory.map(s=>`<div class="timelineitem"><b>${esc(s.status)}</b><div class="muted">${new Date(s.changedAt).toLocaleString('en-IN')}</div><div>${esc(s.note||'')}</div></div>`).join('')}</div></div><aside class="summary"><div class="summaryline"><span>Payment</span><b>${esc(currentOrder.paymentMethod)}</b></div><div class="summaryline"><span>Payment Status</span><b>${esc(currentOrder.paymentStatus)}</b></div><div class="summaryline"><span>Order Status</span><b>${esc(currentOrder.orderStatus)}</b></div>${currentOrder.paymentMethod==='RAZORPAY' && currentOrder.paymentStatus!=='SUCCESS' && currentOrder.orderStatus!=='Cancelled' ? '<button class="btn" id="retryBtn">Retry Online Payment</button>' : ''}<div class="summaryline"><span>Subtotal</span><b>${money(currentOrder.subtotal)}</b></div><div class="summaryline"><span>Delivery</span><b>${money(currentOrder.deliveryCharge)}</b></div><div class="summaryline"><span>Discount</span><b>−${money(currentOrder.discount)}</b></div><div class="summaryline total"><span>Total</span><b>${money(currentOrder.grandTotal)}</b></div><p>${esc(currentOrder.shippingAddress.addressLine)}, ${esc(currentOrder.shippingAddress.city||'')}, ${esc(currentOrder.shippingAddress.state||'')} - ${esc(currentOrder.shippingAddress.pinCode)}</p></aside></div>`;
  $('#retryBtn')?.addEventListener('click',retryPayment);
}
async function retryPayment(){
  try{
    const d=await api('/payment/retry/'+currentOrder._id,{method:'POST'});
    const script=document.createElement('script'); script.src='https://checkout.razorpay.com/v1/checkout.js';
    script.onload=()=>{const r=new Razorpay({key:d.keyId,amount:d.amount,currency:d.currency,name:'MEMORA CREATIONS',description:'Retry Online Payment',order_id:d.razorpayOrderId,prefill:{name:currentOrder.customer.fullName,email:currentOrder.customer.email||'',contact:currentOrder.customer.mobile},handler:async response=>{try{const v=await api('/payment/verify',{method:'POST',body:JSON.stringify({...response,orderId:d.orderId,clearCart:false})});location.href='/frontend/order-details.html?id='+v.order._id;}catch(e){toast(e.message,'error');loadOrder();}}});r.on('payment.failed',async()=>{await api('/payment/fail',{method:'POST',body:JSON.stringify({orderId:d.orderId})}).catch(()=>{});toast('Payment failed. You can retry again.','error');loadOrder();});r.open();};
    script.onerror=()=>toast('Razorpay Checkout load नहीं हुआ।','error'); document.head.appendChild(script);
  }catch(e){toast(e.message,'error');}
}
loadOrder().catch(e=>toast(e.message,'error'));
