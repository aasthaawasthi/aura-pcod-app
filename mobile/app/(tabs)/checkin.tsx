import { useState, useCallback, useEffect, useRef } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { dailyLogApi, ApiError, DailyLog } from "../../lib/api";
import { Screen, H1, H2, Body, Muted, Card, Chip, Input, PrimaryButton, ErrorText } from "../../components/ui";
import { colors, space, radius } from "../../lib/theme";
import { todayLocalStr, addDaysToDateStr } from "../../lib/date";

const MOODS = [
  { key: "great", label: "Great", emoji: "😄", color: colors.secondary },
  { key: "okay", label: "Okay", emoji: "🙂", color: colors.primary },
  { key: "low", label: "Low", emoji: "😔", color: colors.inkMuted },
  { key: "irritable", label: "Irritable", emoji: "😠", color: colors.notice },
  { key: "anxious", label: "Anxious", emoji: "😟", color: colors.gold },
];
const MOOD_BY_KEY: Record<string, (typeof MOODS)[number]> = Object.fromEntries(MOODS.map((m) => [m.key, m]));

const ENERGY_LEVELS = [1, 2, 3, 4, 5];

const SYMPTOMS = [
  "fatigue",
  "cravings",
  "acne",
  "bloating",
  "cramps",
  "headache",
  "hair fall",
  "mood swings",
  "sleepy",
  "lethargic",
  "boring",
];

export default function CheckIn() {
  const todayStr = todayLocalStr();

  const [mood, setMood] = useState<string | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Only today's entry can be edited here - a day picked on the trend
  // chart that isn't today is shown for reference only (Save is disabled
  // and the inputs below don't respond to taps).
  const isEditable = selectedDate === todayStr;
  const selectedLog = recentLogs.find((l) => l.log_date === selectedDate) || null;

  const load = useCallback(async () => {
    try {
      const recent = await dailyLogApi.recent().catch(() => []);
      setRecentLogs(recent);
      // Always land back on today when the page gains focus, even if a
      // past day was being viewed on a previous visit.
      setSelectedDate(todayStr);
      setError(null);
      // Belt-and-suspenders: the tab stays mounted when you navigate away
      // (expo-router doesn't unmount tab screens), so any save in flight
      // when you left is done by the time you're back. Never leave the
      // button stuck on its spinner across a visit.
      setLoading(false);
    } catch {
      // fine to start blank
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // The Mood/Energy/Symptoms/Note cards always mirror whichever day is
  // selected on the trend chart: real data when that day has a saved
  // check-in (fully, or just whatever fields were actually logged), or
  // nothing highlighted when it doesn't. This is what makes the cards
  // below the chart match what the chart itself already shows for that
  // day, and it's also how today's own in-progress edits get seeded from
  // whatever was already saved earlier today.
  useEffect(() => {
    setMood(selectedLog?.mood ?? null);
    setEnergy(selectedLog?.energy ?? null);
    setSymptoms(selectedLog?.symptoms ?? []);
    setNote(selectedLog?.note ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedLog?.mood, selectedLog?.energy, selectedLog?.note, JSON.stringify(selectedLog?.symptoms)]);

  const toggleSymptom = (s: string) => {
    if (!isEditable) return;
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const onSave = async () => {
    if (!isEditable) return;
    setError(null);
    setLoading(true);
    try {
      await dailyLogApi.save({
        logDate: todayStr,
        mood: mood ?? null,
        energy: energy ?? null,
        symptoms,
        note,
      });
      // Logging done - head back to the dashboard rather than lingering
      // on the form. The tab stays mounted in the background (expo-router
      // keeps tab screens alive), so `loading` has to be reset here too -
      // otherwise the button is still showing its spinner, stuck, the
      // next time this tab comes back into view.
      setLoading(false);
      router.push("/(tabs)/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your check-in.");
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.md }}>
        <View>
          <H1>How are you today?</H1>
          <Muted>A minute of logging sharpens every prediction and diet swap.</Muted>
        </View>

        <Card>
          <H2 style={{ fontSize: 16, marginBottom: 2 }}>Your trend</H2>
          <Muted style={{ fontSize: 11.5, marginBottom: space.sm }}>Scroll to browse, tap a day to see its record</Muted>
          <TrendChart
            logs={recentLogs}
            todayStr={todayStr}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <View style={{ marginTop: space.md }}>
            <DayDetail date={selectedDate} todayStr={todayStr} logs={recentLogs} />
          </View>
        </Card>

        <View style={styles.divider} />

        {!isEditable && (
          <Muted style={{ fontSize: 12 }}>
            Viewing {formatDate(selectedDate)} - past entries are read-only. Tap today on the chart above to edit.
          </Muted>
        )}

        <View pointerEvents={isEditable ? "auto" : "none"} style={{ gap: space.md, opacity: isEditable ? 1 : 0.55 }}>
          <Card>
            <Muted style={{ marginBottom: space.sm }}>Mood</Muted>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {MOODS.map((m) => {
                const selected = mood === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMood(m.key)}
                    style={{ alignItems: "center", gap: 4, flex: 1 }}
                  >
                    <View
                      style={[
                        styles.moodCircle,
                        selected && { backgroundColor: `${m.color}26`, borderColor: m.color },
                      ]}
                    >
                      <Body style={{ fontSize: 24, lineHeight: 30 }}>{m.emoji}</Body>
                    </View>
                    <Muted
                      style={{
                        fontSize: 10.5,
                        color: selected ? m.color : colors.inkMuted,
                        fontFamily: selected ? "Manrope_700Bold" : undefined,
                      }}
                    >
                      {m.label}
                    </Muted>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm }}>
              <Muted>Energy</Muted>
              {energy != null && <Muted style={{ fontSize: 11 }}>{energy}/5</Muted>}
            </View>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              {ENERGY_LEVELS.map((lvl) => {
                const filled = energy !== null && lvl <= energy;
                return (
                  <Pressable
                    key={lvl}
                    onPress={() => setEnergy((prev) => (prev === lvl ? null : lvl))}
                    hitSlop={6}
                    style={{ flex: 1, alignItems: "center" }}
                  >
                    <View style={[styles.energyDot, filled && styles.energyDotFilled]} />
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <Muted style={{ marginBottom: space.sm }}>Symptoms</Muted>
            <View style={styles.wrap}>
              {SYMPTOMS.map((s) => (
                <Chip key={s} label={s} selected={symptoms.includes(s)} onPress={() => toggleSymptom(s)} />
              ))}
            </View>
          </Card>

          <Card>
            <Muted style={{ marginBottom: space.sm }}>Anything else?</Muted>
            <Input
              placeholder="Optional note"
              value={note}
              onChangeText={setNote}
              editable={isEditable}
              multiline
              style={{ minHeight: 70, textAlignVertical: "top" }}
            />
          </Card>
        </View>

        <SymptomFrequency logs={recentLogs} />

        <History logs={recentLogs} todayStr={todayStr} />

        <ErrorText>{error}</ErrorText>

        {isEditable && (
          <PrimaryButton
            title={selectedLog ? "Update check-in" : "Save check-in"}
            onPress={onSave}
            loading={loading}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

// A Daylio-style scrollable strip: one bar per day, height = energy
// level, color = mood, going back to the user's very first check-in.
// An empty/grey sliver means no check-in that day, so gaps in the habit
// of logging are visible too, not just the good days. Tapping a bar
// selects that day so its full record can be shown below; future days
// simply aren't rendered, so there's nothing to tap ahead of today.
function TrendChart({
  logs,
  todayStr,
  selectedDate,
  onSelectDate,
}: {
  logs: DailyLog[];
  todayStr: string;
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  // Always show at least the current week's past days (Sun..today), even
  // for a brand-new account with no history yet, and reach further back
  // only when there's real logged history beyond that.
  const weekStart = addDaysToDateStr(todayStr, -6);
  const earliest = logs.length > 0 && logs[0].log_date < weekStart ? logs[0].log_date : weekStart;
  const spanDays = Math.max(0, Math.round((Date.parse(todayStr) - Date.parse(earliest)) / 86400000));
  const days = Array.from({ length: spanDays + 1 }, (_, i) => addDaysToDateStr(earliest, i));
  const byDate = Object.fromEntries(logs.map((l) => [l.log_date, l]));
  const BAR_MAX = 64;
  const COL_WIDTH = 30;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {days.map((d) => {
          const log = byDate[d];
          const moodMeta = log?.mood ? MOOD_BY_KEY[log.mood] : null;
          const hasData = !!log && (log.energy != null || log.mood);
          const heightFrac = log?.energy ? log.energy / 5 : hasData ? 0.3 : 0.08;
          const isToday = d === todayStr;
          const isSelected = d === selectedDate;
          return (
            <Pressable
              key={d}
              onPress={() => onSelectDate(d)}
              style={{ width: COL_WIDTH, alignItems: "center" }}
            >
              <View
                style={[
                  { height: BAR_MAX, justifyContent: "flex-end", borderRadius: 8, paddingTop: 4 },
                  isSelected && { backgroundColor: `${colors.primary}1a` },
                ]}
              >
                <View
                  style={[
                    styles.trendBar,
                    {
                      height: Math.max(6, BAR_MAX * heightFrac),
                      backgroundColor: moodMeta ? moodMeta.color : colors.border,
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <Muted
                style={{
                  fontSize: 10,
                  marginTop: 6,
                  color: isToday || isSelected ? colors.primary : colors.inkMuted,
                  fontFamily: isSelected ? "Manrope_700Bold" : undefined,
                }}
              >
                {dayNumberLabel(d)}
              </Muted>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

// The full record for whichever day is selected on the trend chart above -
// mood, energy, symptoms and note, or a friendly empty state if that day
// has no check-in at all.
function DayDetail({ date, todayStr, logs }: { date: string; todayStr: string; logs: DailyLog[] }) {
  const log = logs.find((l) => l.log_date === date) || null;
  const moodMeta = log?.mood ? MOOD_BY_KEY[log.mood] : null;
  const label = date === todayStr ? "Today" : formatDate(date);

  return (
    <View>
      <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 13, marginBottom: 6 }}>{label}</Body>
      {!log ? (
        <Muted style={{ fontSize: 12.5 }}>No check-in logged for this day.</Muted>
      ) : (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={styles.historyEmoji}>
              <Body style={{ fontSize: 17, lineHeight: 22 }}>{moodMeta?.emoji || "–"}</Body>
            </View>
            <View>
              <Body style={{ fontSize: 12.5 }}>{moodMeta?.label || "No mood noted"}</Body>
              <Muted style={{ fontSize: 11 }}>{log.energy != null ? `Energy ${log.energy}/5` : "No energy noted"}</Muted>
            </View>
          </View>
          {log.symptoms.length > 0 ? (
            <View style={styles.wrap}>
              {log.symptoms.map((s) => (
                <Chip key={s} label={s} selected onPress={() => {}} />
              ))}
            </View>
          ) : (
            <Muted style={{ fontSize: 11.5 }}>No symptoms noted</Muted>
          )}
          {log.note ? <Muted style={{ fontSize: 11.5 }}>"{log.note}"</Muted> : null}
        </View>
      )}
    </View>
  );
}

// Ranks which symptoms have come up most in the logged history, with a
// simple proportional bar - turns 14 days of chip-taps into a pattern
// that's actually visible at a glance.
function SymptomFrequency({ logs }: { logs: DailyLog[] }) {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    for (const s of log.symptoms || []) {
      counts[s] = (counts[s] || 0) + 1;
    }
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (ranked.length === 0) return null;
  const max = ranked[0][1];

  return (
    <Card>
      <H2 style={{ fontSize: 16, marginBottom: space.sm }}>Most logged lately</H2>
      <View style={{ gap: space.sm }}>
        {ranked.map(([symptom, count]) => (
          <View key={symptom}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
              <Body style={{ fontSize: 13 }}>{symptom}</Body>
              <Muted style={{ fontSize: 11 }}>
                {count} day{count > 1 ? "s" : ""}
              </Muted>
            </View>
            <View style={styles.freqTrack}>
              <View style={[styles.freqFill, { width: `${Math.max(8, (count / max) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

// A compact diary of past check-ins, newest first - the write-only form
// above now has somewhere to look back at, without leaving the page.
function History({ logs, todayStr }: { logs: DailyLog[]; todayStr: string }) {
  const entries = logs.filter((l) => l.log_date !== todayStr).slice().reverse();
  if (entries.length === 0) return null;

  return (
    <Card>
      <H2 style={{ fontSize: 16, marginBottom: space.sm }}>History</H2>
      <View style={{ gap: space.sm }}>
        {entries.map((log) => {
          const moodMeta = log.mood ? MOOD_BY_KEY[log.mood] : null;
          return (
            <View key={log.log_date} style={styles.historyRow}>
              <View style={styles.historyEmoji}>
                <Body style={{ fontSize: 17, lineHeight: 22 }}>{moodMeta?.emoji || "–"}</Body>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 12.5 }}>{formatDate(log.log_date)}</Body>
                  {log.energy != null && <Muted style={{ fontSize: 11 }}>· energy {log.energy}/5</Muted>}
                </View>
                {log.symptoms.length > 0 ? (
                  <Muted style={{ fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                    {log.symptoms.join(", ")}
                  </Muted>
                ) : (
                  <Muted style={{ fontSize: 11.5, marginTop: 2 }}>No symptoms noted</Muted>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function dayNumberLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return String(d.getDate());
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.xs,
  },
  moodCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  energyDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  energyDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  trendBar: {
    width: 16,
    borderRadius: 8,
  },
  freqTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },
  freqFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  historyEmoji: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
});
