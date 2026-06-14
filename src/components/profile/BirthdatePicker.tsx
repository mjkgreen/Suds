import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";

interface BirthdatePickerProps {
  isVisible: boolean;
  onClose: () => void;
  currentDate?: string | null;
  onSave: (dateStr: string | null) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function parseInputDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  
  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  
  // Format: MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [m, d, y] = dateStr.split("/").map(Number);
    return new Date(y, m - 1, d);
  }
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}

function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function BirthdatePicker({
  isVisible,
  onClose,
  currentDate,
  onSave,
}: BirthdatePickerProps) {
  const parsed = parseInputDate(currentDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsed);
  const [viewDate, setViewDate] = useState<Date>(parsed || new Date(2000, 0, 1));
  const [mode, setMode] = useState<"days" | "months" | "years">("days");

  const yearScrollRef = useRef<ScrollView>(null);

  // Sync state when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      const initial = parseInputDate(currentDate);
      setSelectedDate(initial);
      setViewDate(initial || new Date(2000, 0, 1));
      setMode("days");
    }
  }, [isVisible, currentDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Handle year selection scroll positioning
  useEffect(() => {
    if (mode === "years" && yearScrollRef.current) {
      // Small timeout to allow render/layout
      setTimeout(() => {
        const currentYearValue = viewDate.getFullYear();
        const startYear = new Date().getFullYear();
        const index = startYear - currentYearValue;
        if (index >= 0) {
          // approx 50px per year item height (grid of 4 has ~12 rows of 48px)
          const row = Math.floor(index / 4);
          yearScrollRef.current?.scrollTo({ y: row * 52, animated: false });
        }
      }, 50);
    }
  }, [mode, viewDate]);

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (date: Date) => {
    setSelectedDate(date);
    setViewDate(date);
  };

  const handleSelectMonth = (monthIndex: number) => {
    setViewDate(new Date(year, monthIndex, 1));
    setMode("days");
  };

  const handleSelectYear = (selectedYear: number) => {
    setViewDate(new Date(selectedYear, month, 1));
    setMode("days");
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onSave(formatDateToYYYYMMDD(selectedDate));
    } else {
      onSave(null);
    }
    onClose();
  };

  const handleReset = () => {
    setSelectedDate(null);
  };

  // Generate calendar days
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  interface DayCell {
    day: number;
    monthOffset: number;
    date: Date;
  }

  const cells: DayCell[] = [];

  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

  // Add days from previous month to fill the first row
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({
      day,
      monthOffset: -1,
      date: new Date(prevMonthYear, prevMonth, day),
    });
  }

  // Add current month days
  for (let d = 1; d <= totalDays; d++) {
    cells.push({
      day: d,
      monthOffset: 0,
      date: new Date(year, month, d),
    });
  }

  // Add next month days to complete 6-row grid (42 days)
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const remainingCells = 42 - cells.length;
  for (let d = 1; d <= remainingCells; d++) {
    cells.push({
      day: d,
      monthOffset: 1,
      date: new Date(nextMonthYear, nextMonth, d),
    });
  }

  // Generate year options going back 100 years
  const startYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = startYear; y >= startYear - 100; y--) {
    years.push(y);
  }

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[
          { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
          isDesktop ? { justifyContent: "center", alignItems: "center" } : { justifyContent: "flex-end" },
        ]}
        onPress={onClose}
      >
        <Pressable
          style={isDesktop
            ? { width: 420, height: "85%", borderRadius: 24, padding: 24, backgroundColor: undefined }
            : { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, height: "72%" }
          }
          className="bg-card"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-xl font-bold text-foreground">Date of Birth</Text>
              <Text className="text-xs text-muted-foreground">Used privately for BAC estimation</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={handleReset}
                className="bg-accent rounded-full px-3 py-1.5 flex-row items-center gap-1"
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={14} color={isDark ? "#9ca3af" : "#4b5563"} />
                <Text className="text-muted-foreground text-xs font-semibold">Reset</Text>
              </TouchableOpacity>
              {isDesktop && (
                <TouchableOpacity
                  onPress={handleConfirm}
                  className="bg-primary rounded-full px-3 py-1.5"
                  activeOpacity={0.7}
                >
                  <Text className="text-primary-foreground text-xs font-semibold">Confirm</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                className="bg-accent rounded-full p-2"
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDark ? "#9ca3af" : "#4b5563"} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Current Selection Summary Banner */}
          <View className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-4 items-center justify-between flex-row">
            <View>
              <Text className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Selected Birthdate</Text>
              <Text className="text-lg font-bold text-foreground mt-0.5">
                {selectedDate
                  ? selectedDate.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Not Specified"}
              </Text>
            </View>
            {selectedDate && (
              <View className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-primary text-xs font-bold">
                  {new Date().getFullYear() - selectedDate.getFullYear()} Years Old
                </Text>
              </View>
            )}
          </View>

          {/* Mode Selectors / Fast Navigation Header */}
          <View className="flex-row items-center justify-between mb-4 px-1">
            <View className="flex-row items-center gap-1 bg-accent/50 p-1 rounded-xl">
              <TouchableOpacity
                onPress={() => setMode("days")}
                className={`px-3 py-1.5 rounded-lg ${
                  mode === "days" ? "bg-card" : ""
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    mode === "days" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Calendar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode("months")}
                className={`px-3 py-1.5 rounded-lg ${
                  mode === "months" ? "bg-card" : ""
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    mode === "months" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {MONTH_NAMES[month]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode("years")}
                className={`px-3 py-1.5 rounded-lg ${
                  mode === "years" ? "bg-card" : ""
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    mode === "years" ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {year}
                </Text>
              </TouchableOpacity>
            </View>

            {mode === "days" && (
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={handlePrevMonth}
                  className="bg-accent p-2 rounded-xl"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={16} color={isDark ? "#f3f4f6" : "#1f2937"} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNextMonth}
                  className="bg-accent p-2 rounded-xl"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-forward" size={16} color={isDark ? "#f3f4f6" : "#1f2937"} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* MAIN CALENDAR / SELECTOR BODY */}
          <View className="flex-1 justify-center mb-4">
            {mode === "days" && (
              <View className="flex-1">
                {/* Weekday Names Header */}
                <View className="flex-row mb-2">
                  {WEEKDAYS.map((day, idx) => (
                    <View key={idx} className="flex-1 items-center">
                      <Text className="text-xs font-semibold text-muted-foreground">{day}</Text>
                    </View>
                  ))}
                </View>

                {/* Day Grid */}
                <View className="flex-row flex-wrap justify-between">
                  {cells.map((cell, idx) => {
                    const isSelected =
                      selectedDate &&
                      cell.date.getDate() === selectedDate.getDate() &&
                      cell.date.getMonth() === selectedDate.getMonth() &&
                      cell.date.getFullYear() === selectedDate.getFullYear();

                    const isToday =
                      cell.date.getDate() === new Date().getDate() &&
                      cell.date.getMonth() === new Date().getMonth() &&
                      cell.date.getFullYear() === new Date().getFullYear();

                    const isCurrentMonth = cell.monthOffset === 0;

                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => handleSelectDay(cell.date)}
                        className={`w-[14%] aspect-square items-center justify-center rounded-full my-0.5 ${
                          isSelected
                            ? "bg-primary"
                            : isToday
                            ? "border border-primary"
                            : "active:bg-accent/30"
                        }`}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            isSelected
                              ? "text-primary-foreground"
                              : isCurrentMonth
                              ? "text-foreground"
                              : "text-muted-foreground/40"
                          }`}
                        >
                          {cell.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {mode === "months" && (
              <View className="flex-1">
                <Text className="text-xs font-bold text-muted-foreground uppercase mb-3 tracking-wider px-1">
                  Select Month
                </Text>
                <View className="flex-row flex-wrap gap-2 justify-between">
                  {MONTH_NAMES.map((mName, idx) => {
                    const isCurrentMonthSelection = idx === month;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => handleSelectMonth(idx)}
                        className={`w-[31%] py-4 rounded-2xl items-center justify-center my-1 ${
                          isCurrentMonthSelection
                            ? "bg-primary"
                            : "bg-accent/40"
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${
                            isCurrentMonthSelection
                              ? "text-primary-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {SHORT_MONTH_NAMES[idx]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {mode === "years" && (
              <View className="flex-1">
                <Text className="text-xs font-bold text-muted-foreground uppercase mb-3 tracking-wider px-1">
                  Select Year (Decades)
                </Text>
                <ScrollView
                  ref={yearScrollRef}
                  showsVerticalScrollIndicator={false}
                  className="flex-1"
                >
                  <View className="flex-row flex-wrap gap-2 justify-between pb-6">
                    {years.map((yValue) => {
                      const isCurrentYearSelection = yValue === year;
                      return (
                        <TouchableOpacity
                          key={yValue}
                          onPress={() => handleSelectYear(yValue)}
                          className={`w-[22%] py-3 rounded-xl items-center justify-center my-1 ${
                            isCurrentYearSelection
                              ? "bg-primary"
                              : "bg-accent/40"
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              isCurrentYearSelection
                                ? "text-primary-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {yValue}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>

          {/* Bottom Action Footer — mobile only */}
          {!isDesktop && (
            <View className="border-t border-border pt-4 flex-row gap-3">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 bg-accent/60 py-3.5 rounded-2xl items-center"
                activeOpacity={0.7}
              >
                <Text className="text-foreground text-sm font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                className="flex-1 bg-primary py-3.5 rounded-2xl items-center shadow-sm"
                activeOpacity={0.7}
              >
                <Text className="text-primary-foreground text-sm font-bold">Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
        {!isDesktop && <SafeAreaView className="bg-card" />}
      </Pressable>
    </Modal>
  );
}
