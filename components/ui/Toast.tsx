import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export type ToastType = "success" | "error" | "info";

export interface ToastOptions {
  title?: string;
  subtitle?: string;
  duration?: number;
}

interface ToastItemData {
  id: string;
  title: string;
  subtitle?: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toast: {
    (message: string, type?: ToastType, options?: ToastOptions): void;
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
  };
}

const ToastContext = createContext<ToastContextValue>({
  toast: Object.assign(() => {}, {
    success: () => {},
    error: () => {},
    info: () => {},
  }),
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItemData[]>([]);

  const show = useCallback(
    (message: string, type: ToastType = "info", options?: ToastOptions) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 5);
      const title = options?.title ?? message;
      const subtitle = options?.title ? message : options?.subtitle;
      const duration = options?.duration ?? 3200;

      setToasts((prev) => [...prev.slice(-2), { id, title, subtitle, type, duration }]);
    },
    []
  );

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastFn = useCallback(
    Object.assign(
      (message: string, type: ToastType = "info", options?: ToastOptions) => show(message, type, options),
      {
        success: (message: string, options?: ToastOptions) => show(message, "success", options),
        error: (message: string, options?: ToastOptions) => show(message, "error", options),
        info: (message: string, options?: ToastOptions) => show(message, "info", options),
      }
    ),
    [show]
  );

  const topOffset = Math.max(insets.top + 8, 20);

  return (
    <ToastContext.Provider value={{ toast: toastFn }}>
      {children}
      <View
        style={[styles.toastContainer, { top: topOffset }]}
        pointerEvents="box-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastItemData; onDismiss: () => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef(false);

  const dismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  }, [animatedValue, onDismiss]);

  useEffect(() => {
    // 1. Fluid Spring Slide-Down Entry
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 75,
      friction: 9,
    }).start();

    // 2. Auto-Dismiss Schedule
    const timer = setTimeout(() => {
      dismiss();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [animatedValue, dismiss, toast.duration]);

  const opacity = animatedValue;
  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-48, 0],
  });
  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const isSuccess = toast.type === "success";
  const isError = toast.type === "error";

  const iconName: keyof typeof Ionicons.glyphMap = isSuccess
    ? "checkmark-circle"
    : isError
    ? "alert-circle"
    : "information-circle";

  const iconBg = isSuccess
    ? "rgba(93, 112, 82, 0.28)"
    : isError
    ? "rgba(163, 72, 48, 0.28)"
    : "rgba(200, 164, 74, 0.28)";

  const iconColor = isSuccess
    ? "#b5d89f"
    : isError
    ? "#fca597"
    : "#f5d488";

  const borderAccent = isSuccess
    ? "rgba(125, 150, 110, 0.35)"
    : isError
    ? "rgba(195, 95, 75, 0.35)"
    : "rgba(200, 164, 74, 0.35)";

  const maxToastWidth = Math.min(screenWidth - 32, 380);

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          maxWidth: maxToastWidth,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={dismiss}
        style={[styles.toastItem, { borderColor: borderAccent }]}
        accessibilityRole="alert"
        accessibilityLabel={toast.title}
      >
        {/* Left Icon Emblem */}
        <View style={[styles.iconEmblem, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={17} color={iconColor} />
        </View>

        {/* Message Content */}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {toast.title}
          </Text>
          {toast.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {toast.subtitle}
            </Text>
          ) : null}
        </View>

        {/* Dismiss Touch Target */}
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Ionicons name="close" size={14} color="rgba(250, 248, 241, 0.45)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999999,
    gap: 8,
  },
  toastWrapper: {
    width: "100%",
    alignItems: "center",
  },
  toastItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(24, 25, 18, 0.96)", // Ultra-luxury frosted obsidian/espresso tone
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  iconEmblem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    paddingRight: 4,
    gap: 1,
  },
  title: {
    color: "#faf8f1", // Crisp warm cream
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: "rgba(250, 248, 241, 0.72)",
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    lineHeight: 15,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 2,
  },
});

