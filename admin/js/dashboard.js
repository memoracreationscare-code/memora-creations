<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Dashboard</title>

  <link rel="stylesheet" href="/memora-creations/admin/css/style.css">
</head>

<body>

<nav class="adminnav">
  <div class="container">
    <b>MEMORA ADMIN</b>

    <a href="/memora-creations/admin/dashboard.html">Dashboard</a>
    <a href="/memora-creations/admin/products.html">Products</a>
    <a href="/memora-creations/admin/orders.html">Orders</a>
    <a href="/memora-creations/admin/users.html">Users</a>

    <button id="logout" class="btn secondary">Logout</button>
  </div>
</nav>

<main class="container adminmain">
  <h1>Dashboard</h1>
  <div id="stats" class="stats"></div>
</main>

<script src="/memora-creations/frontend/js/app.js"></script>
<script src="/memora-creations/admin/js/auth.js"></script>
<script src="/memora-creations/admin/js/dashboard.js"></script>

</body>
</html>
