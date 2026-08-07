-- =====================================================================
-- Flfluencer — إصلاحات أمنية  ·  7 أغسطس 2026
-- ⚠️ يُنفَّذ في SQL Editor لمشروع فلفلونسر chpzecgpylxqsutjydkb فقط.
--
-- الترتيب مقصود: المرحلة الأولى آمنة مع الكود المنشور حالياً وتُنفَّذ فوراً.
-- المرحلة الثانية تعتمد على ملفات الكود المرفقة — نفّذها بعد رفعها فقط.
--
-- كل عبارة قابلة للتراجع؛ عبارات التراجع في آخر الملف.
-- =====================================================================


-- =====================================================================
-- المرحلة ١ — آمنة الآن (لا تحتاج أي تغيير في الكود المنشور)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) إغلاق تسريب بيانات المستخدمين  [حرج]
--
-- المشكلة: سياسة authenticated_read_users شرطها USING (true)، فأي مستخدم
-- مسجّل يقرأ جدول users كاملاً بما فيه الآيبان والجوال والإيميل.
--
-- الحل: قفل على مستوى الأعمدة لا الصفوف. الصفوف نفسها لازم تبقى مقروءة
-- لأن الشركة تحتاج تقرأ صفوف المعلنين (المطابقة في notifications.js
-- والانضمامات users!fk في لوحات الشركة)، لكن لا أحد يحتاج
-- الإيميل/الجوال/الواتساب/الآيبان/اسم البنك/اسم صاحب الحساب من المتصفح:
--   • بيانات البنك تُقرأ عبر get_my_bank() — دالة SECURITY DEFINER مقيّدة بصاحبها
--   • وسائل التواصل تُقرأ عبر simbl_app_contacts() و simbl_deal_contacts()
-- تحقّقت أن لا سطر واحد في المتصفح يقرأ هذه الأعمدة مباشرة ولا يستخدم select('*').
-- ---------------------------------------------------------------------
DO $mig$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
    AND column_name NOT IN ('email','phone','whatsapp','iban','bank_name','account_holder');

  EXECUTE 'REVOKE SELECT ON public.users FROM anon, authenticated';
  EXECUTE 'GRANT SELECT (' || cols || ') ON public.users TO anon, authenticated';
  RAISE NOTICE 'أعمدة مسموح بقراءتها: %', cols;
END
$mig$;


-- ---------------------------------------------------------------------
-- 2) delete_content_file — أي شخص يحذف أي فيديو حملة  [حرج]
--
-- الدالة كانت SECURITY DEFINER بلا أي تحقق، و anon يقدر ينفّذها،
-- ومخزن content مقروء للعموم فتخمين المسارات سهل.
--
-- مسار الملف هو <application_id>_<epoch>.<ext> — لا يحوي معرّف مستخدم،
-- فالتفويض لازم يمرّ عبر جدول applications لا عبر اسم الملف.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_content_file(p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $fn$
DECLARE
  v_app uuid;
  v_me  uuid;
  v_org uuid;
  v_ok  boolean;
BEGIN
  BEGIN
    v_app := split_part(p_path, '_', 1)::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'bad path';
  END;

  SELECT id, org_id INTO v_me, v_org FROM public.users WHERE auth_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.campaigns c ON c.id = a.campaign_id
    WHERE a.id = v_app
      AND (
            a.creator_id = v_me                                   -- المعلن صاحب الملف
         OR c.brand_id   = v_me                                   -- الشركة صاحبة الحملة
         OR (v_org IS NOT NULL AND c.brand_id IN (                -- زميل في نفس المنظمة
               SELECT u2.id FROM public.users u2 WHERE u2.org_id = v_org))
      )
  ) INTO v_ok;

  IF NOT v_ok THEN RAISE EXCEPTION 'not authorized'; END IF;

  DELETE FROM storage.objects WHERE bucket_id = 'content' AND name = p_path;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.delete_content_file(text) FROM anon;


-- ---------------------------------------------------------------------
-- 3) simbl_redeem_code — نقل أي مستخدم لمنظمة أخرى (IDOR)  [عالي]
--
-- p_user كان يأتي من المستدعي ولا يُقارن بـ auth.uid().
-- نُبقي التوقيع كما هو حتى لا تنكسر مواضع الاستدعاء، ونتجاهل p_user.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.simbl_redeem_code(p_user uuid, p_code text)
RETURNS TABLE(out_org uuid, out_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v_org uuid; v_role text; v_me uuid;
BEGIN
  SELECT id INTO v_me FROM public.users WHERE auth_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT c.org_id, c.role INTO v_org, v_role
  FROM public.org_codes c
  WHERE c.code = upper(btrim(p_code)) AND c.is_active;

  IF v_org IS NULL THEN RAISE EXCEPTION 'INVALID_CODE'; END IF;

  UPDATE public.users SET org_id = v_org, org_role = v_role WHERE id = v_me;

  IF v_role = 'owner' THEN
    UPDATE public.organizations SET owner_id = v_me WHERE id = v_org AND owner_id IS NULL;
  END IF;

  out_org := v_org; out_role := v_role; RETURN NEXT;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.simbl_redeem_code(uuid, text) FROM anon;


-- ---------------------------------------------------------------------
-- 4) منع إنشاء صفوف مستخدمين وهمية  [عالي]
--
-- سياسة "allow signup insert" شرطها WITH CHECK (true) ومفتوحة لـ anon،
-- فزائر غير مسجّل يقدر يحقن صفوفاً بأي دور وأي حالة اعتماد.
--
-- لا نقدر نحذفها ونكتفي بـ users_can_insert_self، لأن تأكيد البريد مفعّل
-- فلا توجد جلسة وقت الإدراج و auth.uid() تكون NULL — التسجيل كله ينكسر.
--
-- البديل: نشترط أن الصف يقابل مستخدم auth حقيقياً بنفس البريد،
-- وأن حالة الاعتماد تبدأ pending دائماً.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_matches(p_auth_id uuid, p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'auth'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = p_auth_id AND lower(au.email) = lower(btrim(p_email))
  );
$fn$;

DROP POLICY IF EXISTS "allow signup insert" ON public.users;

CREATE POLICY signup_insert_verified ON public.users
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (
        auth_id IS NOT NULL
    AND public.auth_user_matches(auth_id, email)
    AND coalesce(approval_status, 'pending') = 'pending'
  );

-- ⚠️ اختبرها قبل الاعتماد عليها — نفّذ هذا داخل معاملة وتراجع عنها:
--   BEGIN;
--   SET LOCAL ROLE anon;
--   INSERT INTO public.users (auth_id, email, name, role, approval_status)
--   VALUES (gen_random_uuid(), 'attacker@example.com', 'x', 'brand', 'approved');
--   -- المتوقع: new row violates row-level security policy
--   ROLLBACK;


-- ---------------------------------------------------------------------
-- 5) سحب صلاحية التنفيذ من anon عن الدوال الداخلية
--    (مستشار Supabase يرصدها: "Public Can Execute SECURITY DEFINER")
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.run_waitlist_replace(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_snapshot(uuid)         FROM anon;
-- ملاحظة: public_creator و get_snapshot و simbl_email_exists و waitlist_position
-- تبقى متاحة لـ anon عن قصد — صفحات عامة تعتمد عليها.


-- ---------------------------------------------------------------------
-- 6) تثبيت search_path على الدوال (82 تحذيراً في مستشار Supabase)
-- ---------------------------------------------------------------------
DO $mig$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', r.sig);
  END LOOP;
END
$mig$;


-- =====================================================================
-- المرحلة ٢ — نفّذها بعد رفع ملفات الكود المرفقة فقط
-- =====================================================================

-- ---------------------------------------------------------------------
-- 7) إخفاء السعر المبدئي للمعلن عن بقية المستخدمين
--
-- users.price هو السعر السري الذي يبني عليه وكيل التفاوض. حالياً أي
-- مستخدم مسجّل يقدر يقرأ أسعار كل المعلنين عبر users?select=price.
--
-- ⚠️ لا تنفّذ هذا القسم قبل رفع login.html و profile.html المعدّلتين،
-- وإلا انكسر تسجيل الدخول (login.html يقرأ price للصف الشخصي مباشرة).
-- ---------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.my_price()
-- RETURNS integer LANGUAGE sql SECURITY DEFINER STABLE SET search_path TO 'public'
-- AS $fn$ SELECT price FROM public.users WHERE auth_id = auth.uid() $fn$;
--
-- DO $mig$
-- DECLARE cols text;
-- BEGIN
--   SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='users'
--     AND column_name NOT IN ('email','phone','whatsapp','iban','bank_name','account_holder','price');
--   EXECUTE 'REVOKE SELECT ON public.users FROM anon, authenticated';
--   EXECUTE 'GRANT SELECT ('||cols||') ON public.users TO anon, authenticated';
-- END $mig$;


-- ---------------------------------------------------------------------
-- 8) منع حقن الإشعارات باسم المنصة
--
-- سياسة auth_insert_notifications شرطها WITH CHECK (true)، فأي مستخدم
-- يرسل إشعاراً لأي مستخدم آخر بأي عنوان ورابط — أداة تصيّد جاهزة.
--
-- ⚠️ الأربعة وعشرون موضع استدعاء لـ createNotification كلها تكتب لطرف آخر،
-- وفان-آوت الحملة الجديدة (notifications.js:536) يخاطب معلنين لا تربطهم
-- بالشركة أي علاقة بعد. لذلك التشديد يحتاج دالة وسيطة أولاً.
-- نفّذه بعد رفع notifications.js المعدّلة.
-- ---------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.notify_user(p_user uuid, p_type text, p_title text, p_message text, p_link text)
-- RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $fn$
-- DECLARE v_me uuid; v_ok boolean;
-- BEGIN
--   SELECT id INTO v_me FROM public.users WHERE auth_id = auth.uid();
--   IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
--   IF p_link IS NOT NULL AND p_link !~ '^/[^/]' THEN RAISE EXCEPTION 'bad link'; END IF;
--   SELECT EXISTS (
--     SELECT 1 FROM public.applications a JOIN public.campaigns c ON c.id=a.campaign_id
--     WHERE (a.creator_id=p_user AND c.brand_id=v_me) OR (c.brand_id=p_user AND a.creator_id=v_me)
--   ) INTO v_ok;
--   IF NOT v_ok AND p_user <> v_me THEN RAISE EXCEPTION 'not authorized'; END IF;
--   INSERT INTO public.notifications (user_id, type, title, message, link)
--   VALUES (p_user, p_type, p_title, p_message, p_link);
-- END $fn$;
--
-- DROP POLICY IF EXISTS auth_insert_notifications ON public.notifications;


-- =====================================================================
-- التراجع (لو انكسر شيء)
-- =====================================================================
-- GRANT SELECT ON public.users TO anon, authenticated;
-- DROP POLICY IF EXISTS signup_insert_verified ON public.users;
-- CREATE POLICY "allow signup insert" ON public.users
--   AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
-- GRANT EXECUTE ON FUNCTION public.delete_content_file(text) TO anon;
-- GRANT EXECUTE ON FUNCTION public.simbl_redeem_code(uuid, text) TO anon;


-- =====================================================================
-- تحقّق بعد التنفيذ
-- =====================================================================
-- (أ) لا سياسات مفتوحة على users/notifications:
--   SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
--   WHERE schemaname='public' AND tablename IN ('users','notifications');
--
-- (ب) الأعمدة الحساسة ممنوعة:
--   SELECT column_name, has_column_privilege('authenticated','public.users',column_name,'SELECT') AS readable
--   FROM information_schema.columns WHERE table_schema='public' AND table_name='users'
--   ORDER BY readable, column_name;
--   -- المتوقع: iban / bank_name / account_holder / email / phone / whatsapp = false
--
-- (ج) الدوال الخطرة لم تعد متاحة لـ anon:
--   SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
--   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN
--     ('delete_content_file','simbl_redeem_code','admin_delete_user','run_waitlist_replace');
