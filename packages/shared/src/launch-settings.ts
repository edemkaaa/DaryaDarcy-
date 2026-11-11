/** Контракты сезонного оформления, расписания и настроек запуска, общие для редактора и сервера. */
export type Season = "winter" | "spring" | "summer" | "autumn";
export interface SeasonAppearance {
  /** Annual start date MM-DD in Europe/Moscow. Feb 29 is not supported. */
  startsOn: string;
  backgroundUrl: string | null;
  bannerUrl: string | null;
}
export interface LaunchConfiguration {
  timezone: "Europe/Moscow";
  seasonMode: "fixed" | "calendar";
  fixedSeason: Season;
  seasons: Record<Season, SeasonAppearance>;
  managerEmail: string;
}
export interface LaunchConfigurationSnapshot {
  revision: number;
  config: LaunchConfiguration;
}
