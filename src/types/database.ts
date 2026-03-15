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

export type Tournament = {
    tournament_id: string;
    player_id: string;
    name: string;
    category: string;
    format: string;
    location: string;
    date: string;
    tournament_code: string;
    tournament_date: string;
    tournament_name: string;
    venue: string;
    match_type: string;
    created_at: string;
};

export type Game = {
    game_id: string;
    tournament_id: string;
    main_player_id: string;
    partner_id: string;
    opponent1_id: string;
    opponent2_id: string;
    set1_self: number;
    set1_opp: number;
    set2_self: number;
    set2_opp: number;
    set3_self: number;
    set3_opp: number;
    set4_self: number;
    set4_opp: number;
    set5_self: number;
    set5_opp: number;
    tb_self: number;
    tb_opp: number;
    format: string;
    score: string;
    result: string;
    memo: string;
    external_game_id: string;
    created_at: string;
};
