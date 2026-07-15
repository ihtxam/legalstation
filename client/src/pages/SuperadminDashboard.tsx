import { useState, useEffect } from "react";
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
import { Plus, Edit2, Pause, RotateCcw, Search, X, Users, TrendingUp, Building2, DollarSign } from "lucide-react";

export default function SuperadminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [showCreateFirm, setShowCreateFirm] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBilling, setFilterBilling] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "status" | "plan">("name");
  const [selectedFirmId, setSelectedFirmId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Check if user is superadmin
  useEffect(() => {
    if (user && user.role !== "superadmin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);
  };

  // Queries
  const { data: stats, isLoading: statsLoading } = trpc.superadmin.getStats.useQuery();
  const { data: firms, isLoading: firmsLoading, refetch: refetchFirms } = trpc.superadmin.listFirms.useQuery();
  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = trpc.superadmin.listPlans.useQuery();
  const { data: firmDetail, isLoading: firmDetailLoading } = trpc.superadmin.getFirmDetail.useQuery(
    { firmId: selectedFirmId! },
    { enabled: !!selectedFirmId }
  );

  // Stat cards data
  const statCards = [
    {
      label: "Total Firms",
      value: stats?.totalFirms ?? 0,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Active Firms",
      value: stats?.activeFirms ?? 0,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Total Users",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Total Revenue (CHF)",
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
      isNumeric: false,
    },
  ];

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

  // Filter and sort firms
  const filteredFirms = firms?.filter((firm) => {
    const matchesSearch = searchQuery === "" || 
      firm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (firm.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesPlan = filterPlan === "" || firm.subscription?.planId.toString() === filterPlan;
    const matchesStatus = filterStatus === "" || firm.subscription?.status === filterStatus;
    const matchesBilling = filterBilling === "" || firm.subscription?.billingCycle === filterBilling;
    return matchesSearch && matchesPlan && matchesStatus && matchesBilling;
  }).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "status") return (a.subscription?.status || "").localeCompare(b.subscription?.status || "");
    if (sortBy === "plan") {
      const planA = plans?.find(p => p.id === a.subscription?.planId)?.name || "";
      const planB = plans?.find(p => p.id === b.subscription?.planId)?.name || "";
      return planA.localeCompare(planB);
    }
    return 0;
  }) || [];

  const hasActiveFilters = searchQuery || filterPlan || filterStatus || filterBilling;

  // Pagination
  const totalPages = Math.ceil(filteredFirms.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFirms = filteredFirms.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterPlan, filterStatus, filterBilling, sortBy]);

  const resetFilters = () => {
    setSearchQuery("");
    setFilterPlan("");
    setFilterStatus("");
    setFilterBilling("");
  };

  const getUniqueStatuses = () => {
    const statuses = new Set(firms?.map(f => f.subscription?.status).filter(Boolean));
    return Array.from(statuses);
  };

  const getUniqueBillingCycles = () => {
    const cycles = new Set(firms?.map(f => f.subscription?.billingCycle).filter(Boolean));
    return Array.from(cycles);
  };

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

  if (user?.role !== "superadmin") {
    return <div className="p-8 text-center text-muted-foreground">Unauthorized. Superadmin access required.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">LexFlow Superadmin</h1>
            <p className="text-muted-foreground">Manage law firms and subscription plans</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin/settings")}>
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Summary Stats */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Platform Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} className="border-border shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
                      {statsLoading ? (
                        <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                      ) : (
                        <p className="text-3xl font-bold text-foreground">{value}</p>
                      )}
                    </div>
                    <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                      <Icon className={`w-4.5 h-4.5 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

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

          {/* Search and Filter Bar */}
          <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by firm name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters and Sort */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Plan</Label>
                <Select value={filterPlan} onValueChange={setFilterPlan}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All plans</SelectItem>
                    {plans?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id.toString()}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    {getUniqueStatuses().map((status) => (
                      <SelectItem key={status} value={status || ""}>
                        {status || "Inactive"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Billing Cycle</Label>
                <Select value={filterBilling} onValueChange={setFilterBilling}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All cycles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All cycles</SelectItem>
                    {getUniqueBillingCycles().map((cycle) => (
                      <SelectItem key={cycle} value={cycle || ""}>
                        {cycle ? cycle.charAt(0).toUpperCase() + cycle.slice(1) : "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Sort By</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="plan">Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <div className="text-xs text-muted-foreground">
                  {filteredFirms.length} of {firms?.length || 0} firms
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <Button variant="outline" onClick={resetFilters} className="w-full gap-2" size="sm">
                <X className="h-4 w-4" />
                Clear All Filters
              </Button>
            )}
          </div>

          {firmsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading firms...</div>
          ) : paginatedFirms.length > 0 ? (
            <div className="grid gap-4">
              {paginatedFirms.map((firm) => (
                <Card key={firm.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{firm.name}</CardTitle>
                        <CardDescription className="mt-1">{firm.email}</CardDescription>
                      </div>
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
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-muted-foreground">Plan</p>
                        <p className="font-medium">{plans?.find((p) => p.id === firm.subscription?.planId)?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Billing Cycle</p>
                        <p className="font-medium capitalize">{firm.subscription?.billingCycle || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Address</p>
                        <p className="font-medium text-xs">{firm.address || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium">{firm.phone || "—"}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setSelectedFirmId(firm.id)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => suspendFirmMutation.mutate({ firmId: firm.id })}
                        disabled={firm.subscription?.status === "suspended" || suspendFirmMutation.isPending}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        {firm.subscription?.status === "suspended" ? "Suspended" : "Suspend"}
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {hasActiveFilters ? "No firms match your filters. Try adjusting your search criteria." : "No firms yet. Create one to get started."}
              </CardContent>
            </Card>
          )}

          {/* Pagination Controls */}
          {filteredFirms.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredFirms.length)} of {filteredFirms.length} firms
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Firm Detail Modal */}
        <Dialog open={!!selectedFirmId} onOpenChange={(open) => !open && setSelectedFirmId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{firmDetail?.firm.name}</DialogTitle>
              <DialogDescription>{firmDetail?.firm.email}</DialogDescription>
            </DialogHeader>

            {firmDetailLoading ? (
              <div className="text-center py-8">Loading firm details...</div>
            ) : firmDetail ? (
              <div className="space-y-6">
                {/* Subscription Info */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Subscription Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Plan</p>
                      <p className="font-medium">{firmDetail.plan?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant={firmDetail.subscription?.status === "active" ? "default" : "destructive"}>
                        {firmDetail.subscription?.status || "inactive"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Billing Cycle</p>
                      <p className="font-medium capitalize">{firmDetail.subscription?.billingCycle || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max Users</p>
                      <p className="font-medium">{firmDetail.plan?.maxUsers || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Usage Metrics */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Usage Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted p-3 rounded">
                      <p className="text-muted-foreground text-sm">Total Cases</p>
                      <p className="text-2xl font-bold">{firmDetail.usageMetrics.totalCases}</p>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <p className="text-muted-foreground text-sm">Total Clients</p>
                      <p className="text-2xl font-bold">{firmDetail.usageMetrics.totalClients}</p>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <p className="text-muted-foreground text-sm">Total Documents</p>
                      <p className="text-2xl font-bold">{firmDetail.usageMetrics.totalDocuments}</p>
                    </div>
                    <div className="bg-muted p-3 rounded">
                      <p className="text-muted-foreground text-sm">Total Messages</p>
                      <p className="text-2xl font-bold">{firmDetail.usageMetrics.totalMessages}</p>
                    </div>
                  </div>
                </div>

                {/* Billing History */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Recent Billing History</h3>
                  {firmDetail.billingHistory.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {firmDetail.billingHistory.map((invoice: any) => (
                        <div key={invoice.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <div>
                            <p className="font-medium">Invoice #{invoice.invoiceNumber}</p>
                            <p className="text-muted-foreground text-xs">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${invoice.totalAmount}</p>
                            <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                              {invoice.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No billing history yet</p>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Recent Activity</h3>
                  {firmDetail.recentActivity.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {firmDetail.recentActivity.map((activity: any) => (
                        <div key={activity.id} className="flex justify-between items-start text-sm border-b pb-2">
                          <div>
                            <p className="font-medium">{activity.eventType}</p>
                            <p className="text-muted-foreground text-xs">{new Date(activity.createdAt).toLocaleString()}</p>
                          </div>
                          {activity.description && (
                            <p className="text-muted-foreground text-xs max-w-xs text-right">{activity.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No recent activity</p>
                  )}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

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
