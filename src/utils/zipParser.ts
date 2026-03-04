import JSZip from 'jszip';
import Papa from 'papaparse';
import { supabase } from './supabaseClient';
import type { Player } from '../types/database';

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
            const players: Player[] = (parsed.data as any[]).map(row => ({
                player_id: row.playerId,
                first_name: row.firstName,
                last_name: row.lastName,
                full_name: row.fullName,
                team: row.team,
                category: row.category,
                gender: row.gender,
                school_type: row.schoolType,
                update_ym: row.updateYm,
                ranking_point: parseInt(row.rankingPoint) || 0
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
            const historyRows = (parsed.data as any[]).map(row => ({
                player_id: row.playerId,
                year_month: row.yearMonth,
                points_raw: parseInt(row.pointsRaw) || 0,
                points_value: parseInt(row.pointsValue) || 0,
                created_at: row.createdAt ? new Date(parseInt(row.createdAt)).toISOString() : null,
                updated_at: row.updatedAt ? new Date(parseInt(row.updatedAt)).toISOString() : null
            })).filter(r => r.player_id && r.year_month);

            onProgress(`Uploading ${historyRows.length} Ranking History records...`);
            // Since this table doesn't have a natural unique constraint defined by us inside the App (relies on UUID), 
            // we might just insert, but we should make sure we don't duplicate. 
            // For simplicity in this demo, we will truncate the table and insert if we are the admin,
            // but a better approach is a unique constraint on (player_id, year_month).
            const { error } = await supabase.from('player_ranking_history').insert(historyRows);
            // Ignore dupes or handle accordingly if a constraint exists
            if (error && !error.message.includes('duplicate')) throw new Error(`History Upload Error: ${error.message}`);
        }

        // Process Category Rankings
        if (categoryCsv) {
            onProgress('Parsing Category Rankings CSV...');
            const parsed = Papa.parse(categoryCsv, { header: true, skipEmptyLines: true });
            const categoryRows = (parsed.data as any[]).map(row => ({
                category: row.category,
                player_id: row.playerId,
                year_month: row.yearMonth,
                rank: parseInt(row.rank) || 0,
                created_at: row.createdAt ? new Date(parseInt(row.createdAt)).toISOString() : null,
                updated_at: row.updatedAt ? new Date(parseInt(row.updatedAt)).toISOString() : null
            })).filter(r => r.player_id && r.category && r.year_month);

            onProgress(`Uploading ${categoryRows.length} Category Ranking records...`);
            const { error } = await supabase.from('category_rankings').insert(categoryRows);
            if (error && !error.message.includes('duplicate')) throw new Error(`Category Ranking Upload Error: ${error.message}`);
        }

        onProgress('Upload Complete!');
        return true;
    } catch (error: any) {
        onProgress(`Error: ${error.message}`);
        return false;
    }
};
