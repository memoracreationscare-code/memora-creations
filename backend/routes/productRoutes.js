const router = require('express').Router(); const c=require('../controllers/productController');
router.get('/',c.listProducts); router.get('/categories',c.listCategories); router.get('/:id',c.getProduct); module.exports=router;
