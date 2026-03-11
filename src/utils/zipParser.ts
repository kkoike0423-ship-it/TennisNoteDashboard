import JSZip from 'jszip';
import Papa from 'papaparse';
import { supabase } from './supabaseClient';
import type { Player } from '../types/database';

type PlayerCsvRow = {
    playerId?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    team?: string;
    category?: string;
    gender?: string;
    schoolType?: string;
    updateYm?: string;
    rankingPoint?: string;
};

type RankingHistoryCsvRow = {
    playerId?: string;
    yearMonth?: string;
    pointsRaw?: string;
    pointsValue?: string;
    createdAt?: string;
    updatedAt?: string;
};

type CategoryRankingCsvRow = {
    category?: string;
    playerId?: string;
    yearMonth?: string;
    rank?: string;
    createdAt?: string;
    updatedAt?: string;
};

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};

export const parseAndUploadZip = async (file: File, onProgress: (msg: string) => void) => {
    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);

        let playersCsv = '';
        let historyCsv = '';
        let categoryCsv = '';

        onProgress('Extracting specific CSV files from ZIP...');

        for (const [filename, zipEntry] of Object.entries(contents.files)) {
            if (zipEntry.dir) continue;

            const lowerName = filename.toLowerCase();

            // Extract only the 3 specific files based on Android app's prefix
            if (lowerName.startsWith('players_') && lowerName.endsWith('.csv')) {
                playersCsv = await zipEntry.async('text');
            } else if (lowerName.startsWith('player_ranking_history_') && lowerName.endsWith('.csv')) {
                historyCsv = await zipEntry.async('text');
            } else if (lowerName.startsWith('category_rankings_') && lowerName.endsWith('.csv')) {
                categoryCsv = await zipEntry.async('text');
            }
        }

        if (!playersCsv && !historyCsv && !categoryCsv) {
            throw new Error('No relevant CSV files (players, player_ranking_history, or category_rankings) found in the ZIP.');
        }

        // Process Players
        if (playersCsv) {
            onProgress('Parsing Players CSV...');
            const parsed = Papa.parse(playersCsv, { header: true, skipEmptyLines: true });
            const players: Player[] = (parsed.data as PlayerCsvRow[]).map(row => ({
                player_id: (row.playerId || '').trim(),
                first_name: (row.firstName || '').trim(),
                last_name: (row.lastName || '').trim(),
                full_name: (row.fullName || '').trim(),
                team: (row.team || '').trim(),
                category: (row.category || '').trim(),
                gender: (row.gender || '').trim(),
                school_type: (row.schoolType || '').trim(),
                update_ym: (row.updateYm || '').trim(),
                ranking_point: parseInt(row.rankingPoint ?? '0', 10) || 0
            })).filter(p => p.player_id); // ensure valid ID

            onProgress(`Uploading ${players.length} Players to Database...`);
            // Warning: In production, large arrays should be chunked before upserting
            const { error } = await supabase.from('players').upsert(
                players.map(p => ({
                    player_id: p.player_id,
                    first_name: p.first_name,
                    last_name: p.last_name,
                    full_name: p.full_name,
                    team: p.team,
                    category: p.category,
                    gender: p.gender,
                    school_type: p.school_type,
                    update_ym: p.update_ym,
                    ranking_point: p.ranking_point
                })),
                { onConflict: 'player_id' }
            );
            if (error) throw new Error(`Player Upload Error: ${error.message}`);
        }

        // Process Ranking History
        if (historyCsv) {
            onProgress('Parsing Ranking History CSV...');
            const parsed = Papa.parse(historyCsv, { header: true, skipEmptyLines: true });
            const historyRows = (parsed.data as RankingHistoryCsvRow[]).map(row => ({
                player_id: row.playerId,
                year_month: row.yearMonth,
                points_raw: parseInt(row.pointsRaw ?? '0', 10) || 0,
                points_value: parseInt(row.pointsValue ?? '0', 10) || 0,
                created_at: row.createdAt ? new Date(parseInt(row.createdAt, 10)).toISOString() : null,
                updated_at: row.updatedAt ? new Date(parseInt(row.updatedAt, 10)).toISOString() : null
            })).filter(r => r.player_id && r.year_month);

            onProgress(`Uploading ${historyRows.length} Ranking History records...`);
            const { error } = await supabase.from('player_ranking_history').upsert(
                historyRows,
                { onConflict: 'player_id, year_month' }
            );
            if (error) throw new Error(`History Upload Error: ${error.message}`);
        }

        // Process Category Rankings
        if (categoryCsv) {
            onProgress('Parsing Category Rankings CSV...');
            const parsed = Papa.parse(categoryCsv, { header: true, skipEmptyLines: true });
            const categoryRows = (parsed.data as CategoryRankingCsvRow[]).map(row => ({
                category: (row.category || '').trim(),
                player_id: (row.playerId || '').trim(),
                year_month: (row.yearMonth || '').trim(),
                rank: parseInt(row.rank ?? '0', 10) || 0,
                created_at: row.createdAt ? new Date(parseInt(row.createdAt, 10)).toISOString() : null,
                updated_at: row.updatedAt ? new Date(parseInt(row.updatedAt, 10)).toISOString() : null
            })).filter(r => r.player_id && r.category && r.year_month);

            onProgress(`Uploading ${categoryRows.length} Category Ranking records...`);
            const { error } = await supabase.from('category_rankings').upsert(
                categoryRows,
                { onConflict: 'player_id, category, year_month' }
            );
            if (error) throw new Error(`Category Ranking Upload Error: ${error.message}`);
        }

        onProgress('Upload Complete!');
        return true;
    } catch (error: unknown) {
        onProgress(`Error: ${getErrorMessage(error)}`);
        return false;
    }
};
