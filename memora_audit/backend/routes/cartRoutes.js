const router=require('express').Router(); const c=require('../controllers/cartController'); const {requireUser}=require('../middleware/auth');
router.use(requireUser); router.get('/',c.getCart); router.post('/',c.addItem); router.put('/:id',c.updateItem); router.delete('/:id',c.removeItem); module.exports=router;
