require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDatabase = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const profileRoutes = require('./routes/profileRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { webhook } = require('./controllers/paymentController');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5000', credentials: true }));
app.post('/api/payment/webhook', express.raw({type:'application/json', limit:'1mb'}), webhook);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { success:false, message:'Too many requests. Please try again later.' } });
app.use('/api/auth/login', authLimiter); app.use('/api/auth/register', authLimiter); app.use('/api/admin/login', authLimiter); app.use('/api/payment', authLimiter);

app.get('/api/health', (_req,res)=>res.json({success:true,service:'memora-creations-api',whatsappOrder:false}));
app.use('/api/auth',authRoutes); app.use('/api/products',productRoutes); app.use('/api/cart',cartRoutes); app.use('/api/profile',profileRoutes); app.use('/api/orders',orderRoutes); app.use('/api/payment',paymentRoutes); app.use('/api/admin',adminRoutes);
app.use(express.static(path.join(__dirname,'..')));
app.use('/api',(_req,res)=>res.status(404).json({success:false,message:'API route not found.'}));
app.use((err,_req,res,_next)=>{ console.error(err); const status=err.statusCode||500; res.status(status).json({success:false,message:status<500?err.message:'Internal server error.'}); });

const port=Number(process.env.PORT||5000);
if(require.main===module){connectDatabase().then(()=>app.listen(port,()=>console.log(`Memora Creations running on port ${port}`))).catch(e=>{console.error(`Startup failed: ${e.message}`);process.exit(1);});}
module.exports=app;
