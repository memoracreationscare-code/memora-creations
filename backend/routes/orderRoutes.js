const router=require('express').Router(); const c=require('../controllers/orderController'); const {requireUser}=require('../middleware/auth');
router.use(requireUser); router.post('/preview',c.preview); router.post('/cod',c.createCod); router.get('/',c.listOrders); router.get('/:id',c.getOrder); router.patch('/:id/cancel',c.cancelOrder); module.exports=router;
