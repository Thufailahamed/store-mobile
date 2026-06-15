import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radii, typography, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    []
  );

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: show }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entry Animation: Quick spring slide-up and fade-in
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();

    // 2. Auto-Dismiss Schedule
    const timer = setTimeout(() => {
      // 3. Exit Animation: Smooth fade-out and slide-up
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        onDismiss();
      });
    }, 2800);

    return () => clearTimeout(timer);
  }, [animatedValue, onDismiss]);

  const opacity = animatedValue;
  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  const iconName =
    toast.type === "success"
      ? "checkmark-circle"
      : toast.type === "error"
        ? "alert-circle"
        : "information-circle";

  const iconColor =
    toast.type === "success"
      ? colors.olive[300]
      : toast.type === "error"
        ? "#ff6b6b"
        : colors.accent2.ochre;

  const borderAccentColor =
    toast.type === "success"
      ? "rgba(83, 94, 44, 0.25)"
      : toast.type === "error"
        ? "rgba(192, 57, 43, 0.25)"
        : "rgba(200, 164, 74, 0.25)";

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          opacity,
          transform: [{ translateY }, { scale }],
          borderColor: borderAccentColor,
        },
      ]}
    >
      <Ionicons name={iconName} size={18} color={iconColor} style={styles.icon} />
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    bottom: 96, // Safe spacing above standard floating bars and layouts
    left: 24,
    right: 24,
    alignItems: "center",
    zIndex: 99999,
    gap: spacing[2],
  },
  toastItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 23, 15, 0.94)", // Luxury dark olive/charcoal translucent background
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxWidth: "100%",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: "#faf8f1", // Cream text color
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
    letterSpacing: 0.2,
  },
});
