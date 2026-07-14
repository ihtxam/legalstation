import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import LexLayout from "@/components/LexLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function TimeReportsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(currentDate), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(currentDate), "yyyy-MM-dd"));
  const [selectedClient, setSelectedClient] = useState<string>("all");

  // Placeholder data - in production, this would come from tRPC
  const summaryMetrics = {
    totalHours: 42.5,
    billableHours: 38.25,
    revenue: 3825.00,
    entriesCount: 12,
  };

  const dailyBreakdown = [
    { date: "2026-07-13", hours: 8, billable: 7.5, amount: 750, entries: 3 },
    { date: "2026-07-12", hours: 7.5, billable: 7, amount: 700, entries: 2 },
    { date: "2026-07-11", hours: 6, billable: 5.5, amount: 550, entries: 2 },
    { date: "2026-07-10", hours: 8.5, billable: 8, amount: 800, entries: 3 },
    { date: "2026-07-09", hours: 7, billable: 6.75, amount: 675, entries: 2 },
    { date: "2026-07-08", hours: 5.5, billable: 3.5, amount: 350, entries: 1 },
  ];

  const caseBreakdown = [
    { caseName: "Smith v. Johnson", hours: 15, billable: 14, amount: 1400 },
    { caseName: "Corporate Merger", hours: 18, billable: 16, amount: 1600 },
    { caseName: "Property Dispute", hours: 9.5, billable: 8.25, amount: 825 },
  ];

  const previousMonth = () => {
    const newDate = subMonths(currentDate, 1);
    setCurrentDate(newDate);
    setDateFrom(format(startOfMonth(newDate), "yyyy-MM-dd"));
    setDateTo(format(endOfMonth(newDate), "yyyy-MM-dd"));
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    setDateFrom(format(startOfMonth(newDate), "yyyy-MM-dd"));
    setDateTo(format(endOfMonth(newDate), "yyyy-MM-dd"));
  };

  const utilizationRate = summaryMetrics.totalHours > 0 
    ? ((summaryMetrics.billableHours / summaryMetrics.totalHours) * 100).toFixed(1)
    : "0";

  const avgDailyHours = summaryMetrics.totalHours > 0
    ? (summaryMetrics.totalHours / dailyBreakdown.length).toFixed(1)
    : "0";

  return (
    <LexLayout breadcrumb={[{ label: "Time Reports" }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Time Reports</h1>
          <p className="text-muted-foreground mt-2">Track your billable hours and productivity</p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm">Date From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm">Date To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm">Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    <SelectItem value="smith">Smith & Associates</SelectItem>
                    <SelectItem value="johnson">Johnson Corp</SelectItem>
                    <SelectItem value="williams">Williams LLC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white">Apply Filters</Button>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button variant="ghost" size="sm" onClick={previousMonth}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm font-medium">
                {format(currentDate, "MMMM yyyy")}
              </span>
              <Button variant="ghost" size="sm" onClick={nextMonth}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryMetrics.totalHours}</div>
              <p className="text-xs text-muted-foreground mt-1">hours tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Billable Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryMetrics.billableHours}</div>
              <p className="text-xs text-muted-foreground mt-1">{utilizationRate}% utilization</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">CHF {summaryMetrics.revenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">billable amount</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgDailyHours}</div>
              <p className="text-xs text-muted-foreground mt-1">hours per day</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">Daily Breakdown</TabsTrigger>
            <TabsTrigger value="cases">By Case</TabsTrigger>
          </TabsList>

          {/* Daily Breakdown Tab */}
          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Time Entries</CardTitle>
                <CardDescription>Time tracked by date for the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-right">Billable</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Entries</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyBreakdown.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{format(new Date(day.date), "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-right">{day.hours}</TableCell>
                          <TableCell className="text-right font-medium">{day.billable}</TableCell>
                          <TableCell className="text-right font-medium">CHF {day.amount}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{day.entries}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Case Tab */}
          <TabsContent value="cases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Time by Case</CardTitle>
                <CardDescription>Billable hours and revenue breakdown by case</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case Name</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-right">Billable Hours</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caseBreakdown.map((caseData) => (
                        <TableRow key={caseData.caseName}>
                          <TableCell className="font-medium">{caseData.caseName}</TableCell>
                          <TableCell className="text-right">{caseData.hours}</TableCell>
                          <TableCell className="text-right font-medium">{caseData.billable}</TableCell>
                          <TableCell className="text-right font-medium">CHF {caseData.amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LexLayout>
  );
}
