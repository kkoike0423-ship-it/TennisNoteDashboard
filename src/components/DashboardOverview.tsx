import { useState } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { parseAndUploadZip } from '../utils/zipParser';

export default function DashboardOverview() {
    const [uploading, setUploading] = useState(false);
    const [progressMsg, setProgressMsg] = useState("");
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.zip')) {
            setStatus("error");
            setProgressMsg("Please select a ZIP file containing the TennisNote CSVs.");
            return;
        }

        setUploading(true);
        setStatus("idle");
        setProgressMsg("Starting upload...");

        const result = await parseAndUploadZip(file, (msg) => {
            setProgressMsg(msg);
        });

        if (result) {
            setStatus("success");
        } else {
            setStatus("error");
        }
        setUploading(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Overview & Data Management</h2>
                    <p className="text-gray-500 text-sm mt-1">Upload your backup to sync with the database and view statistics.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 shadow-sm flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-tennis-green-200 bg-tennis-green-50/50 hover:bg-tennis-green-50 transition-colors relative cursor-pointer group">
                    <input
                        type="file"
                        accept=".zip"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />

                    {uploading ? (
                        <div className="text-center flex flex-col items-center">
                            <Loader2 className="w-10 h-10 text-tennis-green-500 animate-spin mb-3" />
                            <h3 className="text-sm font-medium text-gray-900">{progressMsg}</h3>
                        </div>
                    ) : status === "success" ? (
                        <div className="text-center flex flex-col items-center text-green-600">
                            <CheckCircle className="w-10 h-10 mb-3" />
                            <h3 className="text-sm font-medium text-gray-900">Upload Successful</h3>
                            <p className="text-xs text-gray-500 mt-1">Data synced to Supabase</p>
                        </div>
                    ) : status === "error" ? (
                        <div className="text-center flex flex-col items-center text-red-500">
                            <AlertCircle className="w-10 h-10 mb-3" />
                            <h3 className="text-sm font-medium text-gray-900">Upload Failed</h3>
                            <p className="text-xs text-red-400 mt-1 max-w-[200px] break-words">{progressMsg}</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <Upload className="w-10 h-10 text-tennis-green-400 mx-auto mb-3 group-hover:text-tennis-green-500 transition-colors" />
                            <h3 className="text-sm font-medium text-gray-900">Upload TennisNote Backup (.zip)</h3>
                            <p className="text-xs text-gray-500 mt-1">Extracts only players, history & rankings</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
