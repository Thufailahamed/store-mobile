import React from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeImage } from "@/components/ui/SafeImage";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export interface ImageFieldProps {
  value: string;
  onChange: (v: string) => void;
  schema: { label?: string; altText?: string };
}

export function ImageField({ value, onChange, schema }: ImageFieldProps) {
  const pick = React.useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!res.canceled && res.assets[0]) {
      onChange(res.assets[0].uri);
    }
  }, [onChange]);

  return (
    <View style={styles.wrap}>
      {schema.label ? <Text style={styles.label}>{schema.label}</Text> : null}
      <Pressable onPress={pick} accessibilityLabel={schema.altText ?? "Image"} accessibilityRole="button" style={styles.box}>
        {value ? (
          <SafeImage uri={value} accessibilityLabel={schema.altText ?? ""} style={styles.preview} />
        ) : (
          <Text style={styles.placeholder}>Tap to select image</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing[2] },
  label: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginBottom: spacing[1] },
  box: { borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, minHeight: 120, alignItems: "center", justifyContent: "center", backgroundColor: colors.light.muted },
  preview: { width: "100%", height: 160, borderRadius: radii.md },
  placeholder: { color: colors.light.mutedForeground, fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm },
});
