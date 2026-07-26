import { useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { Package, BriefcaseBusiness, Store, ArrowRight } from "lucide-react";

export default function FirmUpsellingPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const canManagePackages = Boolean(firmData?.capabilities?.canManageFirmSettings);

  if (loading || !firmData) {
    return (
      <AppLayout title={t("nav.upselling")}>
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  const offers = [
    {
      href: "/packages",
      icon: Package,
      title: t("upselling.packagesTitle"),
      description: t("upselling.packagesHint"),
      adminOnly: true,
    },
    {
      href: "/services",
      icon: BriefcaseBusiness,
      title: t("upselling.servicesTitle"),
      description: t("upselling.servicesHint"),
      adminOnly: false,
    },
  ].filter((o) => !o.adminOnly || canManagePackages);

  return (
    <AppLayout
      title={t("nav.upselling")}
      breadcrumb={[{ label: t("nav.upselling") }]}
    >
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Store className="w-5 h-5" />
            {t("nav.upselling")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("upselling.hint")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {offers.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href}>
              <div className="h-full border border-border rounded-xl p-5 bg-card hover:border-[var(--color-navy)]/40 transition cursor-pointer space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    <p className="font-semibold">{title}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
