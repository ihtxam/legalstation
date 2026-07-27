import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ServiceOrderDetail } from "@/components/ServiceOrderDetail";

export default function ClientPortalServicesPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [showCart, setShowCart] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [serviceBrief, setServiceBrief] = useState<Record<number, string>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data: branding } = trpc.firm.branding.useQuery(undefined, { enabled: isAuthenticated });
  const shopServices = trpc.ondemandServices.listPublicForClient.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const cart = trpc.ondemandServices.getCart.useQuery(undefined, { enabled: isAuthenticated });
  const myOrders = trpc.ondemandServices.myOrders.useQuery(undefined, { enabled: isAuthenticated });

  const addToCart = trpc.ondemandServices.addToCart.useMutation({
    onSuccess: async () => {
      toast.success(t("services.addedToCart"));
      await cart.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateCartItem = trpc.ondemandServices.updateCartItem.useMutation({
    onSuccess: async () => {
      await cart.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const checkout = trpc.ondemandServices.checkout.useMutation({
    onSuccess: async (res) => {
      toast.success(
        res.paymentUrl ? t("services.checkoutSuccess") : t("services.checkoutSuccessIntake")
      );
      setShowCart(false);
      setOrderNotes("");
      await Promise.all([cart.refetch(), myOrders.refetch()]);
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else if (res.orderId) {
        setSelectedOrderId(res.orderId);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const cartCount = cart.data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <AppLayout breadcrumb={[{ label: t("nav.services") }]}>
        <Skeleton className="h-64 w-full m-6" />
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumb={[{ label: t("nav.services") }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name || t("settings.logo")}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-[var(--color-navy)]/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[var(--color-navy)]" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("nav.services")}</h1>
              <p className="text-muted-foreground mt-2">
                {branding?.name
                  ? t("portal.servicesSubtitle", { firm: branding.name })
                  : t("portal.servicesSubtitleFallback")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <LanguageSwitcher />
            <Button variant="outline" onClick={() => setShowCart(true)}>
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              {t("services.cart")}
              {cartCount > 0 ? ` (${cartCount})` : ""}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-foreground">{t("services.shopTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("services.shopHint")}</p>
          </div>
          {(shopServices.data || []).length === 0 ? (
            <div className="border border-border rounded-xl p-8 text-center bg-card">
              <p className="text-sm text-muted-foreground">{t("portal.servicesEmpty")}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(shopServices.data || []).map((svc) => (
                <div key={svc.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`services.cat.${svc.category}`)} · {svc.estimatedHours}h
                      </p>
                    </div>
                    <p className="font-semibold text-sm whitespace-nowrap">
                      {Number(svc.price).toFixed(2)} {svc.currency}
                    </p>
                  </div>
                  {svc.description ? (
                    <p className="text-sm text-muted-foreground">{svc.description}</p>
                  ) : null}
                  <Input
                    placeholder={t("services.brief")}
                    value={serviceBrief[svc.id] || ""}
                    onChange={(e) =>
                      setServiceBrief((prev) => ({ ...prev, [svc.id]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={addToCart.isPending}
                    onClick={() =>
                      addToCart.mutate({
                        serviceId: svc.id,
                        quantity: 1,
                        clientBrief: serviceBrief[svc.id]?.trim() || undefined,
                      })
                    }
                  >
                    {t("services.addToCart")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <h3 className="font-semibold text-sm">{t("services.myOrders")}</h3>
            <p className="text-xs text-muted-foreground">{t("services.myOrdersHint")}</p>
          </div>
          {(myOrders.data || []).length === 0 ? (
            <div className="border border-border rounded-xl p-6 text-center bg-card">
              <p className="text-sm text-muted-foreground">{t("portal.ordersEmpty")}</p>
            </div>
          ) : (
            (myOrders.data || []).map(({ order, items }) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedOrderId(order.id)}
                className="w-full text-start border border-border rounded-xl px-4 py-3 text-sm flex flex-wrap justify-between gap-2 bg-card hover:border-[var(--color-navy)]/40 transition"
              >
                <div>
                  <p className="font-medium">
                    {order.orderNumber}{" "}
                    <Badge variant="outline" className="capitalize ms-1">
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                    {order.isLocked ? (
                      <Badge variant="secondary" className="ms-1">
                        {t("services.locked")}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {items.map((i) => i.serviceName).join(", ")}
                  </p>
                  {order.canSubmitIntake ? (
                    <p className="text-xs text-[var(--color-navy)] mt-0.5">
                      {t("services.actionNeededIntake")}
                    </p>
                  ) : null}
                  {order.canRequestRevision ? (
                    <p className="text-xs text-[var(--color-navy)] mt-0.5">
                      {t("services.actionNeededReview")}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm font-medium">
                  {Number(order.subtotal).toFixed(2)} {order.currency}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("services.cart")}</DialogTitle>
          </DialogHeader>
          {(cart.data?.items || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("services.cartEmpty")}</p>
          ) : (
            <div className="space-y-3">
              {(cart.data?.items || []).map((item) => (
                <div key={item.id} className="border rounded-xl p-3 space-y-2">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium text-sm">{item.serviceName}</p>
                    <p className="text-sm">
                      {(Number(item.unitPrice) * item.quantity).toFixed(2)} {item.currency}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">{t("services.quantity")}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-20 h-8"
                      value={item.quantity}
                      onChange={(e) =>
                        updateCartItem.mutate({
                          itemId: item.id,
                          quantity: Math.max(0, parseInt(e.target.value || "0", 10)),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <p className="font-semibold text-sm">
                {Number(cart.data?.order.subtotal || 0).toFixed(2)} {cart.data?.order.currency}
              </p>
              <div>
                <Label>{t("services.orderNotes")}</Label>
                <Textarea
                  className="mt-1.5"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCart(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={checkout.isPending || !(cart.data?.items && cart.data.items.length > 0)}
              onClick={() =>
                checkout.mutate({
                  clientNotes: orderNotes.trim() || undefined,
                })
              }
            >
              {t("services.payAndOrder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServiceOrderDetail
        orderId={selectedOrderId}
        open={selectedOrderId != null}
        onOpenChange={(v) => {
          if (!v) setSelectedOrderId(null);
        }}
        mode="client"
        onChanged={() => {
          void myOrders.refetch();
        }}
      />
    </AppLayout>
  );
}
