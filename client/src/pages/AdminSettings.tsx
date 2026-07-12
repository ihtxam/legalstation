import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function AdminSettings() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [adyenApiKey, setAdyenApiKey] = useState("");
  const [adyenMerchantAccount, setAdyenMerchantAccount] = useState("");
  const [adyenClientKey, setAdyenClientKey] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [standardVat, setStandardVat] = useState("7.7");
  const [reducedVat, setReducedVat] = useState("3.7");
  const [specialVat, setSpecialVat] = useState("2.5");
  const [zeroVat, setZeroVat] = useState("0");

  // Check if user is superadmin
  useEffect(() => {
    if (user && user.role !== "superadmin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Queries
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();

  // Mutations
  const updateAdyenMutation = trpc.settings.updateAdyen.useMutation({
    onSuccess: () => {
      toast.success("Adyen settings updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateLogoMutation = trpc.settings.updateLogo.useMutation({
    onSuccess: () => {
      toast.success("Logo updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateVatMutation = trpc.settings.updateVatRates.useMutation({
    onSuccess: () => {
      toast.success("VAT rates updated");
    },
    onError: (err) => toast.error(err.message),
  });

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setAdyenApiKey(settings.adyen_api_key || "");
      setAdyenMerchantAccount(settings.adyen_merchant_account || "");
      setAdyenClientKey(settings.adyen_client_key || "");
      setLogoUrl(settings.logo_url || "");
      try {
        const vatRates = JSON.parse(settings.vat_rates || "{}");
        setStandardVat(vatRates.standard?.toString() || "7.7");
        setReducedVat(vatRates.reduced?.toString() || "3.7");
        setSpecialVat(vatRates.special?.toString() || "2.5");
        setZeroVat(vatRates.zero?.toString() || "0");
      } catch (e) {
        // Use defaults
      }
    }
  }, [settings]);

  if (!user || user.role !== "superadmin") {
    return <div className="p-8 text-center">Unauthorized</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground">Configure payment processors, branding, and tax settings</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Tabs defaultValue="adyen" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="adyen">Adyen</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="tax">Tax</TabsTrigger>
          </TabsList>

          {/* Adyen Settings */}
          <TabsContent value="adyen">
            <Card>
              <CardHeader>
                <CardTitle>Adyen Payment Processor</CardTitle>
                <CardDescription>Configure your Adyen account for payment processing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="adyenApiKey">API Key</Label>
                  <Input
                    id="adyenApiKey"
                    type="password"
                    value={adyenApiKey}
                    onChange={(e) => setAdyenApiKey(e.target.value)}
                    placeholder="Your Adyen API key"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Found in Adyen Dashboard → Developers → API credentials
                  </p>
                </div>
                <div>
                  <Label htmlFor="adyenMerchantAccount">Merchant Account</Label>
                  <Input
                    id="adyenMerchantAccount"
                    value={adyenMerchantAccount}
                    onChange={(e) => setAdyenMerchantAccount(e.target.value)}
                    placeholder="Your merchant account ID"
                  />
                </div>
                <div>
                  <Label htmlFor="adyenClientKey">Client Key</Label>
                  <Input
                    id="adyenClientKey"
                    type="password"
                    value={adyenClientKey}
                    onChange={(e) => setAdyenClientKey(e.target.value)}
                    placeholder="Your Adyen client key"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used for frontend payment requests</p>
                </div>
                <Button
                  onClick={() =>
                    updateAdyenMutation.mutate({
                      apiKey: adyenApiKey,
                      merchantAccount: adyenMerchantAccount,
                      clientKey: adyenClientKey,
                    })
                  }
                  disabled={updateAdyenMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateAdyenMutation.isPending ? "Saving..." : "Save Adyen Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Settings */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>Agency Branding</CardTitle>
                <CardDescription>Customize your agency logo and appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used on invoices and client documents</p>
                </div>
                {logoUrl && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">Preview</p>
                    <img src={logoUrl} alt="Logo preview" className="h-16 object-contain" />
                  </div>
                )}
                <Button
                  onClick={() => updateLogoMutation.mutate({ logoUrl })}
                  disabled={updateLogoMutation.isPending || !logoUrl}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateLogoMutation.isPending ? "Saving..." : "Save Logo"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tax Settings */}
          <TabsContent value="tax">
            <Card>
              <CardHeader>
                <CardTitle>Swiss VAT Rates</CardTitle>
                <CardDescription>Configure VAT rates for invoices (Switzerland)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="standardVat">Standard Rate (%)</Label>
                    <Input
                      id="standardVat"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={standardVat}
                      onChange={(e) => setStandardVat(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Default: 7.7%</p>
                  </div>
                  <div>
                    <Label htmlFor="reducedVat">Reduced Rate (%)</Label>
                    <Input
                      id="reducedVat"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={reducedVat}
                      onChange={(e) => setReducedVat(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Default: 3.7%</p>
                  </div>
                  <div>
                    <Label htmlFor="specialVat">Special Rate (%)</Label>
                    <Input
                      id="specialVat"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={specialVat}
                      onChange={(e) => setSpecialVat(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Default: 2.5%</p>
                  </div>
                  <div>
                    <Label htmlFor="zeroVat">Zero Rate (%)</Label>
                    <Input
                      id="zeroVat"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={zeroVat}
                      onChange={(e) => setZeroVat(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Default: 0%</p>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    updateVatMutation.mutate({
                      standardRate: parseFloat(standardVat),
                      reducedRate: parseFloat(reducedVat),
                      specialRate: parseFloat(specialVat),
                      zeroRate: parseFloat(zeroVat),
                    })
                  }
                  disabled={updateVatMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateVatMutation.isPending ? "Saving..." : "Save VAT Rates"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
