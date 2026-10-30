import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  PanResponder,
  LayoutAnimation,
  Platform,
  UIManager,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import {
  COLORS,
  SIZES,
  DISCOUNTS,
  PRICE_BOUNDS,
  PRICE_PRESETS,
  EMPTY_FILTERS,
  type ProductFilters,
} from "@/lib/api/facets";
import * as api from "@/lib/api";
import type { Brand, Category } from "@/lib/types";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GENDERS = [
  { key: "", label: "All" },
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "unisex", label: "Unisex" },
  { key: "kids", label: "Kids" },
];

const SORTS: { key: string; label: string; icon: IonIconName }[] = [
  { key: "newest", label: "Newest", icon: "time-outline" },
  { key: "for_you", label: "For you", icon: "sparkles-outline" },
  { key: "rating", label: "Top rated", icon: "star-outline" },
  { key: "sale", label: "Biggest sale", icon: "pricetag-outline" },
  { key: "price_asc", label: "Price: low", icon: "trending-up-outline" },
  { key: "price_desc", label: "Price: high", icon: "trending-down-outline" },
];

const RATINGS = [3, 4, 4.5];

/** Non-linear price stops so the slider is precise where most products sit. */
const PRICE_STEPS = [
  0, 1000, 2500, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000, 150000, 250000,
  PRICE_BOUNDS.max,
];

const nearestStep = (v: number) => {
  let best = 0;
  PRICE_STEPS.forEach((s, i) => {
    if (Math.abs(s - v) < Math.abs(PRICE_STEPS[best] - v)) best = i;
  });
  return best;
};

const shortPrice = (n: number) =>
  n >= 1000 ? `${n % 1000 === 0 ? n / 1000 : (n / 1000).toFixed(1)}K` : String(n);

const INK = colors.olive[900];
const CREAM = colors.paper.cream;
const SURFACE = "#ffffff";

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  resultCount: number;
}

/** Drop duplicate facet rows (e.g. a subcategory named like its parent)
 *  by normalized display name, keeping the first occurrence. */
function uniqueByName<T extends { id: string; name: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const animateLayout = () =>
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                           */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  summary,
  active,
  onClear,
  defaultOpen = true,
  children,
}: {
  title: string;
  summary?: string;
  active?: boolean;
  onClear?: () => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || !!active);
  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          animateLayout();
          setOpen((o) => !o);
        }}
        style={styles.cardHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {summary ? (
            <Text style={[styles.cardSummary, active && styles.cardSummaryActive]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        {active && onClear ? (
          <TouchableOpacity onPress={onClear} hitSlop={8} style={styles.clearLink}>
            <Text style={styles.clearLinkText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <Ionicons name="chevron-down" size={14} color={colors.light.foreground} />
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.cardBody}>{children}</View> : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityState={{ selected: active }}
    >
      {active ? <Ionicons name="checkmark" size={13} color={CREAM} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; icon?: IonIconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={String(o.key)}
            onPress={() => onChange(o.key)}
            activeOpacity={0.85}
            style={[styles.segmentItem, on && styles.segmentItemActive]}
            accessibilityState={{ selected: on }}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={12} color={on ? colors.accent2.ochre : colors.light.mutedForeground} />
            ) : null}
            <Text style={[styles.segmentText, on && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const THUMB = 28;

/** Dual-thumb slider over discrete stops. PanResponder (not RNGH) so it works
 *  inside RN's Modal without an extra GestureHandlerRootView. */
function RangeSlider({
  count,
  low,
  high,
  onChange,
  onDragState,
}: {
  count: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  onDragState: (dragging: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<"low" | "high" | null>(null);
  const live = useRef({ low, high, width, startX: 0, onChange, onDragState });
  live.current.low = low;
  live.current.high = high;
  live.current.width = width;
  live.current.onChange = onChange;
  live.current.onDragState = onDragState;

  const make = (which: "low" | "high") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const s = live.current;
        s.startX = ((which === "low" ? s.low : s.high) / (count - 1)) * s.width;
        setDragging(which);
        s.onDragState(true);
      },
      onPanResponderMove: (_, g) => {
        const s = live.current;
        if (!s.width) return;
        const ratio = Math.max(0, Math.min(1, (s.startX + g.dx) / s.width));
        const idx = Math.round(ratio * (count - 1));
        if (which === "low") {
          const next = Math.min(idx, s.high - 1);
          if (next !== s.low) s.onChange(next, s.high);
        } else {
          const next = Math.max(idx, s.low + 1);
          if (next !== s.high) s.onChange(s.low, next);
        }
      },
      onPanResponderRelease: () => {
        setDragging(null);
        live.current.onDragState(false);
      },
      onPanResponderTerminate: () => {
        setDragging(null);
        live.current.onDragState(false);
      },
    });

  const lowPR = useRef(make("low")).current;
  const highPR = useRef(make("high")).current;
  const x = (i: number) => (i / (count - 1)) * width;

  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderTrack} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.sliderFill, { left: x(low), width: Math.max(0, x(high) - x(low)) }]} />
        {Array.from({ length: count }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.sliderTick,
              { left: x(i) - 1 },
              i >= low && i <= high && styles.sliderTickActive,
            ]}
          />
        ))}
        {(["low", "high"] as const).map((which) => {
          const idx = which === "low" ? low : high;
          return (
            <View
              key={which}
              {...(which === "low" ? lowPR : highPR).panHandlers}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
              style={[
                styles.thumb,
                { left: x(idx) - THUMB / 2 },
                dragging === which && styles.thumbActive,
              ]}
              accessibilityLabel={which === "low" ? "Minimum price" : "Maximum price"}
            >
              <View style={styles.thumbDot} />
            </View>
          );
        })}
      </View>
      <View style={styles.sliderScale}>
        <Text style={styles.sliderScaleText}>{shortPrice(PRICE_STEPS[0])}</Text>
        <Text style={styles.sliderScaleText}>{shortPrice(PRICE_STEPS[count - 1])}+</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sheet                                                                     */
/* -------------------------------------------------------------------------- */

export function FilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  sort,
  onSortChange,
  resultCount,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const [draft, setDraft] = useState<ProductFilters>(filters);
  const [draftSort, setDraftSort] = useState(sort);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  const [scrollLocked, setScrollLocked] = useState(false);
  const [priceIdx, setPriceIdx] = useState<[number, number]>([0, PRICE_STEPS.length - 1]);

  /* ---- entrance + swipe-to-dismiss ---- */
  const translateY = useRef(new Animated.Value(screenH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(screenH);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }),
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, screenH, translateY, backdrop]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: screenH, duration: 220, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  const dragPR = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.1) dismissRef.current();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20 }).start();
      },
    }),
  ).current;

  /* ---- state sync ---- */
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setDraftSort(sort);
      setShowAllCategories(false);
      setShowAllBrands(false);
      setBrandQuery("");
      setPriceIdx([
        nearestStep(filters.price?.[0] ?? PRICE_BOUNDS.min),
        nearestStep(filters.price?.[1] ?? PRICE_BOUNDS.max),
      ]);
    }
  }, [visible, filters, sort]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    Promise.all([api.getBrands({ limit: 200 }), api.getCategories(100)]).then(([br, cat]) => {
      if (cancelled) return;
      if (br.ok) setBrands(br.data);
      if (cat.ok) setCategories(cat.data);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const uniqueCategories = useMemo(() => uniqueByName(categories), [categories]);
  const uniqueBrands = useMemo(() => uniqueByName(brands), [brands]);
  const visibleCategories = useMemo(() => {
    if (showAllCategories) return uniqueCategories;
    const selected = new Set(draft.categories ?? []);
    return uniqueCategories.filter((item, index) => index < 8 || selected.has(item.id)).slice(0, 12);
  }, [draft.categories, showAllCategories, uniqueCategories]);
  const visibleBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (q) return uniqueBrands.filter((b) => b.name.toLowerCase().includes(q));
    if (showAllBrands) return uniqueBrands;
    const selected = new Set(draft.brands ?? []);
    return uniqueBrands.filter((item, index) => index < 8 || selected.has(item.id)).slice(0, 12);
  }, [draft.brands, showAllBrands, uniqueBrands, brandQuery]);

  const priceMin = PRICE_STEPS[priceIdx[0]];
  const priceMax = PRICE_STEPS[priceIdx[1]];
  const priceActive = priceIdx[0] > 0 || priceIdx[1] < PRICE_STEPS.length - 1;
  const priceSummary = !priceActive
    ? "Any price"
    : priceIdx[1] === PRICE_STEPS.length - 1
      ? `From ${formatPrice(priceMin)}`
      : `${formatPrice(priceMin)} – ${formatPrice(priceMax)}`;

  const handleApply = () => {
    onApply({ ...draft, price: [priceMin, priceMax] });
    onSortChange(draftSort);
    dismiss();
  };

  const handleReset = () => {
    animateLayout();
    setDraft({ ...EMPTY_FILTERS });
    setDraftSort("newest");
    setBrandQuery("");
    setPriceIdx([0, PRICE_STEPS.length - 1]);
  };

  const draftCount =
    (draft.gender ? 1 : 0) +
    (priceActive ? 1 : 0) +
    (draft.brands?.length ?? 0) +
    (draft.categories?.length ?? 0) +
    (draft.colors?.length ?? 0) +
    (draft.sizes?.length ?? 0) +
    (draft.minRating ? 1 : 0) +
    (draft.minDiscount ? 1 : 0);

  const toggleIn = (key: "brands" | "categories" | "colors" | "sizes", id: string) => {
    const list = (draft[key] as string[] | undefined) ?? [];
    setDraft({ ...draft, [key]: list.includes(id) ? list.filter((v) => v !== id) : [...list, id] });
  };

  const namesFor = (ids: string[] | undefined, rows: { id: string; name: string }[]) => {
    if (!ids?.length) return undefined;
    const names = ids.map((id) => rows.find((r) => r.id === id)?.name).filter(Boolean) as string[];
    if (!names.length) return `${ids.length} selected`;
    return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
  };

  const sortLabel = SORTS.find((s) => s.key === draftSort)?.label ?? "Newest";
  const sheetMaxH = screenH * 0.92;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close filters" />
      </Animated.View>

      <Animated.View style={[styles.sheet, { maxHeight: sheetMaxH, transform: [{ translateY }] }]}>
        {/* Header — drag area */}
        <View {...dragPR.panHandlers} style={styles.headerArea}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Catalogue · {resultCount} pieces</Text>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Refine</Text>
                {draftCount > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{draftCount}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {draftCount > 0 || draftSort !== "newest" ? (
              <TouchableOpacity onPress={handleReset} hitSlop={8} style={styles.headerClear}>
                <Text style={styles.headerClearText}>Clear all</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={dismiss} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close filters">
              <Ionicons name="close" size={18} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          scrollEnabled={!scrollLocked}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sort */}
          <Section title="Sort by" summary={sortLabel} active={draftSort !== "newest"} onClear={() => setDraftSort("newest")}>
            <View style={styles.tileGrid}>
              {SORTS.map((s) => {
                const on = draftSort === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setDraftSort(s.key)}
                    activeOpacity={0.85}
                    style={[styles.sortTile, on && styles.sortTileActive]}
                    accessibilityState={{ selected: on }}
                  >
                    <View style={[styles.sortIcon, on && styles.sortIconActive]}>
                      <Ionicons name={s.icon} size={15} color={on ? colors.accent2.ochre : colors.olive[700]} />
                    </View>
                    <Text style={[styles.sortTileText, on && styles.sortTileTextActive]} numberOfLines={1}>
                      {s.label}
                    </Text>
                    {on ? <Ionicons name="checkmark-circle" size={16} color={colors.accent2.ochre} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Price */}
          <Section
            title="Price"
            summary={priceSummary}
            active={priceActive}
            onClear={() => setPriceIdx([0, PRICE_STEPS.length - 1])}
          >
            <View style={styles.priceReadout}>
              <View style={styles.priceBox}>
                <Text style={styles.priceBoxLabel}>Min</Text>
                <Text style={styles.priceBoxValue} numberOfLines={1}>{formatPrice(priceMin)}</Text>
              </View>
              <View style={styles.priceDash} />
              <View style={styles.priceBox}>
                <Text style={styles.priceBoxLabel}>Max</Text>
                <Text style={styles.priceBoxValue} numberOfLines={1}>
                  {formatPrice(priceMax)}
                  {priceIdx[1] === PRICE_STEPS.length - 1 ? "+" : ""}
                </Text>
              </View>
            </View>
            <RangeSlider
              count={PRICE_STEPS.length}
              low={priceIdx[0]}
              high={priceIdx[1]}
              onChange={(l, h) => setPriceIdx([l, h])}
              onDragState={(d) => setScrollLocked(d)}
            />
            <View style={styles.presetRow}>
              {PRICE_PRESETS.map((p) => {
                const lo = nearestStep(p.range[0]);
                const hi = nearestStep(p.range[1]);
                const on = priceIdx[0] === lo && priceIdx[1] === hi;
                return (
                  <TouchableOpacity
                    key={p.label}
                    onPress={() => setPriceIdx(on ? [0, PRICE_STEPS.length - 1] : [lo, hi])}
                    activeOpacity={0.85}
                    style={[styles.preset, on && styles.presetActive]}
                  >
                    <Text style={[styles.presetText, on && styles.presetTextActive]} numberOfLines={1}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Discount */}
          <Section
            title="Discount"
            summary={draft.minDiscount ? `${draft.minDiscount}% off or more` : "Any discount"}
            active={!!draft.minDiscount}
            onClear={() => setDraft({ ...draft, minDiscount: 0 })}
          >
            <Segmented
              options={[{ key: 0, label: "Any" }, ...DISCOUNTS.map((d) => ({ key: d.min as number, label: `${d.min}%+` }))]}
              value={draft.minDiscount ?? 0}
              onChange={(v) => setDraft({ ...draft, minDiscount: v })}
            />
          </Section>

          {/* Rating */}
          <Section
            title="Customer rating"
            summary={draft.minRating ? `${draft.minRating} stars & up` : "Any rating"}
            active={!!draft.minRating}
            onClear={() => setDraft({ ...draft, minRating: 0 })}
          >
            <View style={styles.ratingRow}>
              {RATINGS.map((r) => {
                const on = draft.minRating === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setDraft({ ...draft, minRating: on ? 0 : r })}
                    activeOpacity={0.85}
                    style={[styles.ratingTile, on && styles.ratingTileActive]}
                    accessibilityState={{ selected: on }}
                  >
                    <View style={styles.ratingStars}>
                      <Ionicons name="star" size={13} color={colors.accent2.ochre} />
                      <Text style={[styles.ratingValue, on && styles.ratingValueActive]}>{r.toFixed(1)}</Text>
                    </View>
                    <Text style={[styles.ratingCaption, on && styles.ratingCaptionActive]}>& up</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Colour */}
          <Section
            title="Colour"
            summary={draft.colors?.length ? draft.colors.join(", ") : "All colours"}
            active={!!draft.colors?.length}
            onClear={() => setDraft({ ...draft, colors: [] })}
          >
            <View style={styles.colorGrid}>
              {COLORS.map((c) => {
                const on = (draft.colors ?? []).includes(c.key);
                const light = c.light;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => toggleIn("colors", c.key)}
                    activeOpacity={0.8}
                    style={styles.colorItem}
                    accessibilityLabel={c.name}
                    accessibilityState={{ selected: on }}
                  >
                    <View style={[styles.swatchRing, on && styles.swatchRingActive]}>
                      <View style={[styles.swatch, { backgroundColor: c.hex }, light && styles.swatchBorder]}>
                        {on ? <Ionicons name="checkmark" size={15} color={light ? INK : "#fff"} /> : null}
                      </View>
                    </View>
                    <Text style={[styles.colorName, on && styles.colorNameActive]}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Size */}
          <Section
            title="Size"
            summary={draft.sizes?.length ? draft.sizes.join(" · ") : "All sizes"}
            active={!!draft.sizes?.length}
            onClear={() => setDraft({ ...draft, sizes: [] })}
          >
            <View style={styles.sizeGrid}>
              {SIZES.map((s) => {
                const on = (draft.sizes ?? []).includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleIn("sizes", s)}
                    activeOpacity={0.85}
                    style={[styles.sizeTile, on && styles.sizeTileActive]}
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.sizeText, on && styles.sizeTextActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Gender */}
          <Section
            title="Shop for"
            summary={GENDERS.find((g) => g.key === (draft.gender ?? ""))?.label ?? "All"}
            active={!!draft.gender}
            onClear={() => setDraft({ ...draft, gender: undefined })}
          >
            <Segmented
              options={GENDERS.map((g) => ({ key: g.key, label: g.label }))}
              value={draft.gender ?? ""}
              onChange={(v) => setDraft({ ...draft, gender: v || undefined })}
            />
          </Section>

          {/* Category */}
          {uniqueCategories.length > 0 ? (
            <Section
              title="Category"
              summary={namesFor(draft.categories, uniqueCategories) ?? "All categories"}
              active={!!draft.categories?.length}
              onClear={() => setDraft({ ...draft, categories: [] })}
              defaultOpen={false}
            >
              <View style={styles.chipsWrap}>
                {visibleCategories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    active={(draft.categories ?? []).includes(c.id)}
                    onPress={() => toggleIn("categories", c.id)}
                  />
                ))}
              </View>
              {uniqueCategories.length > visibleCategories.length || showAllCategories ? (
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => {
                    animateLayout();
                    setShowAllCategories((v) => !v);
                  }}
                >
                  <Text style={styles.moreText}>
                    {showAllCategories ? "Show fewer" : `Show all ${uniqueCategories.length}`}
                  </Text>
                  <Ionicons name={showAllCategories ? "chevron-up" : "chevron-down"} size={13} color={colors.olive[700]} />
                </TouchableOpacity>
              ) : null}
            </Section>
          ) : null}

          {/* Brand */}
          {uniqueBrands.length > 0 ? (
            <Section
              title="Brand"
              summary={namesFor(draft.brands, uniqueBrands) ?? "All brands"}
              active={!!draft.brands?.length}
              onClear={() => setDraft({ ...draft, brands: [] })}
              defaultOpen={false}
            >
              {uniqueBrands.length > 8 ? (
                <View style={styles.searchField}>
                  <Ionicons name="search" size={15} color={colors.light.mutedForeground} />
                  <TextInput
                    value={brandQuery}
                    onChangeText={setBrandQuery}
                    placeholder={`Search ${uniqueBrands.length} brands`}
                    placeholderTextColor={colors.light.mutedForeground}
                    style={styles.searchInput}
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {brandQuery ? (
                    <TouchableOpacity onPress={() => setBrandQuery("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.chipsWrap}>
                {visibleBrands.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.name}
                    active={(draft.brands ?? []).includes(b.id)}
                    onPress={() => toggleIn("brands", b.id)}
                  />
                ))}
                {visibleBrands.length === 0 ? (
                  <Text style={styles.emptyText}>No brands match “{brandQuery}”.</Text>
                ) : null}
              </View>
              {!brandQuery && (uniqueBrands.length > visibleBrands.length || showAllBrands) ? (
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => {
                    animateLayout();
                    setShowAllBrands((v) => !v);
                  }}
                >
                  <Text style={styles.moreText}>
                    {showAllBrands ? "Show fewer" : `Show all ${uniqueBrands.length}`}
                  </Text>
                  <Ionicons name={showAllBrands ? "chevron-up" : "chevron-down"} size={13} color={colors.olive[700]} />
                </TouchableOpacity>
              ) : null}
            </Section>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7} style={styles.resetBtn} accessibilityLabel="Reset all filters">
            <Ionicons name="refresh" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleApply} activeOpacity={0.9} style={styles.applyBtn} accessibilityLabel="Apply filters">
            <Text style={styles.applyText}>
              {draftCount > 0 ? "Apply filters" : "Show results"}
            </Text>
            {draftCount > 0 ? (
              <View style={styles.applyCount}>
                <Text style={styles.applyCountText}>{draftCount}</Text>
              </View>
            ) : (
              <Ionicons name="arrow-forward" size={16} color={CREAM} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(22, 23, 15, 0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper.DEFAULT,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    ...shadows.editorial,
  },
  headerArea: {
    backgroundColor: CREAM,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.olive[600],
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 30,
    letterSpacing: -0.8,
    color: colors.light.foreground,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: colors.accent2.ochre,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: colors.olive[950],
  },
  headerClear: {
    paddingVertical: 6,
  },
  headerClearText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.accent2.rust,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  content: {
    padding: spacing[4],
    gap: spacing[3],
  },

  /* Section card */
  card: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.light.border}aa`,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
  },
  cardTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  cardSummary: {
    marginTop: 2,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  cardSummaryActive: {
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.semibold,
  },
  clearLink: {
    paddingVertical: 4,
  },
  clearLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.accent2.rust,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paper.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  cardBody: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },

  /* Sort tiles */
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing[2],
  },
  sortTile: {
    width: "48.8%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 50,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: SURFACE,
  },
  sortTileActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  sortIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  sortIconActive: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  sortTileText: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  sortTileTextActive: {
    color: CREAM,
  },

  /* Price */
  priceReadout: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  priceBox: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.paper.DEFAULT,
  },
  priceBoxLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  priceBoxValue: {
    marginTop: 2,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  priceDash: {
    width: 10,
    height: 1.5,
    backgroundColor: colors.light.border,
  },
  sliderWrap: {
    paddingHorizontal: THUMB / 2,
    paddingTop: spacing[5],
    paddingBottom: spacing[1],
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.muted,
    justifyContent: "center",
  },
  sliderFill: {
    position: "absolute",
    height: 4,
    borderRadius: 2,
    backgroundColor: INK,
  },
  sliderTick: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.light.border,
  },
  sliderTickActive: {
    backgroundColor: "rgba(250,248,241,0.6)",
  },
  thumb: {
    position: "absolute",
    top: 2 - THUMB / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  thumbActive: {
    transform: [{ scale: 1.15 }],
    borderColor: INK,
  },
  thumbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: INK,
  },
  sliderScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[4],
    marginHorizontal: -THUMB / 2,
  },
  sliderScaleText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  presetRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing[3],
  },
  preset: {
    flex: 1,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  presetActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  presetText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  presetTextActive: {
    color: CREAM,
  },

  /* Segmented */
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors.paper.DEFAULT,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: {
    backgroundColor: INK,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },
  segmentTextActive: {
    color: CREAM,
  },

  /* Rating */
  ratingRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  ratingTile: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    gap: 2,
  },
  ratingTileActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  ratingStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
  },
  ratingValueActive: {
    color: CREAM,
  },
  ratingCaption: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  ratingCaptionActive: {
    color: "rgba(250,248,241,0.7)",
  },

  /* Colour */
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing[3],
  },
  colorItem: {
    width: "25%",
    alignItems: "center",
    gap: 5,
  },
  swatchRing: {
    padding: 3,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  swatchRingActive: {
    borderColor: INK,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchBorder: {
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  colorName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  colorNameActive: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.light.foreground,
  },

  /* Size */
  sizeGrid: {
    flexDirection: "row",
    gap: 6,
  },
  sizeTile: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeTileActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  sizeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
  sizeTextActive: {
    color: CREAM,
  },

  /* Chips (category / brand) */
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: SURFACE,
  },
  chipActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  chipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.foreground,
  },
  chipTextActive: {
    color: CREAM,
    fontFamily: fontFamilies.sans.semibold,
  },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: spacing[3],
    paddingVertical: 4,
  },
  moreText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12.5,
    color: colors.olive[700],
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.paper.DEFAULT,
    marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.light.foreground,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },

  /* Footer */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: CREAM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  resetBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 27,
    backgroundColor: INK,
    ...shadows.glow,
    shadowColor: INK,
  },
  applyText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15.5,
    color: CREAM,
    letterSpacing: 0.2,
  },
  applyCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: colors.accent2.ochre,
    alignItems: "center",
    justifyContent: "center",
  },
  applyCountText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: colors.olive[950],
  },
});

// Default export of the price label for reuse.
export { formatPrice };
