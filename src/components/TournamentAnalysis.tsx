import { useState, useRef } from 'react';
import {
    FileText, Search, Loader2, Upload,
    ZoomIn, ZoomOut, RefreshCw, AlertCircle, Info
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { NameNormalizer } from '../utils/NameNormalizer';
import type { Player } from '../types/database';
import * as pdfjs from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface MatchResult {
    originalText: string;
    normalizedText: string;
    player: Player | null;
    rank: number | null;
    points: number | null;
    category: string | null;
    confidence: number;
}

export default function TournamentAnalysis() {
    const [loading, setLoading] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [results, setResults] = useState<MatchResult[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [showDebug, setShowDebug] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setResults([]);
        setDebugLogs([]);

        const isPdfFile = file.type === 'application/pdf';

        if (isPdfFile) {
            await processPdf(file);
        } else if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            await processImage(file);
        } else {
            alert('PDFまたは画像ファイルを選択してください。');
            setLoading(false);
        }
    };

    const processPdf = async (file: File) => {
        setProcessingStep('PDFを解析中...');
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        const allMatchedResults: MatchResult[] = [];
        const pagesToProcess = Math.min(pdf.numPages, 3);

        let previewSet = false;

        for (let i = 1; i <= pagesToProcess; i++) {
            setProcessingStep(`ページ ${i}/${pagesToProcess} を読み取り中...`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.5 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
                await (page as any).render({ canvasContext: context, viewport, canvas }).promise;

                if (!previewSet) {
                    setPreviewUrl(canvas.toDataURL());
                    previewSet = true;
                }

                const pageResults = await performOcr(canvas);
                allMatchedResults.push(...pageResults);
            }
        }

        finalizeResults(allMatchedResults);
    };

    const processImage = async (file: File) => {
        setProcessingStep('画像を解析中...');
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
        const lines = (data as any).lines || [];
        const logs: string[] = [];

        for (const line of lines) {
            const rawText = line.text.trim();
            if (!rawText) continue;

            logs.push(`${Math.round(line.confidence)}%: ${rawText}`);

            if (rawText.length < 2) continue;

            const playerMatch = await findBestPlayerMatch(rawText);

            if (playerMatch) {
                const normalizedValue = NameNormalizer.normalizeForMatching(rawText);
                const { data: rankData } = await supabase
                    .from('category_rankings')
                    .select('rank, year_month, category')
                    .eq('player_id', playerMatch.player_id)
                    .order('year_month', { ascending: false })
                    .limit(1);

                matches.push({
                    originalText: rawText,
                    normalizedText: normalizedValue,
                    player: playerMatch,
                    rank: rankData?.[0]?.rank || null,
                    points: playerMatch.ranking_point || null,
                    category: rankData?.[0]?.category || playerMatch.category || null,
                    confidence: line.confidence
                });
            }
        }

        setDebugLogs(prev => [...prev, ...logs]);
        await worker.terminate();
        return matches;
    };

    const findBestPlayerMatch = async (rawText: string): Promise<Player | null> => {
        const cleanText = rawText.replace(/^[0-9.\-\s]+/, '');
        const terms = cleanText.split(/[\s　,./\\-]+/)
            .map(t => NameNormalizer.normalizeForMatching(t))
            .filter(t => t.length >= 2);

        if (terms.length === 0) return null;

        for (const term of terms) {
            const { data: player } = await supabase
                .from('players')
                .select('*')
                .or(`full_name.ilike.%${term}%,last_name.ilike.%${term}%`)
                .limit(1);

            if (player?.[0]) return player[0];
        }

        return null;
    };

    const finalizeResults = (allMatches: MatchResult[]) => {
        const map = new Map();
        allMatches.forEach(m => {
            const id = m.player?.player_id;
            if (!map.has(id) || map.get(id).confidence < m.confidence) {
                map.set(id, m);
            }
        });
        setResults(Array.from(map.values()));
        setLoading(false);
        setProcessingStep('');
    };

    return (
        <div className="space-y-6 container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-tennis-green-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold font-display text-tennis-green-900 flex items-center">
                        <Search className="mr-3 h-8 w-8 text-tennis-green-600" />
                        トーナメント分析 (OCR)
                    </h1>
                    <p className="text-tennis-green-600 mt-1">
                        トーナメント表を読み取り、対戦相手の最新ランキングとポイントを表示します。
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${showDebug ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                    >
                        デバッグ表示
                    </button>
                    {previewUrl && (
                        <button
                            onClick={() => { setPreviewUrl(null); setResults([]); setDebugLogs([]); }}
                            className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl border border-rose-100 hover:bg-rose-100 transition-colors"
                        >
                            <RefreshCw size={18} />
                            リセット
                        </button>
                    )}
                </div>
            </header>

            {showDebug && debugLogs.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl animate-in slide-in-from-top-4 duration-300">
                    <h4 className="text-amber-800 font-bold flex items-center gap-2 mb-2">
                        <Info size={18} /> OCR 抽出テキスト (デバッグ中)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {debugLogs.map((log, i) => (
                            <div key={i} className="text-[10px] bg-white p-1 rounded border border-amber-100 font-mono truncate" title={log}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!previewUrl ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-tennis-green-200 rounded-3xl p-16 text-center bg-white/50 hover:bg-tennis-green-50 hover:border-tennis-green-400 transition-all cursor-pointer group shadow-sm"
                >
                    <div className="w-24 h-24 bg-tennis-green-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                        <Upload className="h-12 w-12 text-tennis-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">ファイルを選択またはドラッグ</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-8 text-lg">
                        ドロー表のPDF、またはスマホで撮影した写真をアップロードしてください。
                    </p>
                    <div className="flex justify-center gap-6">
                        <div className="flex items-center gap-2 text-tennis-green-700 bg-tennis-green-100 px-4 py-2 rounded-full text-sm font-semibold">
                            <FileText size={18} />
                            PDF形式対応
                        </div>
                        <div className="flex items-center gap-2 text-blue-700 bg-blue-100 px-4 py-2 rounded-full text-sm font-semibold">
                            <Search size={18} />
                            画像形式(JPG/PNG)
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf,image/*"
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-350px)] min-h-[600px]">
                    <div className="lg:w-1/2 flex flex-col bg-white rounded-3xl shadow-lg border border-tennis-green-100 overflow-hidden relative">
                        <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <Info size={18} className="text-tennis-green-600" />
                                <span className="text-sm font-bold text-gray-700">ドロープレビュー (拡大・縮小可能)</span>
                            </div>
                        </div>

                        <div className="flex-1 bg-gray-900 relative h-full">
                            {loading && (
                                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                                    <Loader2 className="w-16 h-16 text-tennis-green-400 animate-spin mb-4" />
                                    <p className="text-white text-xl font-bold tracking-wider">{processingStep}</p>
                                </div>
                            )}

                            <TransformWrapper
                                initialScale={1}
                                minScale={0.5}
                                maxScale={5}
                            >
                                {({ zoomIn, zoomOut, resetTransform }: any) => (
                                    <>
                                        <div className="absolute bottom-6 right-6 z-40 flex flex-col gap-2">
                                            <button onClick={() => zoomIn()} className="p-3 bg-white/90 rounded-full shadow-lg hover:bg-white text-gray-700 transition-all"><ZoomIn size={24} /></button>
                                            <button onClick={() => zoomOut()} className="p-3 bg-white/90 rounded-full shadow-lg hover:bg-white text-gray-700 transition-all"><ZoomOut size={24} /></button>
                                            <button onClick={() => resetTransform()} className="p-3 bg-white/90 rounded-full shadow-lg hover:bg-white text-gray-700 transition-all"><RefreshCw size={24} /></button>
                                        </div>
                                        <div className="w-full h-full flex items-center justify-center p-4">
                                            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                                                <img
                                                    src={previewUrl}
                                                    alt="Preview"
                                                    className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing"
                                                />
                                            </TransformComponent>
                                        </div>
                                    </>
                                )}
                            </TransformWrapper>
                        </div>
                    </div>

                    <div className="lg:w-1/2 flex flex-col bg-white rounded-3xl shadow-lg border border-tennis-green-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 bg-tennis-green-50/30 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">認識された選手一覧</h3>
                                <p className="text-sm text-gray-500 mt-1">{results.length} 名のデータが見つかりました</p>
                            </div>
                            {results.length > 0 && (
                                <div className="bg-tennis-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                                    解析完了
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto">
                            {results.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-gray-100 shadow-sm">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">選手 / 認識</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">カテゴリ</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">順位 / pt</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">信頼度</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {results.map((res, idx) => (
                                            <tr key={idx} className="hover:bg-tennis-green-50/50 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-tennis-green-100 flex items-center justify-center text-tennis-green-700 font-bold shrink-0">
                                                            {res.player?.last_name?.[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-800 text-lg">{res.player?.full_name}</p>
                                                            <p className="text-xs text-gray-400 mt-1 italic group-hover:text-tennis-green-600 transition-colors">
                                                                "{res.originalText}"
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                                                        {res.category || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-tennis-green-600 font-black text-lg">
                                                            {res.rank ? `${res.rank}位` : '-'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-bold">
                                                            {res.points?.toLocaleString() || '0'} pt
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${res.confidence > 80 ? 'bg-tennis-green-500' : 'bg-orange-400'}`}
                                                                style={{ width: `${res.confidence}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-gray-500">
                                                            {Math.round(res.confidence)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : !loading ? (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                        <AlertCircle size={40} className="text-gray-200" />
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-700 mb-2">解析データがありません</h4>
                                    <p className="text-gray-400 max-w-sm">
                                        左側のエリアに大会ドローをアップロードしてください。自動的に選手情報が抽出されます。
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
