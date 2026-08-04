-- ============================================================
-- فلفلونسر — نظام المدفوعات عبر ميسر (Moyasar)
-- ⚠️ ينفَّذ في SQL Editor لمشروع فلفلونسر chpzecgpylxqsutjydkb فقط
-- النموذج: الشركة تدفع للمنصة قيمة الصفقات المعتمدة (ضمان)،
-- والمنصة تحوّل للمعلنين بنكياً — الكتابة على الجداول من السيرفر فقط.
-- ============================================================

-- 1) عمود «مدفوع للمنصة» على الصفقة
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS platform_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS platform_paid_at timestamp with time zone;

-- 2) سجل المدفوعات
CREATE TABLE IF NOT EXISTS public.payments_gateway (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL,
  application_ids uuid[] NOT NULL DEFAULT '{}',
  amount_halalas bigint NOT NULL CHECK (amount_halalas > 0),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','paid','failed','canceled')),
  moyasar_invoice_id text,
  moyasar_payment_id text,
  description text,
  raw jsonb,
  created_at timestamp with time zone DEFAULT now(),
  paid_at timestamp with time zone
);
CREATE INDEX IF NOT EXISTS payments_gateway_campaign_idx ON public.payments_gateway(campaign_id);
CREATE INDEX IF NOT EXISTS payments_gateway_brand_idx ON public.payments_gateway(brand_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_invoice_idx ON public.payments_gateway(moyasar_invoice_id) WHERE moyasar_invoice_id IS NOT NULL;

ALTER TABLE public.payments_gateway ENABLE ROW LEVEL SECURITY;

-- القراءة: الشركة تشوف مدفوعاتها فقط. الكتابة: السيرفر فقط (service_role يتجاوز RLS)
DROP POLICY IF EXISTS brand_read_own_payments ON public.payments_gateway;
CREATE POLICY brand_read_own_payments ON public.payments_gateway
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (brand_id IN (SELECT users.id FROM users WHERE users.auth_id = auth.uid()));

-- 3) دالة تجهيز مبلغ الدفع (تُستدعى من السيرفر بمفتاح الخدمة):
--    ترجع الصفقات المعتمدة غير المدفوعة للمنصة ومجموعها
CREATE OR REPLACE FUNCTION public.campaign_unpaid_summary(p_campaign_id uuid)
RETURNS TABLE (application_id uuid, creator_id uuid, amount integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.creator_id, COALESCE(a.final_price, a.price)::integer
  FROM applications a
  WHERE a.campaign_id = p_campaign_id
    AND a.status = 'closed'
    AND a.brand_approved = true
    AND a.platform_paid = false;
$$;
