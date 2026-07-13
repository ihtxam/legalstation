import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";

export default function TimeReportsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Placeholder data - time reports router will be added in next phase
  const timeReports = {
    totalHours: 160,
    billableHours: 144,
    totalAmount: 14400,
    entryCount: 32,
  };

  const dailyBreakdown = [
    { date: new Date().getTime(), hours: 8, description: "Client meeting & research", amount: 800 },
    { date: new Date().getTime() - 86400000, hours: 7.5, description: "Document drafting", amount: 750 },
  ];

  const previousMonth = () => setCurrentDate(addMonths(currentDate, -1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Time Reports</h1>
        <p className="text-gray-600 mt-2">Track your billable hours and productivity metrics</p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={previousMonth}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <h2 className="text-xl font-semibold">{format(currentDate, "MMMM yyyy")}</h2>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(timeReports.totalHours || 0).toFixed(1)}h</div>
            <p className="text-xs text-gray-500 mt-1">All time entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Billable Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(timeReports.billableHours || 0).toFixed(1)}h</div>
            <p className="text-xs text-gray-500 mt-1">
              {timeReports.totalHours ? (((timeReports.billableHours || 0) / timeReports.totalHours) * 100).toFixed(0) : 0}% utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">CHF {(timeReports.totalAmount || 0).toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Billable revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeReports.entryCount || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Time entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="daily" className="w-full">
        <TabsList>
          <TabsTrigger value="daily">Daily Breakdown</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* Daily Breakdown Tab */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Time Entries</CardTitle>
              <CardDescription>Time tracked by date</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyBreakdown && dailyBreakdown.length > 0 ? (
                    dailyBreakdown.map((entry: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{format(new Date(entry.date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{entry.hours.toFixed(1)}h</TableCell>
                        <TableCell className="text-sm text-gray-600">{entry.description || "—"}</TableCell>
                        <TableCell>CHF {entry.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                        No time entries for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Summary</CardTitle>
              <CardDescription>Overview of your time tracking metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Average Daily Hours</p>
                  <p className="text-lg font-semibold">
                    {timeReports.totalHours && timeReports.totalHours > 0
                      ? (timeReports.totalHours / 20).toFixed(1)
                      : "0"}h
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Billable Rate</p>
                  <p className="text-lg font-semibold">
                    CHF {timeReports.billableHours && timeReports.billableHours > 0
                      ? (timeReports.totalAmount / timeReports.billableHours).toFixed(2)
                      : "0"}/h
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
