import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  format,
  parseISO,
  isValid,
  getDaysInMonth,
  startOfMonth,
  getDay,
  addMonths,
  subMonths,
} from 'date-fns';

// ─── DrumPicker ───────────────────────────────────────────────────────────────

const ITEM_H = 44;
const VISIBLE = 5;
const DRUM_H = ITEM_H * VISIBLE;

interface DrumPickerProps {
  data: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width?: number;
  formatItem?: (item: string | number) => string;
}

function DrumPicker({ data, selectedIndex, onSelect, width = 80, formatItem }: DrumPickerProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const raw = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
      const idx = Math.max(0, Math.min(raw, data.length - 1));
      onSelect(idx);
    },
    [data.length, onSelect],
  );

  return (
    <View style={{ width, height: DRUM_H }}>
      {/* centre-selection highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_H * 2,
          left: 4,
          right: 4,
          height: ITEM_H,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
          zIndex: 10,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      >
        {data.map((item, i) => {
          const dist = Math.abs(i - selectedIndex);
          const opacity = [1, 0.65, 0.3, 0.1, 0.05][Math.min(dist, 4)];
          const fontSize = dist === 0 ? 22 : dist === 1 ? 18 : 15;
          return (
            <View
              key={i}
              style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text
                style={{
                  color: '#f8fafc',
                  opacity,
                  fontSize,
                  fontWeight: dist === 0 ? '600' : '400',
                }}
              >
                {formatItem ? formatItem(item) : String(item)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}

function Calendar({ selectedDate, onSelectDate }: CalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));

  const daysInMonth = getDaysInMonth(viewMonth);
  const firstWeekday = getDay(viewMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = Math.floor(cells.length / 7);

  return (
    <View>
      {/* Month navigation */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          onPress={() => setViewMonth(prev => subMonths(prev, 1))}
          className="p-2"
        >
          <Ionicons name="chevron-back" size={20} color="#9ca3af" />
        </TouchableOpacity>
        <Text className="text-foreground font-semibold text-base">
          {format(viewMonth, 'MMMM yyyy')}
        </Text>
        <TouchableOpacity
          onPress={() => setViewMonth(prev => addMonths(prev, 1))}
          className="p-2"
        >
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View className="flex-row mb-1">
        {WEEKDAYS.map(d => (
          <View key={d} className="flex-1 items-center py-1">
            <Text className="text-muted-foreground text-xs font-medium">{d}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {Array.from({ length: weeks }, (_, w) => (
        <View key={w} className="flex-row">
          {cells.slice(w * 7, w * 7 + 7).map((day, idx) => {
            const isSelected =
              day !== null &&
              day === selectedDate.getDate() &&
              viewMonth.getMonth() === selectedDate.getMonth() &&
              viewMonth.getFullYear() === selectedDate.getFullYear();
            const isToday =
              day !== null &&
              (() => {
                const now = new Date();
                return (
                  day === now.getDate() &&
                  viewMonth.getMonth() === now.getMonth() &&
                  viewMonth.getFullYear() === now.getFullYear()
                );
              })();
            return (
              <TouchableOpacity
                key={idx}
                className="flex-1 items-center py-0.5"
                onPress={() => {
                  if (day === null) return;
                  onSelectDate(
                    new Date(
                      viewMonth.getFullYear(),
                      viewMonth.getMonth(),
                      day,
                      selectedDate.getHours(),
                      selectedDate.getMinutes(),
                    ),
                  );
                }}
                disabled={day === null}
              >
                <View
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    isSelected ? 'bg-primary' : ''
                  }`}
                >
                  {day !== null && (
                    <Text
                      className={
                        isSelected
                          ? 'text-primary-foreground font-semibold text-sm'
                          : isToday
                            ? 'text-primary font-semibold text-sm'
                            : 'text-foreground text-sm'
                      }
                    >
                      {day}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface TimePickerProps {
  selectedDate: Date;
  onChangeDate: (d: Date) => void;
}

function TimePicker({ selectedDate, onChangeDate }: TimePickerProps) {
  const h24 = selectedDate.getHours();
  const isPM = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const minRounded = Math.round(selectedDate.getMinutes() / 5) * 5;
  const minuteSnapped = minRounded >= 60 ? 55 : minRounded;

  const hourIndex = HOURS.indexOf(h12);
  const minuteIndex = MINUTES.indexOf(minuteSnapped);

  function handleHourSelect(idx: number) {
    const newH12 = HOURS[idx];
    const newH24 = newH12 === 12 ? (isPM ? 12 : 0) : isPM ? newH12 + 12 : newH12;
    onChangeDate(
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        newH24,
        selectedDate.getMinutes(),
      ),
    );
  }

  function handleMinuteSelect(idx: number) {
    onChangeDate(
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedDate.getHours(),
        MINUTES[idx],
      ),
    );
  }

  function togglePeriod() {
    const delta = isPM ? -12 : 12;
    onChangeDate(
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedDate.getHours() + delta,
        selectedDate.getMinutes(),
      ),
    );
  }

  return (
    <View className="items-center">
      <View className="flex-row items-center justify-center gap-2">
        {/* Hour drum */}
        <DrumPicker
          key={`h-${isPM}`}
          data={HOURS}
          selectedIndex={hourIndex >= 0 ? hourIndex : 0}
          onSelect={handleHourSelect}
          width={72}
        />

        <Text className="text-foreground text-2xl font-bold pb-1">:</Text>

        {/* Minute drum */}
        <DrumPicker
          key="min"
          data={MINUTES}
          selectedIndex={minuteIndex >= 0 ? minuteIndex : 0}
          onSelect={handleMinuteSelect}
          width={72}
          formatItem={m => String(m).padStart(2, '0')}
        />

        {/* AM / PM toggle */}
        <View className="ml-2 gap-2">
          {(['AM', 'PM'] as const).map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => { if ((p === 'PM') !== isPM) togglePeriod(); }}
              className={`px-3 py-2 rounded-lg ${
                (p === 'PM') === isPM
                  ? 'bg-primary'
                  : 'bg-accent border border-border'
              }`}
            >
              <Text
                className={
                  (p === 'PM') === isPM
                    ? 'text-primary-foreground font-semibold text-sm'
                    : 'text-muted-foreground text-sm'
                }
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text className="text-muted-foreground text-xs mt-4">
        {format(selectedDate, 'h:mm a')}
      </Text>
    </View>
  );
}

// ─── SimpleDateTimePicker ─────────────────────────────────────────────────────

interface SimpleDateTimePickerProps {
  value: string; // ISO string
  onChange: (value: string) => void;
  label?: string;
}

export function SimpleDateTimePicker({
  value,
  onChange,
  label = 'Date & Time',
}: SimpleDateTimePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'date' | 'time'>('date');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : new Date();
  });

  function handleOpen() {
    const parsed = parseISO(value);
    setSelectedDate(isValid(parsed) ? parsed : new Date());
    setActiveTab('date');
    setModalVisible(true);
  }

  function handleSave() {
    onChange(selectedDate.toISOString());
    setModalVisible(false);
  }

  const displayDate = isValid(parseISO(value))
    ? format(parseISO(value), 'MMM d, h:mm a')
    : 'Now';

  return (
    <View>
      <Pressable
        onPress={handleOpen}
        className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
      >
        <Text className="text-foreground text-base">{displayDate}</Text>
        <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-card rounded-2xl w-full max-w-sm overflow-hidden border border-border shadow-2xl">
            {/* Header */}
            <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View className="flex-row border-b border-border">
              {(['date', 'time'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 py-3 items-center flex-row justify-center gap-1.5 ${
                    activeTab === tab ? 'border-b-2 border-primary' : ''
                  }`}
                >
                  <Ionicons
                    name={tab === 'date' ? 'calendar-outline' : 'time-outline'}
                    size={16}
                    color={activeTab === tab ? '#6366f1' : '#9ca3af'}
                  />
                  <Text
                    className={
                      activeTab === tab
                        ? 'text-primary font-semibold text-sm'
                        : 'text-muted-foreground text-sm'
                    }
                  >
                    {tab === 'date' ? 'Date' : 'Time'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Content */}
            <View className="p-5">
              {activeTab === 'date' ? (
                <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              ) : (
                <TimePicker
                  key="time-picker"
                  selectedDate={selectedDate}
                  onChangeDate={setSelectedDate}
                />
              )}
            </View>

            {/* Selected value summary */}
            <View className="px-5 pb-2">
              <Text className="text-center text-muted-foreground text-xs">
                {format(selectedDate, "EEE, MMM d yyyy 'at' h:mm a")}
              </Text>
            </View>

            {/* Actions */}
            <View className="flex-row gap-3 px-5 pb-5 pt-2">
              <Pressable
                onPress={() => setModalVisible(false)}
                className="flex-1 py-3 items-center rounded-xl border border-border bg-accent"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                className="flex-1 py-3 items-center rounded-xl bg-primary"
              >
                <Text className="text-primary-foreground font-semibold">Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
