const router=require('express').Router(); const c=require('../controllers/paymentController'); const {requireUser}=require('../middleware/auth');
router.use(requireUser); router.post('/create-order',c.createOrder); router.post('/verify',c.verify); router.post('/fail',c.fail); router.post('/retry/:id',c.retry); module.exports=router;
