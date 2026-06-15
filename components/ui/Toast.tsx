import React, { createContext, useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { colors, radii, typography } from "@/lib/theme/tokens";

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
  const [opacity] = useState(new Animated.Value(0));

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type }]);
      opacity.setValue(1);
      Animated.timing(opacity, {
        toValue: 0,
        duration: 3000,
        delay: 2000,
        useNativeDriver: true,
      }).start(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      });
    },
    [opacity]
  );

  const current = toasts[toasts.length - 1];
  const bgColor =
    current?.type === "error"
      ? colors.light.destructive
      : current?.type === "success"
        ? colors.olive[600]
        : colors.light.foreground;

  return (
    <ToastContext.Provider value={{ toast: show }}>
      {children}
      {current && (
        <Animated.View
          style={[styles.container, { opacity, backgroundColor: bgColor }]}
          pointerEvents="none"
        >
          <Text style={styles.text}>{current.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 60,
    alignSelf: "center",
    maxWidth: width - 48,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radii.xl,
    zIndex: 9999,
    elevation: 9999,
  },
  text: {
    color: "#faf8f1",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    textAlign: "center",
  },
});
