import { createElement } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";

const BROWN = "#4A3728";
const ACCENT = "#8B7355";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDatetimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function atHour(base: Date, hour: number) {
  const next = new Date(base);
  next.setHours(hour, 0, 0, 0);
  return next;
}

interface ScheduleDatetimeProps {
  value: Date | null;
  onChange: (date: Date) => void;
  /** Allow selecting dates in the past (for archive backdating). */
  allowPast?: boolean;
}

export function ScheduleDatetime({ value, onChange, allowPast = false }: ScheduleDatetimeProps) {
  const [showNative, setShowNative] = useState(false);
  const selected = value || atHour(allowPast ? new Date() : new Date(Date.now() + 24 * 60 * 60 * 1000), 10);

  const setPreset = (daysAhead: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    onChange(atHour(date, 10));
  };

  return (
    <View>
      {Platform.OS === "web" ? (
        createElement("input", {
          type: "datetime-local",
          value: toDatetimeLocalValue(selected),
          ...(allowPast ? {} : { min: toDatetimeLocalValue(new Date()) }),
          onChange: (event: { target?: { value?: string } }) => {
            const next = event?.target?.value;
            if (!next) return;
            const parsed = new Date(next);
            if (!Number.isNaN(parsed.getTime())) onChange(parsed);
          },
          style: {
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #E8E2D8",
            background: "#fff",
            color: BROWN,
            fontSize: 14,
            fontFamily: "inherit",
          },
        })
      ) : (
        <>
          <Pressable onPress={() => setShowNative(true)} style={styles.dateBtn}>
            <MaterialIcons name="calendar-today" size={18} color={ACCENT} />
            <Text style={styles.dateBtnText}>
              {selected.toLocaleString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </Pressable>
          {showNative ? (
            <DateTimePicker
              value={selected}
              mode="datetime"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              {...(allowPast ? {} : { minimumDate: new Date() })}
              onChange={(_event, date) => {
                setShowNative(Platform.OS === "ios");
                if (date) onChange(date);
              }}
            />
          ) : null}
        </>
      )}
      {!allowPast ? (
        <View style={styles.presets}>
          <Pressable onPress={() => setPreset(1)} style={styles.preset}>
            <Text style={styles.presetText}>Завтра 10:00</Text>
          </Pressable>
          <Pressable onPress={() => setPreset(7)} style={styles.preset}>
            <Text style={styles.presetText}>Через неделю</Text>
          </Pressable>
          <Pressable onPress={() => setPreset(30)} style={styles.preset}>
            <Text style={styles.presetText}>Через месяц</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  dateBtnText: { fontSize: 14, color: BROWN },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F3EEE4",
  },
  presetText: { fontSize: 12, color: ACCENT },
});
