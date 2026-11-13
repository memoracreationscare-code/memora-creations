
'use strict';

/*
========================================
 MEMORA CREATIONS
 PROFESSIONAL SALES DASHBOARD V2

 - Daily / Weekly / Monthly chart
 - Payment-confirmed revenue
 - Order status donut chart
 - Modern KPI cards
 - Top selling products
 - Recent orders with badges
 - Date filters
 - Mobile responsive
 - Read-only operations

 Existing Cashfree / COD / Shiprocket
 functionality remains untouched.
========================================
*/

(() => {
  const API = '/admin/orders';

  const STATUS = [
    ['Delivered', '#22a559'],
    ['Shipped', '#2878df'],
    ['Packed', '#f28c38'],
    ['Confirmed', '#e8b126'],
    ['Order Placed', '#946343'],
    ['Out for Delivery', '#8b5cf6'],
    ['Cancelled', '#a3a3a3']
  ];

  const currency = value =>
    '₹' + Number(value || 0)
      .toLocaleString('en-IN', {
        maximumFractionDigits: 2
      });

  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const el = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) {
      node.textContent = String(content);
    }
    return node;
  };

  const svgNS = 'http://www.w3.org/2000/svg';

  let allOrders = [];
  let period = '30';
  let grouping = 'daily';

  const paid = order =>
    order.paymentStatus === 'SUCCESS' &&
    order.orderStatus !== 'Cancelled';

  function orderDate(order) {
    const d = new Date(order.createdAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function inRange() {
    if (period === 'all') return allOrders;

    const days = Number(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return allOrders.filter(order => {
      const date = orderDate(order);
      return date && date >= cutoff;
    });
  }

  /* =====================================
     PROFESSIONAL STYLES
  ===================================== */

  function installStyles() {
    if (document.getElementById('mcSalesV2CSS')) {
      return;
    }

    const style = el('style');
    style.id = 'mcSalesV2CSS';

    style.textContent = `
      #mcSalesAnalytics {
        margin: 10px 0 34px;
        font-family: inherit;
      }

      .mc-v2-heading {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        flex-wrap:wrap;
        margin-bottom:20px;
      }

      .mc-v2-heading h2 {
        font-size:25px;
        margin:0 0 6px;
        color:#302117;
      }

      .mc-v2-heading p {
        margin:0;
        font-size:13px;
        color:#83786e;
      }

      .mc-v2-select {
        background:white;
        border:1px solid #e1d5ca;
        border-radius:12px;
        padding:12px 15px;
        color:#39291e;
        font-weight:750;
        cursor:pointer;
      }

      .mc-v2-kpis {
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:16px;
        margin-bottom:20px;
      }

      .mc-v2-kpi {
        background:#fff;
        border:1px solid #eae0d6;
        border-radius:17px;
        padding:22px;
        min-width:0;
        box-shadow:0 6px 24px rgba(49,30,16,.035);
      }

      .mc-v2-kpi-top {
        display:flex;
        align-items:center;
        gap:12px;
        margin-bottom:14px;
      }

      .mc-v2-kpi-icon {
        display:flex;
        width:45px;
        height:45px;
        align-items:center;
        justify-content:center;
        border-radius:13px;
        background:#f8eadb;
        font-size:23px;
        flex-shrink:0;
      }

      .mc-v2-kpi small {
        color:#85786d;
        font-size:12px;
        font-weight:700;
      }

      .mc-v2-kpi strong {
        display:block;
        font-size:clamp(22px,2.4vw,31px);
        line-height:1.3;
        color:#2d1d15;
        font-weight:900;
        overflow-wrap:anywhere;
      }

      .mc-v2-kpi-note {
        display:block;
        font-size:11px;
        color:#938477;
        margin-top:8px;
      }

      .mc-v2-kpis .mc-v2-kpi:nth-child(2) {
        background:#302117;
        border-color:#302117;
      }

      .mc-v2-kpis .mc-v2-kpi:nth-child(2) small,
      .mc-v2-kpis .mc-v2-kpi:nth-child(2)
      .mc-v2-kpi-note {
        color:#d8c1af;
      }

      .mc-v2-kpis .mc-v2-kpi:nth-child(2) strong {
        color:#fff;
      }

      .mc-v2-grid {
        display:grid;
        grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);
        gap:18px;
        margin-bottom:18px;
      }

      .mc-v2-panel {
        background:white;
        border:1px solid #eae0d6;
        border-radius:19px;
        padding:23px;
        min-width:0;
        box-shadow:0 6px 24px rgba(49,30,16,.035);
      }

      .mc-v2-panel-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:20px;
      }

      .mc-v2-panel h3 {
        font-size:19px;
        font-weight:850;
        margin:0;
        color:#302117;
      }

      .mc-v2-tabs {
        display:flex;
        gap:4px;
        padding:4px;
        background:#f6f0e9;
        border-radius:11px;
      }

      .mc-v2-tab {
        border:0;
        padding:9px 12px;
        font-size:12px;
        background:transparent;
        color:#795f4f;
        border-radius:8px;
        cursor:pointer;
        font-weight:750;
      }

      .mc-v2-tab.active {
        color:#fff;
        background:#946343;
      }

      .mc-v2-chart {
        width:100%;
        min-height:245px;
      }

      .mc-v2-chart svg {
        display:block;
        width:100%;
        height:auto;
      }

      .mc-v2-note {
        color:#938579;
        font-size:11px;
        line-height:1.6;
        margin:13px 0 0;
      }

      .mc-v2-donut-wrap {
        display:flex;
        align-items:center;
        gap:23px;
      }

      .mc-v2-donut {
        width:185px;
        height:185px;
        border-radius:50%;
        position:relative;
        flex-shrink:0;
        display:flex;
        align-items:center;
        justify-content:center;
      }

      .mc-v2-donut-inner {
        width:115px;
        height:115px;
        background:white;
        border-radius:50%;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        position:relative;
        z-index:1;
      }

      .mc-v2-donut-inner strong {
        font-size:29px;
        color:#302117;
      }

      .mc-v2-donut-inner span {
        color:#8d7c6b;
        font-size:12px;
      }

      .mc-v2-legend {
        flex:1;
        min-width:0;
      }

      .mc-v2-legend-row {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:9px;
        padding:8px 0;
        border-bottom:1px solid #f2ede8;
        font-size:12px;
      }

      .mc-v2-legend-name {
        display:flex;
        align-items:center;
        gap:8px;
        min-width:0;
      }

      .mc-v2-dot {
        width:10px;
        height:10px;
        border-radius:50%;
        flex-shrink:0;
      }

      .mc-v2-table-scroll {
        overflow-x:auto;
      }

      .mc-v2-table {
        width:100%;
        border-collapse:collapse;
        font-size:12px;
      }

      .mc-v2-table th {
        background:#f6f0e9;
        color:#674833;
        padding:13px 10px;
        text-align:left;
        white-space:nowrap;
      }

      .mc-v2-table td {
        padding:13px 10px;
        border-bottom:1px solid #eee7e0;
        vertical-align:middle;
      }

      .mc-v2-table a {
        color:#815239;
        font-weight:800;
        text-decoration:none;
      }

      .mc-v2-badge {
        display:inline-flex;
        align-items:center;
        padding:6px 9px;
        border-radius:999px;
        font-size:10px;
        font-weight:800;
        white-space:nowrap;
      }

      .mc-v2-delivered {
        background:#e4f7eb;
        color:#13723a;
      }

      .mc-v2-cancelled {
        background:#fce8e8;
        color:#a52323;
      }

      .mc-v2-pending {
        background:#fff1dc;
        color:#975718;
      }

      .mc-v2-shipped {
        background:#e5f0ff;
        color:#245fbc;
      }

      .mc-v2-pay {
        background:#eee9fa;
        color:#6541a0;
      }

      .mc-v2-empty {
        text-align:center;
        padding:38px 15px;
        color:#918174;
        font-size:13px;
      }

      .mc-v2-error {
        background:#fff0f0;
        color:#a52b2b;
        border:1px solid #efbcbc;
        border-radius:13px;
        padding:17px;
      }

      @media(max-width:1200px) {
        .mc-v2-kpis {
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .mc-v2-grid {
          grid-template-columns:1fr;
        }
      }

      @media(max-width:650px) {
        .mc-v2-panel {
          padding:16px;
        }

        .mc-v2-kpis {
          gap:10px;
        }

        .mc-v2-kpi {
          padding:15px;
        }

        .mc-v2-kpi strong {
          font-size:22px;
        }

        .mc-v2-donut-wrap {
          flex-direction:column;
        }

        .mc-v2-legend {
          width:100%;
        }

        .mc-v2-tab {
          padding:8px;
          font-size:11px;
        }
      }
    `;

    document.head.appendChild(style);
  }


  /* =====================================
     DASHBOARD LOCATION
  ===================================== */

  function createShell() {
    let section = document.getElementById(
      'mcSalesAnalytics'
    );

    if (section) return section;

    section = el('section');
    section.id = 'mcSalesAnalytics';

    const heading = el('div','mc-v2-heading');

    const headingText = el('div');

    headingText.append(
      el('h2',null,'Sales Analytics'),
      el(
        'p',
        null,
        'Professional business insights'
      )
    );

    const select = el(
      'select',
      'mc-v2-select'
    );

    select.id = 'mcV2Period';

    [
      ['7','Last 7 Days'],
      ['30','Last 30 Days'],
      ['90','Last 90 Days'],
      ['all','All Available Orders']
    ].forEach(([value,label]) => {
      const option = el(
        'option',null,label
      );

      option.value = value;
      option.selected = value === period;

      select.appendChild(option);
    });

    select.addEventListener(
      'change',
      () => {
        period = select.value;
        render();
      }
    );

    heading.append(headingText,select);

    const content = el('div');
    content.id = 'mcV2Content';

    content.textContent =
      'Loading sales analytics...';

    section.append(heading,content);

    const stats = document.getElementById(
      'stats'
    );

    if (stats) {
      stats.after(section);
    } else {
      document.querySelector(
        '.mc-page'
      )?.prepend(section);
    }

    return section;
  }


  /* =====================================
     KPI CARDS
  ===================================== */

  function createKpis(data) {
    const grid = el('div','mc-v2-kpis');

    const successful = data.filter(paid);

    const revenue = successful.reduce(
      (sum,order) =>
        sum + num(order.grandTotal),
      0
    );

    const delivered = data.filter(
      order =>
        order.orderStatus === 'Delivered'
    ).length;

    const cancelled = data.filter(
      order =>
        order.orderStatus === 'Cancelled'
    ).length;

    const cards = [
      {
        icon:'🛒',
        name:'Total Orders',
        value:data.length,
        note:'Orders in selected period'
      },
      {
        icon:'💰',
        name:'Confirmed Revenue',
        value:currency(revenue),
        note:'Successful payments only'
      },
      {
        icon:'📦',
        name:'Delivered Orders',
        value:delivered,
        note:'Delivered order count'
      },
      {
        icon:'↩️',
        name:'Cancelled Orders',
        value:cancelled,
        note:'Cancelled order count'
      }
    ];

    cards.forEach(item => {
      const card = el(
        'article',
        'mc-v2-kpi'
      );

      const top = el(
        'div',
        'mc-v2-kpi-top'
      );

      const icon = el(
        'span',
        'mc-v2-kpi-icon',
        item.icon
      );

      top.append(
        icon,
        el('small',null,item.name)
      );

      card.append(
        top,
        el('strong',null,item.value),
        el(
          'span',
          'mc-v2-kpi-note',
          item.note
        )
      );

      grid.appendChild(card);
    });

    return grid;
  }


  /* =====================================
     DATE BUCKET HELPERS
  ===================================== */

  function dateKey(date) {
    return [
      date.getFullYear(),
      String(
        date.getMonth() + 1
      ).padStart(2,'0'),
      String(
        date.getDate()
      ).padStart(2,'0')
    ].join('-');
  }

  function bucketKey(date) {
    if (grouping === 'monthly') {
      return dateKey(date).slice(0,7);
    }

    if (grouping === 'weekly') {
      const d = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );

      const day = (d.getDay() + 6) % 7;

      d.setDate(d.getDate() - day);

      return dateKey(d);
    }

    return dateKey(date);
  }


  /* =====================================
     SVG SALES CHART
  ===================================== */

  function createSalesChart(data) {
    const panel = el(
      'section',
      'mc-v2-panel'
    );

    const header = el(
      'div',
      'mc-v2-panel-header'
    );

    header.appendChild(
      el('h3',null,'📈 Sales Overview')
    );

    const tabs = el(
      'div',
      'mc-v2-tabs'
    );

    [
      ['daily','Daily'],
      ['weekly','Weekly'],
      ['monthly','Monthly']
    ].forEach(([value,label]) => {
      const button = el(
        'button',
        'mc-v2-tab',
        label
      );

      button.type = 'button';

      if (grouping === value) {
        button.classList.add('active');
      }

      button.addEventListener(
        'click',
        () => {
          grouping = value;
          render();
        }
      );

      tabs.appendChild(button);
    });

    header.appendChild(tabs);
    panel.appendChild(header);

    const chart = el(
      'div',
      'mc-v2-chart'
    );

    const map = new Map();

    data.filter(paid).forEach(order => {
      const d = orderDate(order);
      if (!d) return;

      const key = bucketKey(d);

      map.set(
        key,
        (map.get(key) || 0) +
        num(order.grandTotal)
      );
    });

    const entries = Array.from(
      map.entries()
    ).sort(
      (a,b) => a[0].localeCompare(b[0])
    );

    if (!entries.length) {
      chart.appendChild(
        el(
          'p',
          'mc-v2-empty',
          'No confirmed sales in this period.'
        )
      );

      panel.appendChild(chart);
      return panel;
    }

    const width = 700;
    const height = 290;
    const left = 70;
    const right = 22;
    const top = 20;
    const bottom = 52;

    const plotW = width - left - right;
    const plotH = height - top - bottom;

    const maximum = Math.max(
      1,
      ...entries.map(item => item[1])
    );

    const x = index =>
      left + (
        entries.length === 1
          ? plotW / 2
          : index * plotW /
            (entries.length - 1)
      );

    const y = value =>
      top + plotH -
      value / maximum * plotH;

    const points = entries.map(
      ([key,value],index) => ({
        key,
        value,
        x:x(index),
        y:y(value)
      })
    );

    const svg = document.createElementNS(
      svgNS,'svg'
    );

    svg.setAttribute(
      'viewBox',
      `0 0 ${width} ${height}`
    );

    svg.setAttribute(
      'role',
      'img'
    );

    svg.setAttribute(
      'aria-label',
      `${grouping} confirmed sales graph`
    );

    const addSvg = (tag,attrs,text) => {
      const node = document.createElementNS(
        svgNS,tag
      );

      Object.entries(attrs).forEach(
        ([key,value]) =>
          node.setAttribute(
            key,String(value)
          )
      );

      if (text !== undefined) {
        node.textContent = String(text);
      }

      svg.appendChild(node);
      return node;
    };

    for (let i = 0;i <= 4;i++) {
      const amount = maximum * i / 4;
      const yy = y(amount);

      addSvg('line',{
        x1:left,
        y1:yy,
        x2:width-right,
        y2:yy,
        stroke:'#ece5de',
        'stroke-width':1
      });

      addSvg('text',{
        x:left-9,
        y:yy+4,
        fill:'#918074',
        'text-anchor':'end',
        'font-size':11
      },currency(amount));
    }

    const path = points.map(
      (point,index) =>
        (index ? 'L' : 'M') +
        point.x + ' ' + point.y
    ).join(' ');

    addSvg('path',{
      d:path,
      fill:'none',
      stroke:'#946343',
      'stroke-width':3,
      'stroke-linejoin':'round',
      'stroke-linecap':'round'
    });

    points.forEach((point,index) => {

      addSvg('circle',{
        cx:point.x,
        cy:point.y,
        r:4.5,
        fill:'#946343',
        stroke:'#fff',
        'stroke-width':1.5
      });

      const showLabel =
        entries.length <= 8 ||
        index % Math.ceil(
          entries.length / 7
        ) === 0 ||
        index === entries.length - 1;

      if (showLabel) {
        addSvg('text',{
          x:point.x,
          y:height-19,
          'text-anchor':'middle',
          fill:'#857468',
          'font-size':10
        },point.key.slice(5));
      }
    });

    chart.appendChild(svg);
    panel.appendChild(chart);

    panel.appendChild(
      el(
        'p',
        'mc-v2-note',
        'Only SUCCESS payments from ' +
        'non-cancelled orders count as sales.'
      )
    );

    return panel;
  }


  /* =====================================
     ORDER STATUS DONUT
  ===================================== */

  function createDonut(data) {
    const panel = el(
      'section',
      'mc-v2-panel'
    );

    const header = el(
      'div',
      'mc-v2-panel-header'
    );

    header.appendChild(
      el('h3',null,'🎯 Order Status')
    );

    panel.appendChild(header);

    const wrap = el(
      'div',
      'mc-v2-donut-wrap'
    );

    const donut = el(
      'div',
      'mc-v2-donut'
    );

    const total = data.length;

    let start = 0;

    const segments = STATUS.map(
      ([status,color]) => {
        const count = data.filter(
          order =>
            order.orderStatus === status
        ).length;

        const portion = total
          ? count / total * 100
          : 0;

        const end = start + portion;

        const segment =
          `${color} ${start}% ${end}%`;

        start = end;

        return {
          status,
          color,
          count,
          segment
        };
      }
    );

    donut.style.background = total
      ? `conic-gradient(${
          segments.map(
            item => item.segment
          ).join(',')
        })`
      : '#e8e2dc';

    const inner = el(
      'div',
      'mc-v2-donut-inner'
    );

    inner.append(
      el('strong',null,total),
      el('span',null,'Orders')
    );

    donut.appendChild(inner);

    const legend = el(
      'div',
      'mc-v2-legend'
    );

    segments.forEach(item => {
      const row = el(
        'div',
        'mc-v2-legend-row'
      );

      const label = el(
        'span',
        'mc-v2-legend-name'
      );

      const dot = el(
        'span',
        'mc-v2-dot'
      );

      dot.style.background = item.color;

      label.append(
        dot,
        document.createTextNode(
          item.status
        )
      );

      const percentage = total
        ? (item.count / total * 100)
          .toFixed(1)
        : '0.0';

      row.append(
        label,
        el(
          'strong',
          null,
          `${item.count} (${percentage}%)`
        )
      );

      legend.appendChild(row);
    });

    wrap.append(donut,legend);
    panel.appendChild(wrap);

    return panel;
  }


  /* =====================================
     TOP SELLING PRODUCTS
  ===================================== */

  function createProducts(data) {
    const panel = el(
      'section',
      'mc-v2-panel'
    );

    const heading = el(
      'div',
      'mc-v2-panel-header'
    );

    heading.appendChild(
      el('h3',null,'🏆 Top Selling Products')
    );

    panel.appendChild(heading);

    const products = new Map();

    data.filter(paid).forEach(order => {

      (order.items || []).forEach(item => {
        const key = String(
          item.productId ||
          item.name ||
          'Unknown'
        );

        const current =
          products.get(key) || {
            name:item.name || 'Product',
            units:0,
            revenue:0
          };

        current.units += num(
          item.quantity
        );

        current.revenue += num(
          item.lineTotal
        );

        products.set(key,current);
      });
    });

    const top = Array.from(
      products.values()
    ).sort(
      (a,b) => b.units - a.units
    ).slice(0,5);

    if (!top.length) {
      panel.appendChild(
        el(
          'p',
          'mc-v2-empty',
          'No confirmed product sales yet.'
        )
      );

      return panel;
    }

    const scroll = el(
      'div',
      'mc-v2-table-scroll'
    );

    const table = el(
      'table',
      'mc-v2-table'
    );

    const head = el('thead');
    const tr = el('tr');

    [
      'Product',
      'Units Sold',
      'Item Revenue'
    ].forEach(value =>
      tr.appendChild(
        el('th',null,value)
      )
    );

    head.appendChild(tr);

    const body = el('tbody');

    top.forEach(item => {
      const row = el('tr');

      [
        item.name,
        item.units,
        currency(item.revenue)
      ].forEach(value =>
        row.appendChild(
          el('td',null,value)
        )
      );

      body.appendChild(row);
    });

    table.append(head,body);
    scroll.appendChild(table);
    panel.appendChild(scroll);

    return panel;
  }


  /* =====================================
     RECENT ORDERS
  ===================================== */

  function createRecent(data) {
    const panel = el(
      'section',
      'mc-v2-panel'
    );

    const heading = el(
      'div',
      'mc-v2-panel-header'
    );

    heading.appendChild(
      el('h3',null,'🕒 Recent Orders')
    );

    panel.appendChild(heading);

    const scroll = el(
      'div',
      'mc-v2-table-scroll'
    );

    const table = el(
      'table',
      'mc-v2-table'
    );

    const head = el('thead');
    const headRow = el('tr');

    [
      'Order ID',
      'Customer',
      'Amount',
      'Payment',
      'Status'
    ].forEach(value =>
      headRow.appendChild(
        el('th',null,value)
      )
    );

    head.appendChild(headRow);

    const body = el('tbody');

    data.slice(0,5).forEach(order => {

      const row = el('tr');

      const idCell = el('td');

      const link = el(
        'a',
        null,
        order.orderId || 'View'
      );

      link.href =
        '/admin/orders.html';

      idCell.appendChild(link);
      row.appendChild(idCell);

      row.appendChild(
        el(
          'td',
          null,
          order.customer?.fullName ||
          order.user?.fullName ||
          'Customer'
        )
      );

      row.appendChild(
        el(
          'td',
          null,
          currency(order.grandTotal)
        )
      );

      const payment = el('td');

      const paymentBadge = el(
        'span',
        'mc-v2-badge mc-v2-pay',
        order.paymentMethod || '-'
      );

      payment.appendChild(paymentBadge);
      row.appendChild(payment);

      const statusCell = el('td');

      const status =
        order.orderStatus || '-';

      let statusClass = 'mc-v2-pending';

      if (status === 'Delivered') {
        statusClass = 'mc-v2-delivered';
      } else if (status === 'Cancelled') {
        statusClass = 'mc-v2-cancelled';
      } else if (
        status === 'Shipped' ||
        status === 'Out for Delivery'
      ) {
        statusClass = 'mc-v2-shipped';
      }

      statusCell.appendChild(
        el(
          'span',
          'mc-v2-badge ' + statusClass,
          status
        )
      );

      row.appendChild(statusCell);
      body.appendChild(row);
    });

    if (!data.length) {
      const row = el('tr');
      const cell = el(
        'td',
        'mc-v2-empty',
        'No orders in this period.'
      );

      cell.colSpan = 5;
      row.appendChild(cell);
      body.appendChild(row);
    }

    table.append(head,body);
    scroll.appendChild(table);
    panel.appendChild(scroll);

    return panel;
  }


  /* =====================================
     RENDER DASHBOARD
  ===================================== */

  function render() {
    const content = document.getElementById(
      'mcV2Content'
    );

    if (!content) return;

    const data = inRange();

    content.replaceChildren();

    content.appendChild(
      createKpis(data)
    );

    const first = el(
      'div',
      'mc-v2-grid'
    );

    first.append(
      createSalesChart(data),
      createDonut(data)
    );

    const second = el(
      'div',
      'mc-v2-grid'
    );

    second.append(
      createProducts(data),
      createRecent(data)
    );

    content.append(first,second);

    content.appendChild(
      el(
        'p',
        'mc-v2-note',
        'Analytics use up to the latest ' +
        '200 orders from the Admin API. ' +
        'For more than 200 orders, this ' +
        'report is not a complete historical ' +
        'sales report. Confirmed revenue ' +
        'excludes cancelled orders and ' +
        'payments not marked SUCCESS.'
      )
    );
  }


  /* =====================================
     LOAD VERIFIED ADMIN DATA
  ===================================== */

  async function initialize() {
    installStyles();
    createShell();

    try {
      if (
        !window.MC ||
        typeof window.MC.api !== 'function'
      ) {
        throw new Error(
          'Admin API unavailable.'
        );
      }

      const response = await window.MC.api(
        API
      );

      if (!Array.isArray(response.orders)) {
        throw new Error(
          'Orders API returned invalid data.'
        );
      }

      allOrders = response.orders.sort(
        (a,b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );

      render();

    } catch (error) {
      const content = document.getElementById(
        'mcV2Content'
      );

      if (content) {
        content.replaceChildren(
          el(
            'div',
            'mc-v2-error',
            'Could not load Sales Analytics: ' +
            (error.message || 'Unknown error')
          )
        );
      }

      console.error(
        'Sales Dashboard V2:',
        error
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once:true }
    );
  } else {
    initialize();
  }

})();
