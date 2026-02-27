import { useState } from "react";
import { DollarSign, FileText, Upload, CheckCircle2, AlertCircle, Clock, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Mock Data structure based on DB Schema
export interface PaymentRecord {
    id: string;
    influencer_name: string;
    campaign_name: string;
    amount: number;
    currency: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    due_date: string;
}

interface PaymentsPanelProps {
    payments: PaymentRecord[];
    className?: string;
}

export function PaymentsPanel({ payments, className = "" }: PaymentsPanelProps) {
    const { toast } = useToast();
    const [generating, setGenerating] = useState<string | null>(null);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
            case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
            case 'processing': return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Clock className="w-3 h-3 mr-1" /> Processing</Badge>;
            case 'failed': return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
            default: return null;
        }
    };

    const handleDownloadInvoice = async (paymentId: string) => {
        setGenerating(paymentId);
        try {
            const { data, error } = await supabase.functions.invoke("generate-invoice", {
                body: { payment_id: paymentId }
            });

            if (error) throw error;
            if (data?.pdf_base64) {
                // Trigger download
                const linkSource = `data:application/pdf;base64,${data.pdf_base64}`;
                const downloadLink = document.createElement("a");
                downloadLink.href = linkSource;
                downloadLink.download = data.filename || `invoice_${paymentId}.pdf`;
                downloadLink.click();
                toast({ title: "Invoice Generated" });
            } else {
                toast({ title: "Failed to generate invoice", variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setGenerating(null);
        }
    };

    return (
        <Card className={`glass-card ${className}`}>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Payouts & Invoices
                </CardTitle>
                <CardDescription>Manage influencer payments and download auto-generated PDF invoices.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {payments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No payment records found.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border border-border/50 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Influencer</th>
                                        <th className="px-4 py-3 font-medium">Campaign</th>
                                        <th className="px-4 py-3 font-medium">Amount</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium">Due Date</th>
                                        <th className="px-4 py-3 font-medium text-right">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {payments.map(p => (
                                        <tr key={p.id} className="bg-white/30 backdrop-blur-sm hover:bg-white/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-foreground">{p.influencer_name}</td>
                                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]">{p.campaign_name}</td>
                                            <td className="px-4 py-3 font-semibold">${p.amount.toLocaleString()} {p.currency}</td>
                                            <td className="px-4 py-3">{getStatusBadge(p.status)}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{format(new Date(p.due_date), 'MMM d, yyyy')}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                                    onClick={() => handleDownloadInvoice(p.id)}
                                                    disabled={generating === p.id}
                                                >
                                                    {generating === p.id ? "Generating..." : <><Download className="w-3 h-3 mr-1" /> PDF</>}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
