-- ============================================================
--  Crow's Case — สคีมาฐานข้อมูลสำหรับ Supabase
--  วิธีใช้: เปิด Supabase → SQL Editor → วางไฟล์นี้ทั้งหมด → Run
--  รันซ้ำได้ (idempotent)
-- ============================================================

-- ------------------------------------------------------------
-- 1) ตาราง
--    ทุกตารางเก็บข้อมูลจริงไว้ในคอลัมน์ data (jsonb)
--    ทำให้เพิ่ม/แก้ฟิลด์ในแอปได้โดยไม่ต้องแก้สคีมาบ่อย ๆ
-- ------------------------------------------------------------
create table if not exists public.staff (
  id          text primary key,              -- = auth.users.id ของพนักงานคนนั้น
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.settings (
  id          text primary key,              -- ใช้ค่าเดียวคือ 'main'
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.products (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.sales (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.orders (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.stock_logs (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.activity (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ดัชนีช่วยเรียงตามเวลา
create index if not exists sales_ts_idx      on public.sales      ((data->>'ts') desc);
create index if not exists orders_ts_idx     on public.orders     ((data->>'ts') desc);
create index if not exists activity_ts_idx   on public.activity   ((data->>'ts') desc);
create index if not exists stock_logs_ts_idx on public.stock_logs ((data->>'ts') desc);

-- ------------------------------------------------------------
-- 2) ฟังก์ชันตรวจสิทธิ์
--    security definer เพื่อไม่ให้เกิด recursion ตอน RLS อ่านตาราง staff
-- ------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid()::text
      and coalesce((s.data->>'active')::boolean, false)
  );
$$;

create or replace function public.is_owner()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid()::text
      and coalesce((s.data->>'active')::boolean, false)
      and s.data->>'role' = 'owner'
  );
$$;

-- ------------------------------------------------------------
-- 3) เปิด Row Level Security ทุกตาราง
-- ------------------------------------------------------------
alter table public.staff      enable row level security;
alter table public.settings   enable row level security;
alter table public.products   enable row level security;
alter table public.sales      enable row level security;
alter table public.orders     enable row level security;
alter table public.stock_logs enable row level security;
alter table public.activity   enable row level security;

-- ล้าง policy เดิมก่อน (ให้รันซ้ำได้)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('staff','settings','products','sales','orders','stock_logs','activity')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------- สินค้า: ลูกค้าทั่วไปอ่านได้ (หน้าเว็บร้าน) / เขียนได้เฉพาะพนักงาน ----------
create policy products_read_all   on public.products for select using (true);
create policy products_write      on public.products for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- ตั้งค่าเว็บไซต์: อ่านได้ทุกคน / เขียนได้เฉพาะพนักงาน ----------
create policy settings_read_all   on public.settings for select using (true);
create policy settings_write      on public.settings for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- ออเดอร์ออนไลน์: ลูกค้า "สร้าง" ได้อย่างเดียว อ่าน/แก้ได้เฉพาะพนักงาน ----------
create policy orders_insert_public on public.orders for insert with check (true);
create policy orders_read_staff    on public.orders for select using (public.is_staff());
create policy orders_update_staff  on public.orders for update
  using (public.is_staff()) with check (public.is_staff());
create policy orders_delete_staff  on public.orders for delete using (public.is_staff());

-- ---------- ยอดขาย / บันทึกสต๊อก / บันทึกกิจกรรม: เฉพาะพนักงาน ----------
create policy sales_staff      on public.sales      for all
  using (public.is_staff()) with check (public.is_staff());
create policy stock_logs_staff on public.stock_logs for all
  using (public.is_staff()) with check (public.is_staff());
create policy activity_staff   on public.activity   for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------- บัญชีพนักงาน ----------
-- พนักงานทุกคนอ่านรายชื่อได้ (ใช้แสดงชื่อผู้ขายในบิล)
create policy staff_read        on public.staff for select using (public.is_staff());
-- แก้ไขข้อมูลตัวเองได้ (เช่น อัปเดตเวลาเข้าระบบล่าสุด)
create policy staff_update_self on public.staff for update
  using (id = auth.uid()::text) with check (id = auth.uid()::text);
-- เฉพาะเจ้าของร้านเท่านั้นที่สร้าง/แก้/ลบบัญชีคนอื่นได้
create policy staff_insert_owner on public.staff for insert with check (public.is_owner());
create policy staff_update_owner on public.staff for update
  using (public.is_owner()) with check (public.is_owner());
create policy staff_delete_owner on public.staff for delete using (public.is_owner());
-- ให้ผู้ใช้ที่เพิ่งล็อกอินอ่านแถวของตัวเองได้ (ก่อนที่ is_staff() จะเป็นจริง)
create policy staff_read_self   on public.staff for select using (id = auth.uid()::text);

-- ------------------------------------------------------------
-- 4) เปิด Realtime
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['staff','settings','products','sales','orders','stock_logs','activity']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ส่งข้อมูลแถวเดิมมาด้วยเวลาลบ/แก้ (ช่วยให้แอปรู้ว่าลบแถวไหน)
alter table public.staff      replica identity full;
alter table public.settings   replica identity full;
alter table public.products   replica identity full;
alter table public.sales      replica identity full;
alter table public.orders     replica identity full;
alter table public.stock_logs replica identity full;
alter table public.activity   replica identity full;

-- ============================================================
--  5) สร้างบัญชีเจ้าของร้านคนแรก
-- ============================================================
--  ขั้นที่ 1  Supabase → Authentication → Users → "Add user"
--            ใส่อีเมลและรหัสผ่านของคุณ  (ติ๊ก Auto Confirm User ด้วย)
--  ขั้นที่ 2  คัดลอก UID ของผู้ใช้นั้นมาแทนที่ 'PASTE-USER-UID-HERE'
--            แล้วรันคำสั่งด้านล่าง
--
--  insert into public.staff (id, data) values (
--    'PASTE-USER-UID-HERE',
--    jsonb_build_object(
--      'id',        'PASTE-USER-UID-HERE',
--      'email',     'you@example.com',
--      'username',  'admin',
--      'name',      'ผู้ดูแลระบบ',
--      'phone',     '',
--      'role',      'owner',
--      'menus',     jsonb_build_array('overview','pos','history','stock','orders','staff','settings','logs'),
--      'actions',   jsonb_build_array('product.create','product.edit','product.price','product.delete',
--                                     'stock.adjust','sale.discount','sale.void','order.manage',
--                                     'report.cost','data.export'),
--      'active',    true,
--      'createdAt', now()
--    )
--  )
--  on conflict (id) do update set data = excluded.data;
--
--  ขั้นที่ 3  Authentication → Providers → Email
--            ปิด "Confirm email" เพื่อให้สร้างบัญชีพนักงานจากในแอปได้ทันที
-- ============================================================
