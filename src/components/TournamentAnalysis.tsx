import { useState, useRef } from 'react';
import { FileText, Search, Loader2, Upload, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { NameNormalizer } from '../utils/NameNormalizer';
import type { Player } from '../types/database';
import * as pdfjs from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface MatchResult {
    originalText: string;
    normalizedText: string;
    player: Player | null;
    rank: string | null;
    confidence: number;
}

export default function TournamentAnalysis() {
    const [loading, setLoading] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [results, setResults] = useState<MatchResult[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setResults([]);
        setPreviewUrl(URL.createObjectURL(file));

        try {
            if (file.type === 'application/pdf') {
                await processPdf(file);
            } else if (file.type.startsWith('image/')) {
                await processImage(file);
            } else {
                alert('PDFまたは画像ファイルを選択してください。');
                setLoading(false);
            }
        } catch (err) {
            console.error('Processing error:', err);
            alert('処理中にエラーが発生しました。');
            setLoading(false);
        }
    };

    const processPdf = async (file: File) => {
        setProcessingStep('PDFを読み込み中...');
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        const allMatchedResults: MatchResult[] = [];

        // Process up to first 3 pages to avoid timeout/blocking
        const pagesToProcess = Math.min(pdf.numPages, 3);

        for (let i = 1; i <= pagesToProcess; i++) {
            setProcessingStep(`ページ ${i}/${pagesToProcess} をOCR処理中...`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
                // Add canvas to RenderParameters if required by types, though context is the primary one
                await (page as any).render({ canvasContext: context, viewport, canvas }).promise;
                const pageResults = await performOcr(canvas);
                allMatchedResults.push(...pageResults);
            }
        }

        finalizeResults(allMatchedResults);
    };

    const processImage = async (file: File) => {
        setProcessingStep('画像をOCR処理中...');
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise((resolve) => { img.onload = resolve; });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);

        const pageResults = await performOcr(canvas);
        finalizeResults(pageResults);
    };

    const performOcr = async (canvas: HTMLCanvasElement): Promise<MatchResult[]> => {
        const worker = await createWorker('jpn');

        const { data } = await worker.recognize(canvas);

        const matches: MatchResult[] = [];

        // Use any to bypass strict type check if lines property is missing in certain versions
        const lines = (data as any).lines || [];

        for (const line of lines) {
            const rawText = line.text.trim();
            // Basic filtering for noise / short strings
            if (rawText.length < 2 || /^[0-9\s\-/,.]+$/.test(rawText)) continue;

            const normalized = NameNormalizer.normalizeForMatching(rawText);
            if (!normalized) continue;

            // Match against database
            const playerMatch = await findBestPlayerMatch(normalized);

            if (playerMatch) {
                // Fetch latest rank for this player
                const { data: rankingData } = await supabase
                    .from('rankings')
                    .select('rank, category')
                    .eq('player_id', playerMatch.player_id)
                    .order('year_month', { ascending: false })
                    .limit(1);

                matches.push({
                    originalText: rawText,
                    normalizedText: normalized,
                    player: playerMatch,
                    rank: rankingData && rankingData[0] ? `${rankingData[0].category} / ${rankingData[0].rank}位` : 'ランク無',
                    confidence: line.confidence
                });
            }
        }

        await worker.terminate();
        return matches;
    };

    const findBestPlayerMatch = async (normalized: string): Promise<Player | null> => {
        // Simple strategy: check if normalized name exists in our DB
        // In a real app, we'd use a more sophisticated similarity match
        const { data } = await supabase
            .from('players')
            .select('*')
            .or(`full_name.ilike.%${normalized}%,last_name.ilike.%${normalized}%,first_name.ilike.%${normalized}%`)
            .limit(1);

        return data?.[0] || null;
    };

    const finalizeResults = (allMatches: MatchResult[]) => {
        // Duid-duplicate based on player_id
        const uniqueMatches = Array.from(new Map(allMatches.map(m => [m.player?.player_id, m])).values());
        setResults(uniqueMatches);
        setLoading(false);
        setProcessingStep('');
    };

    return (
        <div className="space-y-6 container mx-auto px-4 py-8 max-w-5xl animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-tennis-green-900 flex items-center">
                        <Search className="mr-3 h-8 w-8 text-tennis-green-600" />
                        トーナメント分析 (OCR)
                    </h1>
                    <p className="text-tennis-green-600 mt-1">PDFや写真から選手名を読み取り、最新ランキングを自動表示します。</p>
                </div>
            </header>

            {!previewUrl ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-tennis-green-200 rounded-3xl p-12 text-center bg-white/50 hover:bg-tennis-green-50 hover:border-tennis-green-400 transition-all cursor-pointer group"
                >
                    <div className="w-20 h-20 bg-tennis-green-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                        <Upload className="h-10 w-10 text-tennis-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">ファイルを選択またはドラッグ</h3>
                    <p className="text-gray-500 max-w-xs mx-auto">トーナメント表のPDF、またはスマホで撮影した写真をアップロードしてください。</p>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf,image/*"
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Preview Side */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-tennis-green-100">
                            <span className="font-medium text-gray-700">ファイルプレビュー</span>
                            <button
                                onClick={() => { setPreviewUrl(null); setResults([]); }}
                                className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-tennis-green-100 aspect-[3/4] flex items-center justify-center relative">
                            {previewUrl && (
                                <iframe src={previewUrl} className="w-full h-full border-none" title="Preview" />
                            )}
                            {loading && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                    <Loader2 className="w-12 h-12 text-tennis-green-500 animate-spin mb-4" />
                                    <p className="text-tennis-green-800 font-bold">{processingStep}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Results Side */}
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-tennis-green-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">認識された選手 ({results.length}名)</h3>
                            {results.length > 0 && <CheckCircle2 className="text-tennis-green-500 w-5 h-5" />}
                        </div>

                        {results.length > 0 ? (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {results.map((res, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-tennis-green-50 hover:border-tennis-green-200 transition-all shadow-sm group flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-tennis-green-100 flex items-center justify-center text-tennis-green-700 font-bold">
                                                {res.player?.last_name?.[0] || '選手'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-800">{res.player?.full_name || res.player?.last_name}</span>
                                                    <span className="text-[10px] bg-tennis-green-100 text-tennis-green-700 px-1.5 py-0.5 rounded font-medium">信頼度 {Math.round(res.confidence)}%</span>
                                                </div>
                                                <p className="text-xs text-gray-500 flex items-center">
                                                    <span className="truncate max-w-[120px]">{res.player?.team || 'チーム無'}</span>
                                                    <span className="mx-1.5">•</span>
                                                    <span className="font-bold text-tennis-green-600">{res.rank}</span>
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 font-mono">認識テキスト: "{res.originalText}"</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-tennis-green-500 transition-colors" />
                                    </div>
                                ))}
                            </div>
                        ) : !loading ? (
                            <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">まだ結果がありません。ファイルを読み込むとここにランキングが表示されます。</p>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
