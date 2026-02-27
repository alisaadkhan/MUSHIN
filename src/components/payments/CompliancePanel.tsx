import { useState } from "react";
import { Upload, FileCheck, AlertCircle, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TaxDocument {
    id: string;
    status: 'pending' | 'verified' | 'rejected';
    submitted_at: string;
    document_url: string;
}

interface CompliancePanelProps {
    influencerId: string;
    existingDocument?: TaxDocument | null;
    className?: string;
}

export function CompliancePanel({ influencerId, existingDocument, className = "" }: CompliancePanelProps) {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [doc, setDoc] = useState<TaxDocument | null | undefined>(existingDocument);

    const handleUpload = async () => {
        if (!file || !influencerId) return;
        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${influencerId}_w9_${Math.random()}.${fileExt}`;
            const filePath = `tax_documents/${fileName}`;

            // Mocking storage upload for boilerplate scope. In reality:
            /*
            const { error: uploadError } = await supabase.storage
              .from('compliance')
              .upload(filePath, file);
            if (uploadError) throw uploadError;
            */

            // Save to DB
            const { data, error: dbErr } = await (supabase as any)
                .from("tax_documents")
                .insert({
                    influencer_id: influencerId,
                    document_url: filePath,
                    status: 'pending'
                })
                .select(`
                    id,
                    status,
                    submitted_at,
                    document_url
                `)
                .single();

            if (dbErr) throw dbErr;

            setDoc(data as TaxDocument);
            toast({ title: "Tax document submitted for verification" });
            setFile(null);

        } catch (err: any) {
            toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const statusBadge = () => {
        if (!doc) return <Badge variant="outline" className="bg-muted text-muted-foreground">Missing W-9</Badge>;
        if (doc.status === 'verified') return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><FileCheck className="w-3 h-3 mr-1" /> Verified</Badge>;
        if (doc.status === 'rejected') return <Badge className="bg-red-500/10 text-red-600 border border-red-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
        return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Pending Review</Badge>;
    };

    return (
        <Card className={`glass-card ${className}`}>
            <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-primary" />
                        Tax Compliance (W-9 / W-8BEN)
                    </CardTitle>
                    <CardDescription className="mt-1">Required for payouts exceeding $600 USD.</CardDescription>
                </div>
                {statusBadge()}
            </CardHeader>
            <CardContent>
                {doc && doc.status !== 'rejected' ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-primary">Document on file</span>
                            <span className="text-xs text-muted-foreground">Submitted {new Date(doc.submitted_at).toLocaleDateString()}</span>
                        </div>
                        {doc.status === 'pending' && (
                            <span className="text-xs text-amber-600 font-medium">Under Review takes 1-3 days</span>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {doc?.status === 'rejected' && (
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 mb-2">
                                Your previous document was rejected due to illegibility or missing signatures. Please upload a clear, fully signed copy.
                            </div>
                        )}
                        <div className="border-2 border-dashed border-border/60 hover:border-primary/50 transition-colors rounded-xl p-6 text-center">
                            {!file ? (
                                <>
                                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3 opacity-50" />
                                    <div className="text-sm text-foreground font-medium mb-1">Click to upload or drag and drop</div>
                                    <div className="text-xs text-muted-foreground mb-4">PDF, JPG, or PNG (max 5MB)</div>
                                    <input
                                        type="file"
                                        id="file-upload"
                                        className="hidden"
                                        accept=".pdf,image/png,image/jpeg"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    />
                                    <Button variant="outline" size="sm" asChild className="rounded-lg">
                                        <label htmlFor="file-upload" className="cursor-pointer">Select File</label>
                                    </Button>
                                </>
                            ) : (
                                <div className="flex items-center justify-between bg-white/50 p-3 rounded-lg border border-border">
                                    <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <Button
                            className="w-full btn-shine rounded-lg"
                            disabled={!file || uploading}
                            onClick={handleUpload}
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                            {uploading ? "Uploading..." : "Submit Securely"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
