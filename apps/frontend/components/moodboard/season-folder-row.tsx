import { Pressable, StyleSheet, Text, View } from "react-native";
import { SeasonFolder } from "@/components/moodboard/season-folder";
import { MOODBOARD_BROWN_DARK, SEASON_META } from "@/lib/moodboard/constants";
import { MOODBOARD_FOLDER_SOURCES } from "@/lib/moodboard/folder-assets";
import type { MoodboardSeason } from "@/lib/moodboard/types";

const SEASONS: MoodboardSeason[] = ["summer", "autumn", "winter", "spring"];

type Props = {
  activeSeason?: MoodboardSeason;
  onPressSeason: (season: MoodboardSeason) => void;
  folderSize?: number;
};

export function SeasonFolderRow({ activeSeason, onPressSeason, folderSize = 78 }: Props) {
  return (
    <View style={styles.row}>
      {SEASONS.map((season) => {
        const meta = SEASON_META[season];
        const active = season === activeSeason;
        return (
          <Pressable
            key={season}
            onPress={() => onPressSeason(season)}
            style={({ pressed }) => [styles.cell, pressed && { opacity: 0.88 }]}
          >
            <SeasonFolder source={MOODBOARD_FOLDER_SOURCES[season]} enabled={meta.enabled} size={folderSize} />
            <Text style={[styles.label, active && styles.labelActive, !meta.enabled && styles.labelSoon]}>
              {meta.labelShort}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    paddingHorizontal: 2,
  },
  cell: { alignItems: "center", flex: 1, backgroundColor: "transparent" },
  label: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: MOODBOARD_BROWN_DARK,
    marginTop: 6,
    textTransform: "lowercase",
  },
  labelActive: { opacity: 1 },
  labelSoon: { opacity: 0.55 },
});
