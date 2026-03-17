import { useState, useRef, useEffect } from 'react';
import {
    FileText, Search, Loader2, Upload,
    ZoomIn, ZoomOut, RefreshCw, AlertCircle, Info
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { NameNormalizer } from '../utils/NameNormalizer';
import type { Player } from '../types/database';
import * as pdfjs from 'pdfjs-dist';
import { createWorker, PSM } from 'tesseract.js';
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

type OcrLine = {
    text: string;
    confidence?: number;
};

type OcrData = {
    lines?: OcrLine[];
    text?: string;
};

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};

export default function TournamentAnalysis() {
    const [loading, setLoading] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [results, setResults] = useState<MatchResult[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [showDebug, setShowDebug] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [latestYearMonth, setLatestYearMonth] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch categories and set initial one based on managed players
    useEffect(() => {
        const initCategories = async () => {
            // Fetch all unique categories from players table
            const { data: catData } = await supabase
                .from('players')
                .select('category')
                .not('category', 'is', null);

            if (catData) {
                const uniqueCats = Array.from(new Set(catData.map(c => c.category))).sort();
                setCategories(uniqueCats);
            }

            // Fetch the category of the "managed" player for kkoike0423@gmail.com
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession) {
                const { data: watched } = await supabase
                    .from('user_watched_players')
                    .select('player_id')
                    .eq('user_id', currentSession.user.id)
                    .eq('player_type', 'managed')
                    .limit(1);

                if (watched?.[0]) {
                    const { data: player } = await supabase
                        .from('players')
                        .select('category')
                        .eq('player_id', watched[0].player_id)
                        .single();

                    if (player?.category) {
                        setSelectedCategory(player.category);
                    }
                }
            }
        };
        initCategories();
    }, []);

    // Get the latest year_month for the selected category whenever it changes
    useEffect(() => {
        if (!selectedCategory) return;
        const fetchLatestYM = async () => {
            const { data } = await supabase
                .from('category_rankings')
                .select('year_month')
                .eq('category', selectedCategory)
                .order('year_month', { ascending: false })
                .limit(1);
            if (data?.[0]) {
                setLatestYearMonth(data[0].year_month);
                addLog(`カテゴリー "${selectedCategory}" の最新データ年月: ${data[0].year_month}`);
            }
        };
        fetchLatestYM();
    }, [selectedCategory]);

    const calculateMatchRate = (str1: string, str2: string): number => {
        const s1 = NameNormalizer.normalizeForMatching(str1);
        const s2 = NameNormalizer.normalizeForMatching(str2);
        if (s1 === s2) return 100;
        if (!s1 || !s2) return 0;

        // Levenshtein Distance (Edit Distance)
        const track = Array(s2.length + 1).fill(null).map(() =>
            Array(s1.length + 1).fill(null));
        for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
        for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
        for (let j = 1; j <= s2.length; j += 1) {
            for (let i = 1; i <= s1.length; i += 1) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1, // deletion
                    track[j - 1][i] + 1, // insertion
                    track[j - 1][i - 1] + indicator, // substitution
                );
            }
        }
        const distance = track[s2.length][s1.length];
        const maxLength = Math.max(s1.length, s2.length);
        return Math.round(((maxLength - distance) / maxLength) * 100);
    };

    const addLog = (message: string) => {
        setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
        console.log(`[OCR Log] ${message}`);
    };

    const preprocessImage = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        addLog('画像の前処理（高度な二値化）を開始...');
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Step 1: Create a grayscale buffer
        const grays = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            grays[i / 4] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        }

        /**
         * Simple Block-based Adaptive Thresholding
         * Divide image into blocks and compute local average brightness.
         */
        const blockSize = 32;
        const blocksW = Math.ceil(width / blockSize);
        const blocksH = Math.ceil(height / blockSize);
        const blockMeans = new Float32Array(blocksW * blocksH);

        for (let by = 0; by < blocksH; by++) {
            for (let bx = 0; bx < blocksW; bx++) {
                let sum = 0;
                let count = 0;
                for (let y = by * blockSize; y < Math.min((by + 1) * blockSize, height); y++) {
                    for (let x = bx * blockSize; x < Math.min((bx + 1) * blockSize, width); x++) {
                        sum += grays[y * width + x];
                        count++;
                    }
                }
                blockMeans[by * blocksW + bx] = sum / count;
            }
        }

        // Apply thresholding based on local block mean
        for (let y = 0; y < height; y++) {
            const by = Math.floor(y / blockSize);
            for (let x = 0; x < width; x++) {
                const bx = Math.floor(x / blockSize);
                const mean = blockMeans[by * blocksW + bx];
                const idx = (y * width + x) * 4;
                
                // If pixel is significantly darker than local average, it's text (0), otherwise background (255)
                // Using a small bias (-15) to be more aggressive with black text on white
                const value = grays[y * width + x] < (mean - 15) ? 0 : 255;
                
                data[idx] = value;
                data[idx + 1] = value;
                data[idx + 2] = value;
                data[idx + 3] = 255;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        addLog('画像の前処理（ブロック適応二値化）が完了しました。');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setResults([]);
        setDebugLogs([]);
        addLog(`ファイルを選択しました: ${file.name} (対象カテゴリー: ${selectedCategory || 'すべて'})`);

        const isPdfFile = file.type === 'application/pdf';

        try {
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
        } catch (err: unknown) {
            addLog(`致命的なエラー: ${getErrorMessage(err)}`);
            console.error(err);
            setLoading(false);
        }
    };

    const processPdf = async (file: File) => {
        setProcessingStep('PDFを解析中...');
        addLog('PDFの解析を開始します...');
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            addLog(`PDF読み込み完了: ${pdf.numPages} ページ`);
            const allMatchedResults: MatchResult[] = [];
            const pagesToProcess = Math.min(pdf.numPages, 3);

            // Create worker once for the entire PDF
            const worker = await initWorker();
            try {
                let previewSet = false;

                for (let i = 1; i <= pagesToProcess; i++) {
                    addLog(`第 ${i} ページのレンダリング中...`);
                    setProcessingStep(`ページ ${i}/${pagesToProcess} を読み取り中...`);
                    const page = await pdf.getPage(i);
                    // Increase scale to 3.0 for better OCR detail
                    const viewport = page.getViewport({ scale: 3.0 });

                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    if (context) {
                        // Apply base sharpening/contrast filters during rendering
                        context.filter = 'contrast(1.2) brightness(1.05)';
                        await page.render({ canvasContext: context, viewport, canvas }).promise;
                        context.filter = 'none';

                        if (!previewSet) {
                            setPreviewUrl(canvas.toDataURL());
                            previewSet = true;
                        }

                        addLog(`第 ${i} ページのOCRを開始します...`);
                        preprocessImage(canvas);
                        const pageResults = await performOcr(canvas, worker);
                        allMatchedResults.push(...pageResults);
                    }
                }
            } finally {
                if (worker) await worker.terminate();
            }

            finalizeResults(allMatchedResults);
        } catch (err: unknown) {
            addLog(`PDF処理エラー: ${getErrorMessage(err)}`);
            throw err;
        }
    };

    const processImage = async (file: File) => {
        setProcessingStep('画像を読み込み中...');
        addLog('画像の解析準備を開始します...');
        try {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
            });

            // Increase resolution for better OCR (3x scale)
            const scale = 3.0;
            const width = (img.naturalWidth || img.width) * scale;
            const height = (img.naturalHeight || img.height) * scale;
            addLog(`解析用サイズ (3倍スケール): ${Math.round(width)}x${Math.round(height)}`);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvasの作成に失敗しました。');

            // Apply initial image quality boost
            ctx.filter = 'contrast(1.4) brightness(1.05) grayscale(1)';
            ctx.drawImage(img, 0, 0, width, height);
            ctx.filter = 'none';
            
            preprocessImage(canvas);

            addLog('高解像度キャンバスへの描画と前処理が完了しました。解析を開始します。');
            const worker = await initWorker();
            try {
                const results = await performOcr(canvas, worker);
                finalizeResults(results);
            } finally {
                if (worker) await worker.terminate();
            }
        } catch (err: unknown) {
            addLog(`画像処理エラー: ${getErrorMessage(err)}`);
            setLoading(false);
        }
    };

    const initWorker = async () => {
        addLog('OCRエンジン (日・英混合) を起動中...');
        const worker = await createWorker(['jpn', 'eng'], 1, {
            logger: (m: Tesseract.LoggerMessage) => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    if (progress % 10 === 0) setProcessingStep(`解析中... ${progress}%`);
                }
            }
        });

        await worker.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
            tessjs_create_hocr: '0',
            tessjs_create_tsv: '0',
        });
        return worker;
    };

    const performOcr = async (imageSource: HTMLCanvasElement | string, existingWorker?: Tesseract.Worker): Promise<MatchResult[]> => {
        let worker = existingWorker;
        let shouldTerminate = false;
        try {
            if (!worker) {
                worker = await initWorker();
                shouldTerminate = true;
            }

            addLog('文字認識を実行中...');
            const { data } = await worker.recognize(imageSource);
            const ocrData = data as OcrData;
            const matches: MatchResult[] = [];
            const lines = ocrData.lines ?? [];
            const text = ocrData.text ?? "";

            addLog(`解析完了: 合計 ${text.length} 文字、${lines.length} 行を検出。`);

            let activeLines = lines;
            if (activeLines.length === 0 && text.trim().length > 0) {
                addLog('【バックアップ】行構造は不明ですが、テキストは取得されました。改行で分割して照合を試みます。');
                activeLines = text.split('\n').map((t: string): OcrLine => ({ text: t, confidence: 50 }));
            } else if (activeLines.length === 0) {
                addLog('【警報】文字が全く検出されませんでした。');
                addLog('改善のヒント: 文字が小さすぎる、または画像が暗すぎる可能性があります。');
            }

            for (const line of activeLines) {
                const rawText = line.text.trim();
                if (!rawText) continue;

                if (rawText.length < 2) {
                    if (rawText.length > 0) addLog(`[スキップ] "${rawText}" (短すぎます)`);
                    continue;
                }

                const matchData = await findBestPlayerMatch(rawText);

                if (matchData) {
                    const { player: playerMatch, cleanedName } = matchData;
                    addLog(`[一致確認] "${rawText}" → ${playerMatch.full_name} (抽出: ${cleanedName})`);

                    matches.push({
                        originalText: cleanedName,
                        normalizedText: NameNormalizer.normalizeForMatching(cleanedName),
                        player: playerMatch,
                        rank: null, // Will be filled in finalizeResults
                        points: playerMatch.ranking_point || null,
                        category: null, // Will be filled in finalizeResults
                        confidence: line.confidence || 0
                    });
                } else {
                    // Log even if no match to show what was tried
                    // addLog(`[照合不可] "${rawText}"`);
                }
            }

            if (shouldTerminate && worker) {
                await worker.terminate();
            }
            addLog('テキスト・照合プロセスが終了しました。');
            return matches;
        } catch (err: unknown) {
            addLog(`OCRエラー: ${getErrorMessage(err)}`);
            if (shouldTerminate && worker) await worker.terminate();
            return [];
        }
    };

    /**
     * Finds the best player match in the database for a given raw OCR text.
     * Uses a fuzzy wildcard approach to handle spaces and minor OCR errors.
     */
    const findBestPlayerMatch = async (rawText: string): Promise<{ player: Player; cleanedName: string } | null> => {
        // Extract Japanese character blocks (Kanji, Hiragana, Katakana, and specific symbols often in names)
        const jpNameRegex = /[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff々ヶ]+/g;
        const jpMatches = rawText.match(jpNameRegex) || [];

        if (jpMatches.length === 0) return null;

        /**
         * Helper to search with wildcards between characters
         * e.g., "太田晴" -> "%太%田%晴%"
         */
        const fuzzySearch = async (term: string): Promise<Player[]> => {
            if (term.length < 2) return [];
            const fuzzyTerm = `%${term.split('').join('%')}%`;

            const { data } = await supabase
                .from('players')
                .select('*')
                .ilike('full_name', fuzzyTerm)
                .limit(10); // Check more candidates for better accuracy

            return data || [];
        };

        const candidates: { player: Player; cleanedName: string; score: number }[] = [];

        const collectCandidates = async (term: string) => {
            const foundPlayers = await fuzzySearch(term);
            for (const p of foundPlayers) {
                const score = calculateMatchRate(term, p.full_name);
                if (score >= 60) {
                    candidates.push({ player: p, cleanedName: term, score });
                }
            }
        };

        // --- STEP 1: Try joining adjacent blocks (Full Name Priority) ---
        if (jpMatches.length >= 3) {
            for (let i = 0; i < jpMatches.length - 2; i++) {
                await collectCandidates(jpMatches[i] + jpMatches[i + 1] + jpMatches[i + 2]);
            }
        }

        if (jpMatches.length >= 2) {
            for (let i = 0; i < jpMatches.length - 1; i++) {
                await collectCandidates(jpMatches[i] + jpMatches[i + 1]);
            }
        }

        // --- STEP 2: Try single blocks (Fallback) ---
        for (const term of jpMatches) {
            if (term.length >= 2) await collectCandidates(term);
        }

        if (candidates.length === 0) return null;

        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);

        // If top scores are equal, prioritize "managed" player (if we knew which ones they are...)
        // For now, just return the best score
        return { player: candidates[0].player, cleanedName: candidates[0].cleanedName };
    };

    const finalizeResults = async (allMatches: MatchResult[]) => {
        addLog(`最終結果を整理中 (${allMatches.length} 件のヒット)...`);

        // 1. Filter out low confidence matches and duplicate players early
        const enhancedResults = allMatches
            .map(m => {
                const matchRate = m.player ? calculateMatchRate(m.originalText, m.player.full_name) : 0;
                const combinedConfidence = (m.confidence * 0.3) + (matchRate * 0.7);
                return { ...m, matchRate, confidence: combinedConfidence };
            })
            .filter(m => m.matchRate >= 60);

        // Deduplicate by player_id, keeping highest confidence
        const uniqueMatchesMap = new Map<string, typeof enhancedResults[0]>();
        enhancedResults.forEach(m => {
            const pid = m.player?.player_id;
            if (!pid) return;
            const existing = uniqueMatchesMap.get(pid);
            if (!existing || existing.confidence < m.confidence) {
                uniqueMatchesMap.set(pid, m);
            }
        });

        const dedupedResults = Array.from(uniqueMatchesMap.values());
        if (dedupedResults.length === 0) {
            setResults([]);
            setLoading(false);
            return;
        }

        // 2. Batch fetch rankings for all unique players
        addLog(`${dedupedResults.length} 名のランキングデータを取得中...`);
        const playerIds = dedupedResults.map(m => m.player?.player_id).filter(Boolean) as string[];

        let rankQuery = supabase
            .from('category_rankings')
            .select('player_id, rank, category, year_month')
            .in('player_id', playerIds);

        if (selectedCategory) {
            rankQuery = rankQuery.eq('category', selectedCategory);
            if (latestYearMonth) {
                rankQuery = rankQuery.eq('year_month', latestYearMonth);
            }
        }

        const { data: rankingData } = await rankQuery.order('year_month', { ascending: false });

        // Map ranking data back to results
        const finalResults = dedupedResults.map(m => {
            const playerRanks = rankingData?.filter(r => r.player_id === m.player?.player_id) || [];
            const latestRank = playerRanks[0]; // Already ordered by year_month desc
            return {
                ...m,
                rank: latestRank?.rank || null,
                category: latestRank?.category || m.player?.category || null
            };
        });

        const sortedResults = finalResults.sort((a, b) => b.confidence - a.confidence);
        setResults(sortedResults);
        setLoading(false);
        setProcessingStep('');
        addLog(`解析完了: ${sortedResults.length} 件の結果を表示します。`);
    };

    return (
        <div className="space-y-6 container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-tennis-green-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold font-display text-tennis-green-900 flex items-center">
                        <Search className="mr-3 h-8 w-8 text-tennis-green-600" />
                        ドロー分析
                        <span className="ml-3 text-sm bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-100 font-bold">β版</span>
                    </h1>
                    <p className="text-tennis-green-600 mt-1">
                        トーナメント表（ドロー）を読み取り、対戦相手の最新ランキングとポイントを表示します。
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-tennis-green-600 font-bold ml-1 mb-1">対象カテゴリー</span>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-white border border-tennis-green-200 text-gray-700 py-2 px-4 pr-8 rounded-xl outline-none focus:ring-2 focus:ring-tennis-green-500 appearance-none min-w-[140px] shadow-sm transition-all hover:border-tennis-green-400"
                        >
                            <option value="">すべて</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2 self-end">
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
                </div>
            </header>

            {showDebug && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl animate-in slide-in-from-top-4 duration-300">
                    <h4 className="text-amber-800 font-bold flex items-center gap-2 mb-2">
                        <Info size={18} /> OCR 実行ログ (最新順)
                    </h4>
                    {debugLogs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            {debugLogs.map((log, i) => (
                                <div key={i} className="text-[10px] bg-white p-2 rounded border border-amber-100 font-mono break-all leading-relaxed" title={log}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-amber-600/60 text-sm italic">
                            ログはありません。ファイルをアップロードすると解析プロセスが表示されます。
                        </div>
                    )}
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
                    <div className="lg:w-1/4 flex flex-col bg-white rounded-3xl shadow-lg border border-tennis-green-100 overflow-hidden relative">
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
                                {({ zoomIn, zoomOut, resetTransform }) => (
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

                    <div className="lg:w-3/4 flex flex-col bg-white rounded-3xl shadow-lg border border-tennis-green-100 overflow-hidden">
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
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">OCR認識テキスト</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">一致した選手 / 精度</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">順位 / pt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {results.map((res, idx) => {
                                            const matchRate = res.player ? calculateMatchRate(res.originalText, res.player.full_name) : 0;
                                            return (
                                                <tr key={idx} className="hover:bg-tennis-green-50/50 transition-colors group">
                                                    <td className="px-6 py-5">
                                                        <span className="font-mono text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                                            "{res.originalText}"
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div>
                                                                <p className="font-bold text-gray-800">{res.player?.full_name}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full ${matchRate > 80 ? 'bg-tennis-green-500' : 'bg-orange-400'}`}
                                                                            style={{ width: `${matchRate}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-tennis-green-600">
                                                                        一致率 {matchRate}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-tennis-green-600 font-black text-lg">
                                                                {res.rank ? `${res.rank}位` : '-'}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-bold">
                                                                {res.points?.toLocaleString() || '0'} pt
                                                            </span>
                                                            <span className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded mt-0.5 border border-blue-100">
                                                                {res.category}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
