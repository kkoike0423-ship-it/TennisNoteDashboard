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
                    <h2 className="text-2xl font-bold text-gray-800">CSVデータ取込</h2>
                    <p className="text-gray-500 text-sm mt-1">TennisNoteアプリのバックアップZIPファイルをアップロードして、データベースを更新します。</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 shadow-sm flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-tennis-green-200 bg-tennis-green-50/50 hover:bg-tennis-green-50 transition-colors relative cursor-pointer group md:col-span-1">
                    <input
                        type="file"
                        accept=".zip"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />
                    <div className="w-16 h-16 bg-tennis-green-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="h-8 w-8 text-tennis-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">ZIPファイルをアップロード</h3>
                    <p className="text-gray-500 text-sm text-center">バックアップの .zip ファイルを選択、またはここにドラッグ＆ドロップしてください。</p>
                </div>

                <div className="md:col-span-2 glass-panel p-6 shadow-sm flex flex-col justify-center bg-white/50 border border-tennis-green-100">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-600">処理ステータス</span>
                            {status === "success" && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">完了</span>}
                            {status === "error" && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">エラー</span>}
                        </div>

                        <div className="p-4 bg-white/50 rounded-xl border border-gray-100 min-h-[100px] flex flex-col items-center justify-center text-center">
                            {uploading ? (
                                <>
                                    <Loader2 className="w-8 h-8 text-tennis-green-500 animate-spin mb-3" />
                                    <p className="text-tennis-green-800 font-medium animate-pulse">{progressMsg}</p>
                                </>
                            ) : status === "success" ? (
                                <>
                                    <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
                                    <p className="text-gray-800 font-bold">データの取込が正常に完了しました！</p>
                                    <p className="text-gray-500 text-xs mt-1">ダッシュボードに戻って最新のデータを確認してください。</p>
                                </>
                            ) : status === "error" ? (
                                <>
                                    <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
                                    <p className="text-red-800 font-bold">取込に失敗しました</p>
                                    <p className="text-gray-500 text-xs mt-1">{progressMsg}</p>
                                </>
                            ) : (
                                <p className="text-gray-400 italic">ファイルをアップロードするとここに詳細が表示されます。</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
