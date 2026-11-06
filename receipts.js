/* Receipt images for private TripTogether expenses (no public bucket URLs). */
(function(root){
 'use strict';
 const BUCKET='trip-receipts';
 const MAX_BYTES=5*1024*1024;
 const EXTENSIONS={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 function validate(file){
  if(!file)return 'Vui lòng chọn ảnh hóa đơn.';
  if(!Object.hasOwn(EXTENSIONS,file.type))return 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.';
  if(!file.size||file.size>MAX_BYTES)return 'Ảnh phải có dung lượng từ 1 byte đến 5 MB.';
  return '';
 }
 function makePath(tripId,expenseId,file){
  const err=validate(file);
  if(err)throw new Error(err);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(tripId)||!uuid.test(expenseId))throw new Error('Mã chuyến đi hoặc khoản chi không hợp lệ.');
  return tripId+'/'+expenseId+'/'+crypto.randomUUID()+'.'+EXTENSIONS[file.type];
 }
 async function upload(db,tripId,expenseId,file){
  const path=makePath(tripId,expenseId,file);
  const {error}=await db.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if(error)throw new Error('Không thể tải ảnh hóa đơn lên: '+error.message);
  return path;
 }
 async function signedUrl(db,path){
  if(!path)throw new Error('Khoản chi này chưa có ảnh hóa đơn.');
  const {data,error}=await db.storage.from(BUCKET).createSignedUrl(path,120);
  if(error||!data?.signedUrl)throw new Error('Không thể mở ảnh hóa đơn: '+(error?.message||'Không đủ quyền truy cập'));
  return data.signedUrl;
 }
 async function remove(db,path){
  if(!path)return;
  const {error}=await db.storage.from(BUCKET).remove([path]);
  if(error)throw error;
 }
 root.TripTogetherReceipts={validate,makePath,upload,signedUrl,remove,BUCKET,MAX_BYTES};
})(window);
