import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, ArrowRight, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function OnboardingPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [firmName, setFirmName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vatNumber, setVatNumber] = useState("");

  const { data: firmData, isLoading: firmLoading } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const createFirm = trpc.firm.create.useMutation({
    onSuccess: () => { toast.success("Firm created successfully!"); navigate("/firm-onboarding"); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
    if (!firmLoading && firmData) {
      navigate(firmData.firm.onboardingCompletedAt ? "/dashboard" : "/firm-onboarding");
    }
  }, [isAuthenticated, loading, firmData, firmLoading, navigate]);

  if (loading || firmLoading) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-navy)] mb-4">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">Set up your firm</h1>
          <p className="text-muted-foreground text-sm">Create your LexFlow workspace to get started.</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <Label htmlFor="firmName">Firm name <span className="text-destructive">*</span></Label>
            <Input id="firmName" className="mt-1.5" placeholder="e.g. Müller & Partner AG" value={firmName} onChange={e => setFirmName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" className="mt-1.5" placeholder="Bahnhofstrasse 1, 8001 Zürich" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" className="mt-1.5" placeholder="info@firm.ch" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" className="mt-1.5" placeholder="+41 44 000 00 00" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="vat">VAT/UID Number</Label>
            <Input id="vat" className="mt-1.5" placeholder="CHE-123.456.789 MWST" value={vatNumber} onChange={e => setVatNumber(e.target.value)} />
          </div>
          <Button
            className="w-full bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white mt-2"
            disabled={!firmName.trim() || createFirm.isPending}
            onClick={() => createFirm.mutate({ name: firmName, address, email: email || undefined, phone, vatNumber })}
          >
            {createFirm.isPending ? "Creating…" : "Create workspace"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
