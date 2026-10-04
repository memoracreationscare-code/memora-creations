const router=require('express').Router(); const c=require('../controllers/profileController'); const {requireUser}=require('../middleware/auth');
router.use(requireUser); router.get('/',c.getProfile); router.put('/',c.updateProfile); router.post('/addresses',c.addAddress); router.put('/addresses/:id',c.updateAddress); router.delete('/addresses/:id',c.deleteAddress); module.exports=router;
