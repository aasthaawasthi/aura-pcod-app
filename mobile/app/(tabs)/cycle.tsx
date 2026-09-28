import { useCallback, useState } from "react";
import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { cycleApi, CycleInfo, ApiError, PeriodFlow, PeriodDay } from "../../lib/api";
import { Screen, H1, H2, Body, Muted, Card, Chip, PrimaryButton, SecondaryButton, ErrorText } from "../../components/ui";
import { PeriodCalendar } from "../../components/PeriodCalendar";
import { PeriodSummaryCalendar } from "../../components/PeriodSummaryCalendar";
import { CyclePhaseTimeline } from "../../components/CyclePhaseTimeline";
import { colors, phaseColors, space, periodColorScale, periodColorLabels, periodFlowSizes } from "../../lib/theme";
import { todayLocalStr, addDaysToDateStr } from "../../lib/date";

const COLOR_SCALE = periodColorScale;
const FLOW_DOT_SIZE = periodFlowSizes;
const DEFAULT_MARK_SPAN = 6; // start date + 5 more days, marked by default

type DayDetail = { flow: PeriodFlow; color: number };

function todayISO() {
  return todayLocalStr();
}

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function addDaysStr(dateStr: string, days: number) {
  return addDaysToDateStr(dateStr, days);
}

export default function CycleScreen() {
  const real = todayParts();
  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [calYear, setCalYear] = useState(real.year);
  const [calMonth, setCalMonth] = useState(real.month);
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [dayDetails, setDayDetails] = useState<Record<string, DayDetail>>({});
  const [bulkFlow, setBulkFlow] = useState<PeriodFlow>("medium");
  const [bulkColor, setBulkColor] = useState(5);

  const [summaryYear, setSummaryYear] = useState(real.year);
  const [summaryMonth, setSummaryMonth] = useState(real.month);
  const [periodDays, setPeriodDays] = useState<PeriodDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const load = useCallback(async () => {
    try {
      const c = await cycleApi.get();
      setCycle(c);
      setShowForm(!c.hasData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (year: number, month: number) => {
    try {
      const days = await cycleApi.periodDays(year, month);
      setPeriodDays(days);
    } catch {
      // ignore - summary is a nice-to-have, not core data
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadSummary(summaryYear, summaryMonth);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, loadSummary])
  );

  const changeSummaryMonth = (delta: number) => {
    let m = summaryMonth + delta;
    let y = summaryYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setSummaryYear(y);
    setSummaryMonth(m);
    loadSummary(y, m);
  };

  const changeMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setCalYear(y);
    setCalMonth(m);
  };

  const toggleDate = (date: string) => {
    setMarkedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
        setDayDetails((d) => {
          const copy = { ...d };
          delete copy[date];
          return copy;
        });
        return next;
      }

      if (prev.size === 0) {
        // First tap picks the period start - mark it plus the next 5 days
        // by default. The user can unmark any of these, or tap more days
        // to extend the range further.
        const seeded: Record<string, DayDetail> = {};
        for (let i = 0; i < DEFAULT_MARK_SPAN; i++) {
          const d = addDaysStr(date, i);
          next.add(d);
          seeded[d] = { flow: "medium", color: 5 };
        }
        setDayDetails((prevDetails) => ({ ...prevDetails, ...seeded }));
        return next;
      }

      next.add(date);
      setDayDetails((prevDetails) => ({ ...prevDetails, [date]: { flow: "medium", color: 5 } }));
      return next;
    });
  };

  const updateDayDetail = (date: string, patch: Partial<DayDetail>) => {
    setDayDetails((prev) => ({ ...prev, [date]: { ...prev[date], ...patch } as DayDetail }));
  };

  const clearSelection = () => {
    setMarkedDates(new Set());
    setDayDetails({});
    setBulkFlow("medium");
    setBulkColor(5);
  };

  const sortedMarkedDates = Array.from(markedDates).sort();

  const applyBulkFlow = (flow: PeriodFlow) => {
    setBulkFlow(flow);
    setDayDetails((prev) => {
      const next = { ...prev };
      for (const date of sortedMarkedDates) next[date] = { ...next[date], flow };
      return next;
    });
  };

  const applyBulkColor = (color: number) => {
    setBulkColor(color);
    setDayDetails((prev) => {
      const next = { ...prev };
      for (const date of sortedMarkedDates) next[date] = { ...next[date], color };
      return next;
    });
  };

  const savePeriod = async () => {
    setError(null);
    if (sortedMarkedDates.length === 0) {
      setError("Tap a date on the calendar to mark when your period started.");
      return;
    }
    setSaving(true);
    try {
      const days = sortedMarkedDates.map((date) => ({
        date,
        flow: dayDetails[date]?.flow || "medium",
        color: dayDetails[date]?.color ?? 5,
      }));
      await cycleApi.logDays(days);
      setShowForm(false);
      clearSelection();
      await load();
      await loadSummary(summaryYear, summaryMonth);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log this period.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const phaseStyle = cycle?.phase ? phaseColors[cycle.phase] : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xxl, gap: space.md }}>
        <H1 style={{ textAlign: "center" }}>Cycle</H1>

        <Card style={{ alignItems: "center" }}>
          <PeriodSummaryCalendar
            year={summaryYear}
            month={summaryMonth}
            days={periodDays}
            todayKey={todayISO()}
            onChangeMonth={changeSummaryMonth}
            selectedKey={selectedDate}
            onSelectDate={setSelectedDate}
          />

          <SelectedDayDetail date={selectedDate} days={periodDays} />

          <View style={styles.flowLegendRow}>
            {(["light", "medium", "heavy"] as const).map((f) => (
              <View key={f} style={styles.flowLegendItem}>
                <View
                  style={[
                    styles.flowLegendDot,
                    { width: FLOW_DOT_SIZE[f], height: FLOW_DOT_SIZE[f], borderRadius: FLOW_DOT_SIZE[f] },
                  ]}
                />
                <Muted style={{ fontSize: 11 }}>{capitalize(f)}</Muted>
              </View>
            ))}
          </View>

          {periodDays.length > 0 && (
            <>
              <View style={[styles.divider, { alignSelf: "stretch" }]} />
              <Body style={{ fontFamily: "Manrope_700Bold", alignSelf: "flex-start", marginBottom: space.xs }}>
                Color summary this month
              </Body>
              <View style={{ alignSelf: "stretch", gap: 6 }}>
                {COLOR_SCALE.map((hex, level) => {
                  const count = periodDays.filter((d) => d.color === level).length;
                  if (count === 0) return null;
                  return (
                    <View key={level} style={styles.colorSummaryRow}>
                      <View style={[styles.colorSummarySwatch, { backgroundColor: hex }]} />
                      <Body style={{ flex: 1 }}>{periodColorLabels[level]}</Body>
                      <Muted>
                        {count} day{count > 1 ? "s" : ""}
                      </Muted>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </Card>

        {cycle?.hasData && (
          <View style={{ alignItems: "center" }}>
            <Muted>
              Day {cycle.cycleDay} of your cycle · started{" "}
              {cycle.lastPeriodStart ? formatDate(cycle.lastPeriodStart) : "—"}
            </Muted>
            {phaseStyle && (
              <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 20, color: phaseStyle.fg, marginTop: 2 }}>
                {phaseStyle.label}
              </Body>
            )}
            {phaseStyle && (
              <Muted style={{ textAlign: "center", marginTop: 4, paddingHorizontal: space.md }}>
                {phaseStyle.description}
              </Muted>
            )}

            <View style={{ alignSelf: "stretch", marginTop: space.md }}>
              <CyclePhaseTimeline currentPhase={cycle.phase} />
            </View>

            <View style={styles.statsRow}>
              <InlineStat label="Typical cycle" value={cycle.avgCycleLength != null ? `${cycle.avgCycleLength}d` : "—"} />
              <View style={styles.statsDivider} />
              <InlineStat
                label="Next period"
                value={cycle.predictedNextPeriod ? formatDate(cycle.predictedNextPeriod) : "—"}
              />
              <View style={styles.statsDivider} />
              <InlineStat label="Confidence" value={capitalize(cycle.confidence || "low")} />
            </View>

            {cycle.flag && (
              <View style={[styles.flagBox, { alignSelf: "stretch" }]}>
                <Muted>{cycle.flag.message}</Muted>
              </View>
            )}
            {cycle.note && <Muted style={{ marginTop: space.sm, textAlign: "center" }}>{cycle.note}</Muted>}
          </View>
        )}

        {!cycle?.hasData && (
          <Card>
            <H2 style={{ marginBottom: space.xs }}>No cycles logged yet</H2>
            <Muted>Log your most recent period on the calendar below to begin building predictions.</Muted>
          </Card>
        )}

        {!showForm ? (
          <PrimaryButton title="Log a new period" onPress={() => setShowForm(true)} />
        ) : (
          <Card>
            <H2 style={{ marginBottom: space.xs }}>Log period</H2>
            <Muted style={{ marginBottom: space.md }}>
              Step 1 - tap the day your period started. We'll mark it plus the next 5 days automatically; tap
              any day to unmark it, or tap more days to extend the range.{"\n\n"}
              Step 2 - each marked day gets a default flow and color below. Adjust them for all days at once, or
              tap into any single day to fine-tune it.
            </Muted>

            <PeriodCalendar
              year={calYear}
              month={calMonth}
              markedDates={markedDates}
              todayKey={todayISO()}
              onToggleDate={toggleDate}
              onChangeMonth={changeMonth}
            />

            {sortedMarkedDates.length > 0 && (
              <View style={{ marginTop: space.lg, gap: space.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Body style={{ fontFamily: "Manrope_700Bold" }}>
                    {sortedMarkedDates.length} day{sortedMarkedDates.length > 1 ? "s" : ""} marked
                  </Body>
                  <Pressable onPress={clearSelection}>
                    <Muted style={{ color: colors.primary }}>Clear</Muted>
                  </Pressable>
                </View>

                <View style={[styles.dayRow, { backgroundColor: colors.surfaceSunken, borderStyle: "dashed" }]}>
                  <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: space.xs }}>
                    Set flow & color for all {sortedMarkedDates.length} days
                  </Body>
                  <Muted style={{ marginBottom: 6 }}>Flow</Muted>
                  <View style={{ flexDirection: "row", gap: space.xs, marginBottom: space.sm }}>
                    {(["light", "medium", "heavy"] as const).map((f) => (
                      <Chip key={f} label={capitalize(f)} selected={bulkFlow === f} onPress={() => applyBulkFlow(f)} />
                    ))}
                  </View>
                  <Muted style={{ marginBottom: 6 }}>Color (dark brown → bright red)</Muted>
                  <View style={{ flexDirection: "row", gap: space.xs }}>
                    {COLOR_SCALE.map((hex, level) => (
                      <Pressable
                        key={level}
                        onPress={() => applyBulkColor(level)}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: hex },
                          bulkColor === level && styles.colorSwatchSelected,
                        ]}
                      />
                    ))}
                  </View>
                  <Muted style={{ marginTop: space.sm }}>
                    Tap a day below to give it a different flow or color than the rest.
                  </Muted>
                </View>

                {sortedMarkedDates.map((date) => {
                  const detail = dayDetails[date] || { flow: "medium", color: 5 };
                  return (
                    <View key={date} style={styles.dayRow}>
                      <Body style={{ fontFamily: "Manrope_700Bold", marginBottom: space.xs }}>
                        {formatDate(date)}
                      </Body>

                      <Muted style={{ marginBottom: 6 }}>Flow</Muted>
                      <View style={{ flexDirection: "row", gap: space.xs, marginBottom: space.sm }}>
                        {(["light", "medium", "heavy"] as const).map((f) => (
                          <Chip
                            key={f}
                            label={capitalize(f)}
                            selected={detail.flow === f}
                            onPress={() => updateDayDetail(date, { flow: f })}
                          />
                        ))}
                      </View>

                      <Muted style={{ marginBottom: 6 }}>Color (dark brown → bright red)</Muted>
                      <View style={{ flexDirection: "row", gap: space.xs }}>
                        {COLOR_SCALE.map((hex, level) => (
                          <Pressable
                            key={level}
                            onPress={() => updateDayDetail(date, { color: level })}
                            style={[
                              styles.colorSwatch,
                              { backgroundColor: hex },
                              detail.color === level && styles.colorSwatchSelected,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <ErrorText>{error}</ErrorText>

            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
              <SecondaryButton
                title="Cancel"
                onPress={() => {
                  setShowForm(false);
                  clearSelection();
                  setError(null);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton title="Save" onPress={savePeriod} loading={saving} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        <Muted style={{ textAlign: "center", paddingHorizontal: space.md }}>
          Predictions are estimates based on your own logged history, not a medical diagnosis. If your cycles
          are consistently very irregular, it's worth discussing with a gynecologist.
        </Muted>
      </ScrollView>
    </Screen>
  );
}

// Shows the flow/color logged for whichever date the user tapped on the
// summary calendar above - or a plain "nothing logged" note otherwise.
function SelectedDayDetail({ date, days }: { date: string; days: PeriodDay[] }) {
  const entry = days.find((d) => d.log_date === date);
  return (
    <View style={{ alignSelf: "stretch", marginTop: space.sm }}>
      <View style={styles.selectedDayBox}>
        <Body style={{ fontFamily: "Manrope_700Bold" }}>{formatDate(date)}</Body>
        {entry ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 4 }}>
            <View
              style={[
                styles.colorSummarySwatch,
                { backgroundColor: periodColorScale[entry.color] },
              ]}
            />
            <Muted>
              {capitalize(entry.flow)} flow - {periodColorLabels[entry.color]}
            </Muted>
          </View>
        ) : (
          <Muted style={{ marginTop: 4 }}>No period logged on this day.</Muted>
        )}
      </View>
    </View>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Body style={{ fontFamily: "Manrope_700Bold", fontSize: 15 }}>{value}</Body>
      <Muted style={{ fontSize: 11, marginTop: 2 }}>{label}</Muted>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },
  flagBox: { marginTop: space.sm, backgroundColor: colors.noticeSoft, padding: space.sm, borderRadius: 12 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  statsDivider: {
    width: 1,
    height: "70%",
    backgroundColor: colors.border,
  },
  dayRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: space.sm,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: colors.ink,
  },
  flowLegendRow: {
    flexDirection: "row",
    gap: space.lg,
    marginTop: space.sm,
  },
  flowLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flowLegendDot: {
    backgroundColor: colors.primary,
  },
  selectedDayBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: space.sm,
    backgroundColor: colors.surfaceSunken,
  },
  colorSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  colorSummarySwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
