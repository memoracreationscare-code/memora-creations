const crypto = require('crypto');
const { asyncHandler, error, ok } = require('../utils/http');
const cloudinary = require('cloudinary').v2;
const { cleanString } = require('../utils/validation');

const signature = asyncHandler(async (req,res)=>{
  if(!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw error(503,'Cloudinary is not configured.');
  cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
  const timestamp=Math.floor(Date.now()/1000); const folder=cleanString(req.body.folder,100)||'memora-creations/products';
  const sig=cloudinary.utils.api_sign_request({timestamp,folder},process.env.CLOUDINARY_API_SECRET);
  return ok(res,{cloudName:process.env.CLOUDINARY_CLOUD_NAME,apiKey:process.env.CLOUDINARY_API_KEY,timestamp,folder,signature:sig});
});
module.exports={signature};
