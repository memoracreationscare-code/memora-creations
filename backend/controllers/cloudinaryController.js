const crypto = require('crypto');
const { asyncHandler, error, ok } = require('../utils/http');
const cloudinary = require('cloudinary').v2;
const { cleanString } = require('../utils/validation');

/*
  Product photos are fitted INTO a 1200x1200 square: the whole picture is kept
  (nothing is cropped), small photos are not blown up, and the empty space is
  filled with the picture's own main colour. Done by Cloudinary while uploading.
*/
const FIT_PRODUCT = 'c_lpad,w_1200,h_1200,b_auto:predominant';
const PRODUCT_FOLDER = 'memora-creations/products';

const signature = asyncHandler(async (req,res)=>{
  if(!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw error(503,'Cloudinary is not configured.');
  cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
  const timestamp=Math.floor(Date.now()/1000); const folder=cleanString(req.body.folder,100)||'memora-creations/products';
  const params={timestamp,folder};
  if(folder===PRODUCT_FOLDER && req.body.fit===true) params.transformation=FIT_PRODUCT;
  const sig=cloudinary.utils.api_sign_request(params,process.env.CLOUDINARY_API_SECRET);
  return ok(res,{cloudName:process.env.CLOUDINARY_CLOUD_NAME,apiKey:process.env.CLOUDINARY_API_KEY,timestamp,folder,transformation:params.transformation||null,signature:sig});
});
module.exports={signature,FIT_PRODUCT};
