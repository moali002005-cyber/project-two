-- ============================================================
-- فلفلونسر — هجرة التكافؤ مع سيمبل (مرفقات + كود الخصم + الفيديو الجاهز)
-- تُنفَّذ في SQL Editor لمشروع chpzecgpylxqsutjydkb فقط — آمنة لإعادة التشغيل
-- ============================================================

-- 1) أعمدة الحملات
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'shipping';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS product_url text;

-- 2) قيد نوع الحملة يشمل «فيديو جاهز»
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_campaign_type_check
  CHECK (campaign_type = ANY (ARRAY['home'::text, 'visit'::text, 'video'::text]));

-- 3) مخزون أكواد الخصم
CREATE TABLE IF NOT EXISTS public.campaign_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  code text NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  assigned_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (campaign_id, code)
);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_codes_one_per_app
  ON public.campaign_codes(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_codes_campaign_idx ON public.campaign_codes(campaign_id);
ALTER TABLE public.campaign_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_manage_campaign_codes ON public.campaign_codes;
CREATE POLICY brand_manage_campaign_codes ON public.campaign_codes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (campaign_id IN (
    SELECT c.id FROM campaigns c
    WHERE c.brand_id IN (SELECT users.id FROM users WHERE users.auth_id = auth.uid())))
  WITH CHECK (campaign_id IN (
    SELECT c.id FROM campaigns c
    WHERE c.brand_id IN (SELECT users.id FROM users WHERE users.auth_id = auth.uid())));

DROP POLICY IF EXISTS creator_read_own_code ON public.campaign_codes;
CREATE POLICY creator_read_own_code ON public.campaign_codes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (application_id IN (
    SELECT a.id FROM applications a
    WHERE a.creator_id IN (SELECT users.id FROM users WHERE users.auth_id = auth.uid())));

-- 4) دالة التوزيع الذرّي + تريغر الاعتماد
CREATE OR REPLACE FUNCTION public.assign_campaign_code(p_application_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_app applications%ROWTYPE;
  v_mode text; v_title text;
  v_code_id uuid; v_code text;
  v_is_brand boolean;
BEGIN
  SELECT * INTO v_app FROM applications WHERE id = p_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'APP_NOT_FOUND'; END IF;
  SELECT fulfillment_mode, title INTO v_mode, v_title FROM campaigns WHERE id = v_app.campaign_id;
  IF v_mode IS DISTINCT FROM 'code' THEN RETURN NULL; END IF;
  SELECT EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = v_app.campaign_id
      AND c.brand_id IN (SELECT u.id FROM users u WHERE u.auth_id = auth.uid())
  ) INTO v_is_brand;
  IF NOT v_is_brand THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  SELECT code INTO v_code FROM campaign_codes WHERE application_id = p_application_id;
  IF FOUND THEN RETURN v_code; END IF;
  SELECT id, code INTO v_code_id, v_code
    FROM campaign_codes
   WHERE campaign_id = v_app.campaign_id AND application_id IS NULL
   ORDER BY created_at, id
   FOR UPDATE SKIP LOCKED
   LIMIT 1;
  IF v_code_id IS NULL THEN RAISE EXCEPTION 'NO_CODES_LEFT'; END IF;
  UPDATE campaign_codes SET application_id = p_application_id, assigned_at = now() WHERE id = v_code_id;
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (v_app.creator_id, 'code_assigned', '🎁 وصلك كود المنتج',
          COALESCE(v_title, 'حملة') || ': كودك الخاص ' || v_code ||
          ' — افتح صفقتك لتشوف رابط المنتج وخطوات الطلب.', '/creator.html');
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public.trg_assign_code_on_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.brand_approved = true AND COALESCE(OLD.brand_approved, false) = false THEN
    PERFORM assign_campaign_code(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS assign_code_on_approval ON public.applications;
CREATE TRIGGER assign_code_on_approval
  AFTER UPDATE OF brand_approved ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_code_on_approval();

-- 5) سلة مرفقات البريف (صور + فيديو حتى 50MB) وسياساتها — طبق سياسات سيمبل حرفياً
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brief-files', 'brief-files', false, 52428800,
        ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS brief_files_insert ON storage.objects;
CREATE POLICY brief_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'brief-files'::text) AND (EXISTS ( SELECT 1 FROM campaigns c
    WHERE (((c.id)::text = (storage.foldername(objects.name))[1])
      AND ((c.brand_id IN ( SELECT u.id FROM users u WHERE (u.auth_id = auth.uid())))
        OR my_perm_on(c.brand_id, 'campaigns'::text))))));

DROP POLICY IF EXISTS brief_files_update ON storage.objects;
CREATE POLICY brief_files_update ON storage.objects FOR UPDATE TO authenticated
  USING ((bucket_id = 'brief-files'::text) AND (EXISTS ( SELECT 1 FROM campaigns c
    WHERE (((c.id)::text = (storage.foldername(objects.name))[1])
      AND ((c.brand_id IN ( SELECT u.id FROM users u WHERE (u.auth_id = auth.uid())))
        OR my_perm_on(c.brand_id, 'campaigns'::text))))));

DROP POLICY IF EXISTS brief_files_delete ON storage.objects;
CREATE POLICY brief_files_delete ON storage.objects FOR DELETE TO authenticated
  USING ((bucket_id = 'brief-files'::text) AND (EXISTS ( SELECT 1 FROM campaigns c
    WHERE (((c.id)::text = (storage.foldername(objects.name))[1])
      AND ((c.brand_id IN ( SELECT u.id FROM users u WHERE (u.auth_id = auth.uid())))
        OR my_perm_on(c.brand_id, 'campaigns'::text))))));

DROP POLICY IF EXISTS brief_files_read ON storage.objects;
CREATE POLICY brief_files_read ON storage.objects FOR SELECT TO authenticated
  USING ((bucket_id = 'brief-files'::text) AND (
    (EXISTS ( SELECT 1 FROM campaigns c
      WHERE (((c.id)::text = (storage.foldername(objects.name))[1])
        AND (c.brand_id IN ( SELECT my_workspace_brand_ids() AS my_workspace_brand_ids)))))
    OR (EXISTS ( SELECT 1 FROM applications a
      WHERE (((a.campaign_id)::text = (storage.foldername(objects.name))[1])
        AND (a.brand_approved = true)
        AND (a.creator_id IN ( SELECT u.id FROM users u WHERE (u.auth_id = auth.uid()))))))
    OR is_platform_admin()));

-- 6) توسيع أنواع الإشعارات (code_assigned لحملات الكود + platform_paid لإشعار الدفع)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['new_campaign'::text, 'new_application'::text, 'new_message'::text,
    'workflow_update'::text, 'deal_closed'::text, 'deal_approved'::text, 'deal_rejected'::text,
    'payment_marked'::text, 'campaign_full'::text, 'waitlist_promoted'::text, 'profile_reminder'::text,
    'code_assigned'::text, 'platform_paid'::text]));
