
'use strict';

/*
==========================================
 MEMORA CREATIONS
 PROFESSIONAL SALES ANALYTICS — V1

 READ-ONLY DASHBOARD
 - Actual orders (latest 200 maximum)
 - Payment-confirmed sales
 - Sales chart
 - Order status chart
 - Top products
 - Recent orders
 - Date range selection

 Does not modify:
 - Orders
 - Stock
 - Payments
 - Shiprocket
==========================================
*/

(() => {

  const API = '/admin/orders';

  const rupees = value =>
    '₹' + Number(value || 0)
      .toLocaleString('en-IN', {
        maximumFractionDigits: 2
      });

  const safeNumber = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const dateOf = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date;
  };

  const isSale = order =>
    order.paymentStatus === 'SUCCESS' &&
    order.orderStatus !== 'Cancelled';

  let orders = [];
  let period = '30';

  const make = (tag, className, value) => {
    const el = document.createElement(tag);

    if (className) {
      el.className = className;
    }

    if (value !== undefined) {
      el.textContent = String(value);
    }

    return el;
  };


  /* =====================================
     CUSTOM STYLES
  ===================================== */

  function styles() {

    if (document.getElementById(
      'mcSalesAnalyticsStyles'
    )) return;

    const style = make('style');

    style.id = 'mcSalesAnalyticsStyles';

    style.textContent = `
      .mc-sales-area {
        margin: 12px 0 34px;
      }

      .mc-sales-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 19px;
      }

      .mc-sales-head h2 {
        margin: 0;
        font-size: 23px;
      }

      .mc-sales-head p {
        margin: 5px 0 0;
        font-size: 12px;
        color: #817970;
      }

      .mc-sales-select {
        padding: 11px 15px;
        border-radius: 11px;
        border: 1px solid #dfd2c6;
        background: white;
        color: #39261d;
        font-weight: 700;
      }

      .mc-sales-kpis {
        display: grid;
        grid-template-columns: repeat(
          4,minmax(0,1fr)
        );
        gap: 16px;
        margin-bottom: 22px;
      }

      .mc-sales-kpi {
        background: white;
        padding: 22px;
        border-radius: 17px;
        border: 1px solid #eae4dc;
        min-width: 0;
      }

      .mc-sales-kpi small {
        display: block;
        color: #807267;
        margin-bottom: 12px;
      }

      .mc-sales-kpi strong {
        font-size: clamp(22px,2.2vw,31px);
        font-weight: 900;
        color: #302117;
        overflow-wrap: anywhere;
      }

      .mc-sales-kpi:nth-child(2) {
        background: #302117;
      }

      .mc-sales-kpi:nth-child(2) small {
        color: #dbc4b4;
      }

      .mc-sales-kpi:nth-child(2) strong {
        color: white;
      }

      .mc-sales-grid {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: 18px;
        margin-bottom: 18px;
      }

      .mc-sales-panel {
        min-width: 0;
        background: white;
        padding: 23px;
        border: 1px solid #eae4dc;
        border-radius: 18px;
      }

      .mc-sales-panel h3 {
        margin: 0 0 20px;
        font-size: 19px;
      }

      .mc-sales-chart {
        width: 100%;
        min-height: 230px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .mc-sales-chart svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .mc-sales-status-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 11px 0;
        border-bottom: 1px solid #f0eae4;
        font-size: 13px;
      }

      .mc-sales-status-row:last-child {
        border-bottom: 0;
      }

      .mc-sales-status-row strong {
        white-space: nowrap;
      }

      .mc-sales-dot {
        width: 10px;
        height: 10px;
        display: inline-block;
        border-radius: 50%;
        margin-right: 8px;
      }

      .mc-sales-table-wrap {
        overflow-x: auto;
      }

      .mc-sales-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .mc-sales-table th {
        background: #f5eee7;
        text-align: left;
        color: #6d4932;
        padding: 12px;
      }

      .mc-sales-table td {
        padding: 12px;
        border-bottom: 1px solid #eee8e1;
      }

      .mc-sales-table a {
        color: #784b2e;
        text-decoration: none;
        font-weight: 700;
      }

      .mc-sales-empty {
        padding: 30px;
        text-align: center;
        color: #817970;
        font-size: 13px;
      }

      .mc-sales-note {
        margin: 10px 0 0;
        color: #89786c;
        font-size: 11px;
        line-height: 1.6;
      }

      .mc-sales-error {
        border: 1px solid #efb4b4;
        border-radius: 12px;
        padding: 17px;
        background: #fff2f2;
        color: #a12020;
      }

      @media(max-width:1100px) {
        .mc-sales-kpis {
          grid-template-columns: repeat(2,1fr);
        }
        .mc-sales-grid {
          grid-template-columns: 1fr;
        }
      }

      @media(max-width:500px) {
        .mc-sales-kpis {
          gap: 9px;
        }
        .mc-sales-kpi {
          padding: 14px;
        }
        .mc-sales-panel {
          padding: 15px;
        }
      }
    `;

    document.head.appendChild(style);
  }


  /* =====================================
     DATE FILTER
  ===================================== */

  function filteredOrders() {

    const days = Number(period);

    if (!days) {
      return orders;
    }

    const cutoff = new Date();

    cutoff.setDate(
      cutoff.getDate() - days
    );

    return orders.filter(order => {
      const d = dateOf(order.createdAt);
      return d && d >= cutoff;
    });
  }


  /* =====================================
     BUILD DASHBOARD
  ===================================== */

  function createLayout() {

    const existing = document.getElementById(
      'mcSalesAnalytics'
    );

    if (existing) return existing;

    const root = make(
      'section','mc-sales-area'
    );

    root.id = 'mcSalesAnalytics';

    const heading = make(
      'div','mc-sales-head'
    );

    const left = make('div');

    left.append(
      make('h2',null,'Sales Analytics'),
      make(
        'p',
        null,
        'Live order insights and business performance'
      )
    );

    const select = make(
      'select','mc-sales-select'
    );

    select.id = 'mcSalesPeriod';

    [
      ['7','Last 7 Days'],
      ['30','Last 30 Days'],
      ['90','Last 90 Days'],
      ['0','All Available Orders']
    ].forEach(([value,label]) => {
      const option = make(
        'option',null,label
      );

      option.value = value;

      if (value === period) {
        option.selected = true;
      }

      select.appendChild(option);
    });

    select.addEventListener(
      'change',
      () => {
        period = select.value;
        render();
      }
    );

    heading.append(left,select);

    root.appendChild(heading);

    const content = make('div');

    content.id = 'mcSalesContent';

    content.textContent =
      'Loading sales analytics...';

    root.appendChild(content);

    const stats =
      document.getElementById('stats');

    if (stats) {
      stats.after(root);
    } else {
      document.querySelector(
        '.mc-page'
      )?.prepend(root);
    }

    return root;
  }


  /* =====================================
     KPI CARDS
  ===================================== */

  function createKpis(data) {

    const grid = make(
      'div','mc-sales-kpis'
    );

    const sales = data.filter(isSale);

    const revenue = sales.reduce(
      (sum,order) =>
        sum + safeNumber(order.grandTotal),
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

    const metrics = [
      ['Total Orders',data.length],
      ['Confirmed Revenue',rupees(revenue)],
      ['Delivered Orders',delivered],
      ['Cancelled Orders',cancelled]
    ];

    metrics.forEach(([label,value]) => {

      const card = make(
        'div','mc-sales-kpi'
      );

      card.append(
        make('small',null,label),
        make('strong',null,value)
      );

      grid.appendChild(card);
    });

    return grid;
  }


  /* =====================================
     SALES CHART (SVG)
  ===================================== */

  function createSalesChart(data) {

    const panel = make(
      'section','mc-sales-panel'
    );

    panel.appendChild(
      make('h3',null,'Sales Overview')
    );

    const chart = make(
      'div','mc-sales-chart'
    );

    const buckets = new Map();

    for (const order of data) {

      if (!isSale(order)) continue;

      const date = dateOf(order.createdAt);

      if (!date) continue;

      const key = [
        date.getFullYear(),
        String(
          date.getMonth() + 1
        ).padStart(2,'0')
      ].join('-');

      buckets.set(
        key,
        (buckets.get(key) || 0) +
        safeNumber(order.grandTotal)
      );
    }

    const entries = Array.from(
      buckets.entries()
    ).sort(
      (a,b) => a[0].localeCompare(b[0])
    );

    if (!entries.length) {
      chart.appendChild(
        make(
          'p',
          'mc-sales-empty',
          'No confirmed sales in this period.'
        )
      );

      panel.appendChild(chart);
      return panel;
    }

    const width = 680;
    const height = 260;

    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 45;

    const plotWidth =
      width - paddingLeft - paddingRight;

    const plotHeight =
      height - paddingTop - paddingBottom;

    const maxValue = Math.max(
      1,
      ...entries.map(item => item[1])
    );

    const xFor = index =>
      paddingLeft +
      (
        entries.length === 1
          ? plotWidth / 2
          : index * plotWidth /
            (entries.length - 1)
      );

    const yFor = value =>
      paddingTop +
      plotHeight -
      (value / maxValue) * plotHeight;

    const points = entries.map(
      ([key,value],index) => ({
        x:xFor(index),
        y:yFor(value),
        key,
        value
      })
    );

    const ns =
      'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(
      ns,'svg'
    );

    svg.setAttribute(
      'viewBox','0 0 680 260'
    );

    svg.setAttribute(
      'role','img'
    );

    svg.setAttribute(
      'aria-label',
      'Monthly confirmed sales chart'
    );

    const addSvg = (
      tag,attributes,text
    ) => {
      const node =
        document.createElementNS(ns,tag);

      Object.entries(attributes).forEach(
        ([key,value]) =>
          node.setAttribute(key,String(value))
      );

      if (text !== undefined) {
        node.textContent = String(text);
      }

      svg.appendChild(node);

      return node;
    };

    for (let i = 0;i <= 4;i++) {

      const value = maxValue * i / 4;
      const y = yFor(value);

      addSvg('line',{
        x1:paddingLeft,
        y1:y,
        x2:width-paddingRight,
        y2:y,
        stroke:'#eadfd4'
      });

      addSvg('text',{
        x:paddingLeft-9,
        y:y+4,
        'text-anchor':'end',
        fill:'#8a7769',
        'font-size':11
      },rupees(value));
    }

    const path = points.map(
      (p,index) =>
        (index ? 'L' : 'M') +
        p.x + ' ' + p.y
    ).join(' ');

    addSvg('path',{
      d:path,
      fill:'none',
      stroke:'#946343',
      'stroke-width':3,
      'stroke-linecap':'round',
      'stroke-linejoin':'round'
    });

    points.forEach(point => {

      addSvg('circle',{
        cx:point.x,
        cy:point.y,
        r:4,
        fill:'#946343'
      });

      addSvg('text',{
        x:point.x,
        y:height-17,
        'text-anchor':'middle',
        fill:'#77675a',
        'font-size':11
      },point.key.slice(2));
    });

    chart.appendChild(svg);

    panel.appendChild(chart);

    panel.appendChild(
      make(
        'p',
        'mc-sales-note',
        'Monthly totals use successful, ' +
        'non-cancelled orders only.'
      )
    );

    return panel;
  }


  /* =====================================
     ORDER STATUS BREAKDOWN
  ===================================== */

  function createStatusPanel(data) {

    const panel = make(
      'section','mc-sales-panel'
    );

    panel.appendChild(
      make('h3',null,'Order Status')
    );

    const statuses = [
      ['Delivered','#22a559'],
      ['Shipped','#2776df'],
      ['Packed','#ed8b35'],
      ['Confirmed','#e0ae21'],
      ['Order Placed','#966344'],
      ['Out for Delivery','#8b5cf6'],
      ['Cancelled','#a6a6a6']
    ];

    statuses.forEach(([status,color]) => {

      const count = data.filter(
        order =>
          order.orderStatus === status
      ).length;

      const row = make(
        'div','mc-sales-status-row'
      );

      const label = make('span');

      const dot = make(
        'span','mc-sales-dot'
      );

      dot.style.background = color;

      label.append(
        dot,
        document.createTextNode(status)
      );

      row.append(
        label,
        make('strong',null,count)
      );

      panel.appendChild(row);
    });

    return panel;
  }


  /* =====================================
     TOP SELLING PRODUCTS
  ===================================== */

  function createProductsPanel(data) {

    const panel = make(
      'section','mc-sales-panel'
    );

    panel.appendChild(
      make('h3',null,'Top Selling Products')
    );

    const products = new Map();

    data.filter(isSale).forEach(
      order => {

        (order.items || []).forEach(
          item => {

            const key = String(
              item.productId ||
              item.name ||
              'Unknown'
            );

            const existing =
              products.get(key) || {
                name:item.name || 'Product',
                quantity:0,
                revenue:0
              };

            existing.quantity +=
              safeNumber(item.quantity);

            existing.revenue +=
              safeNumber(item.lineTotal);

            products.set(key,existing);
          }
        );
      }
    );

    const top = Array.from(
      products.values()
    ).sort(
      (a,b) => b.quantity - a.quantity
    ).slice(0,5);

    if (!top.length) {
      panel.appendChild(
        make(
          'p',
          'mc-sales-empty',
          'No confirmed product sales yet.'
        )
      );

      return panel;
    }

    const wrap = make(
      'div','mc-sales-table-wrap'
    );

    const table = make(
      'table','mc-sales-table'
    );

    const thead = make('thead');
    const header = make('tr');

    [
      'Product','Units Sold','Item Revenue'
    ].forEach(label => {
      header.append(
        make('th',null,label)
      );
    });

    thead.appendChild(header);

    const tbody = make('tbody');

    top.forEach(item => {

      const row = make('tr');

      [
        item.name,
        item.quantity,
        rupees(item.revenue)
      ].forEach(value => {
        row.append(
          make('td',null,value)
        );
      });

      tbody.appendChild(row);
    });

    table.append(thead,tbody);
    wrap.appendChild(table);
    panel.appendChild(wrap);

    return panel;
  }


  /* =====================================
     RECENT ORDERS
  ===================================== */

  function createRecentOrders(data) {

    const panel = make(
      'section','mc-sales-panel'
    );

    panel.appendChild(
      make('h3',null,'Recent Orders')
    );

    const wrap = make(
      'div','mc-sales-table-wrap'
    );

    const table = make(
      'table','mc-sales-table'
    );

    const header = make('tr');

    [
      'Order ID',
      'Customer',
      'Amount',
      'Payment',
      'Status'
    ].forEach(label => {
      header.append(
        make('th',null,label)
      );
    });

    const thead = make('thead');
    thead.appendChild(header);

    const tbody = make('tbody');

    data.slice(0,5).forEach(order => {

      const row = make('tr');

      const idCell = make('td');
      const link = make(
        'a',
        null,
        order.orderId || 'View Order'
      );

      link.href =
        '/memora-creations/admin/orders.html';

      idCell.appendChild(link);

      row.appendChild(idCell);

      const values = [
        order.customer?.fullName ||
          order.user?.fullName ||
          'Customer',
        rupees(order.grandTotal),
        order.paymentMethod || '-',
        order.orderStatus || '-'
      ];

      values.forEach(value => {
        row.append(
          make('td',null,value)
        );
      });

      tbody.appendChild(row);
    });

    table.append(thead,tbody);
    wrap.appendChild(table);
    panel.appendChild(wrap);

    return panel;
  }


  /* =====================================
     RENDER
  ===================================== */

  function render() {

    const root = document.getElementById(
      'mcSalesContent'
    );

    if (!root) return;

    const data = filteredOrders();

    root.replaceChildren();

    root.appendChild(
      createKpis(data)
    );

    const topGrid = make(
      'div','mc-sales-grid'
    );

    topGrid.append(
      createSalesChart(data),
      createStatusPanel(data)
    );

    root.appendChild(topGrid);

    const bottomGrid = make(
      'div','mc-sales-grid'
    );

    bottomGrid.append(
      createProductsPanel(data),
      createRecentOrders(data)
    );

    root.appendChild(bottomGrid);

    root.appendChild(
      make(
        'p',
        'mc-sales-note',
        'Analytics are calculated from the ' +
        'latest 200 orders returned by the ' +
        'Admin API. Historical totals may be ' +
        'incomplete if more than 200 orders exist. ' +
        'Revenue excludes unpaid and cancelled orders.'
      )
    );
  }


  /* =====================================
     LOAD FROM PROTECTED ADMIN API
  ===================================== */

  async function initialize() {

    styles();
    createLayout();

    const root = document.getElementById(
      'mcSalesContent'
    );

    try {

      if (!window.MC?.api) {
        throw new Error(
          'Admin API is not available.'
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

      orders = response.orders.sort(
        (a,b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );

      render();

    } catch (error) {

      if (root) {
        root.replaceChildren(
          make(
            'div',
            'mc-sales-error',
            'Could not load Sales Analytics: ' +
            (error.message || 'Unknown error')
          )
        );
      }

      console.error(
        'Sales Analytics Error:',
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
