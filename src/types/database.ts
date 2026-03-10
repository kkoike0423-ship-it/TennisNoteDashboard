export type Player = {
    player_id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    team: string;
    category: string;
    gender: string;
    school_type: string;
    update_ym: string;
    ranking_point: number;
};

export type PlayerRankingHistory = {
    player_id: string;
    year_month: string;
    points_raw: number;
    points_value: number;
    created_at: string;
    updated_at: string;
};

export type CategoryRanking = {
    category: string;
    player_id: string;
    year_month: string;
    rank: number;
    created_at: string;
    updated_at: string;
};
