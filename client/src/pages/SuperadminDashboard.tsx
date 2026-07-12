import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit2, Pause, RotateCcw } from "lucide-react";

export default function SuperadminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [showCreateFirm, setShowCreateFirm] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);

  // Check if user is superadmin
  useEffect(() => {
    if (user && !user.email?.endsWith("@lexflow.io")) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Queries
  const { data: firms, isLoading: firmsLoading, refetch: refetchFirms } = trpc.superadmin.listFirms.useQuery();
  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = trpc.superadmin.listPlans.useQuery();

  // Mutations
  const createFirmMutation = trpc.superadmin.createFirm.useMutation({
    onSuccess: () => {
      toast.success("Firm created successfully");
      setShowCreateFirm(false);
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });

  const createPlanMutation = trpc.superadmin.createPlan.useMutation({
    onSuccess: () => {
      toast.success("Plan created successfully");
      setShowCreatePlan(false);
      refetchPlans();
    },
    onError: (err) => toast.error(err.message),
  });

  const suspendFirmMutation = trpc.superadmin.suspendFirm.useMutation({
    onSuccess: () => {
      toast.success("Firm suspended");
      refetchFirms();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreateFirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createFirmMutation.mutate({
      name: formData.get("firmName") as string,
      email: formData.get("firmEmail") as string,
      address: formData.get("firmAddress") as string,
      phone: formData.get("firmPhone") as string,
      vatNumber: formData.get("vatNumber") as string,
      planId: parseInt(formData.get("planId") as string),
      billingCycle: (formData.get("billingCycle") as "monthly" | "yearly") || "monthly",
    });
  };

  const handleCreatePlan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPlanMutation.mutate({
      name: formData.get("planName") as string,
      description: formData.get("planDescription") as string,
      maxUsers: parseInt(formData.get("maxUsers") as string),
      monthlyPrice: parseFloat(formData.get("monthlyPrice") as string),
      yearlyPrice: parseFloat(formData.get("yearlyPrice") as string),
      features: (formData.get("features") as string).split(",").map((f) => f.trim()),
    });
  };

  if (!user?.email?.endsWith("@lexflow.io")) {
    return <div className="p-8 text-center">Unauthorized</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">LexFlow Superadmin</h1>
          <p className="text-muted-foreground">Manage law firms and subscription plans</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Firms Section */}
        <div className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Law Firms</h2>
              <p className="text-muted-foreground">Manage merchant accounts and subscriptions</p>
            </div>
            <Dialog open={showCreateFirm} onOpenChange={setShowCreateFirm}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Firm
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Firm</DialogTitle>
                  <DialogDescription>Add a new law firm to the platform</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateFirm} className="space-y-4">
                  <div>
                    <Label htmlFor="firmName">Firm Name</Label>
                    <Input id="firmName" name="firmName" required />
                  </div>
                  <div>
                    <Label htmlFor="firmEmail">Firm Email</Label>
                    <Input id="firmEmail" name="firmEmail" type="email" required />
                  </div>
                  <div>
                    <Label htmlFor="firmAddress">Address</Label>
                    <Input id="firmAddress" name="firmAddress" />
                  </div>
                  <div>
                    <Label htmlFor="firmPhone">Phone</Label>
                    <Input id="firmPhone" name="firmPhone" />
                  </div>
                  <div>
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input id="vatNumber" name="vatNumber" />
                  </div>
                  <div>
                    <Label htmlFor="planId">Subscription Plan</Label>
                    <Select name="planId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans?.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id.toString()}>
                            {plan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="billingCycle">Billing Cycle</Label>
                    <Select name="billingCycle" defaultValue="monthly">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={createFirmMutation.isPending}>
                    {createFirmMutation.isPending ? "Creating..." : "Create Firm"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {firmsLoading ? (
            <div className="text-center py-8">Loading firms...</div>
          ) : firms && firms.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firm Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing Cycle</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firms.map((firm) => (
                    <TableRow key={firm.id}>
                      <TableCell className="font-medium">{firm.name}</TableCell>
                      <TableCell>{firm.email}</TableCell>
                      <TableCell>
                        {plans?.find((p) => p.id === firm.subscription?.planId)?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            firm.subscription?.status === "active"
                              ? "default"
                              : firm.subscription?.status === "suspended"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {firm.subscription?.status || "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{firm.subscription?.billingCycle || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => suspendFirmMutation.mutate({ firmId: firm.id })}
                            disabled={firm.subscription?.status === "suspended"}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No firms yet. Create one to get started.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Plans Section */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Subscription Plans</h2>
              <p className="text-muted-foreground">Manage global subscription tiers</p>
            </div>
            <Dialog open={showCreatePlan} onOpenChange={setShowCreatePlan}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Plan</DialogTitle>
                  <DialogDescription>Add a new subscription plan</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreatePlan} className="space-y-4">
                  <div>
                    <Label htmlFor="planName">Plan Name</Label>
                    <Input id="planName" name="planName" placeholder="e.g., Starter" required />
                  </div>
                  <div>
                    <Label htmlFor="planDescription">Description</Label>
                    <Input id="planDescription" name="planDescription" />
                  </div>
                  <div>
                    <Label htmlFor="maxUsers">Max Users</Label>
                    <Input id="maxUsers" name="maxUsers" type="number" min="1" required />
                  </div>
                  <div>
                    <Label htmlFor="monthlyPrice">Monthly Price (CHF)</Label>
                    <Input id="monthlyPrice" name="monthlyPrice" type="number" step="0.01" required />
                  </div>
                  <div>
                    <Label htmlFor="yearlyPrice">Yearly Price (CHF)</Label>
                    <Input id="yearlyPrice" name="yearlyPrice" type="number" step="0.01" required />
                  </div>
                  <div>
                    <Label htmlFor="features">Features (comma-separated)</Label>
                    <Input
                      id="features"
                      name="features"
                      placeholder="e.g., Case management, Document storage, Messaging"
                    />
                  </div>
                  <Button type="submit" disabled={createPlanMutation.isPending}>
                    {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {plansLoading ? (
            <div className="text-center py-8">Loading plans...</div>
          ) : plans && plans.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Max Users</p>
                      <p className="text-2xl font-bold">{plan.maxUsers}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly</p>
                        <p className="font-semibold">CHF {parseFloat(plan.monthlyPrice as any).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Yearly</p>
                        <p className="font-semibold">CHF {parseFloat(plan.yearlyPrice as any).toFixed(2)}</p>
                      </div>
                    </div>
                    {plan.features && (
                      <div>
                        <p className="text-xs font-semibold mb-2">Features</p>
                        <ul className="text-xs space-y-1">
                          {JSON.parse(plan.features as string).map((f: string, i: number) => (
                            <li key={i}>• {f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No plans yet. Create one to get started.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
