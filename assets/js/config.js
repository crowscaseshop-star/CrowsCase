/* ============================================================
   config.js — ตั้งค่าการเชื่อมต่อ Supabase
   ------------------------------------------------------------
   ค่าด้านล่างคือ Project URL และ anon (publishable) key
   ซึ่งออกแบบมาให้ฝังในหน้าเว็บได้อย่างปลอดภัย
   ความปลอดภัยจริงคุมด้วย Row Level Security ในฐานข้อมูล
   (ดูนโยบายทั้งหมดได้ที่ supabase/schema.sql)

   ห้ามนำ service_role key มาใส่ในไฟล์นี้เด็ดขาด
   เพราะ key นั้นข้ามทุกสิทธิ์ และไฟล์นี้เปิดเผยต่อสาธารณะ

   ถ้าต้องการกลับไปใช้งานแบบออฟไลน์ ให้เปลี่ยนทั้งสองค่าเป็นค่าว่าง ''
   ============================================================ */
window.CC_CONFIG = {
  SUPABASE_URL: 'https://ihzgtlsivjuapfnugdnw.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloemd0bHNpdmp1YXBmbnVnZG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODAxMzMsImV4cCI6MjEwMzc1NjEzM30.3Btsp-Sut3hZKhgK03G5D46oJrv85oImSnS8BRR8U30'
};
