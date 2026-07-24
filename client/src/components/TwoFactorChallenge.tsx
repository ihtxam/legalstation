import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TwoFactorChallenge({ onVerified }: { onVerified: () => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const verify = trpc.auth.verifyTotp.useMutation({
    onSuccess: () => {
      toast.success("Verified");
      onVerified();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-cream,#f8f7f4)] p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("twoFactor.title")}</CardTitle>
          <CardDescription>{t("twoFactor.challenge")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={8}
          />
          <Button
            className="w-full bg-[var(--color-navy)] text-white"
            disabled={code.length < 6 || verify.isPending}
            onClick={() => verify.mutate({ code })}
          >
            {t("twoFactor.verify")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
